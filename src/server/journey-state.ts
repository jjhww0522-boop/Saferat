import 'server-only';
import { context } from './store';
import { demoTaskEntry } from './demo-tasks';
import { memberClient } from './supabase';
import { uuid } from '@/domain/workspace';
import { z } from 'zod';
import type { DemoState } from '@/domain/types';
import { requireDemoConfig } from '@/domain/config';
import { parseRiskJourneyCursor } from '@/domain/journey';

const cursorSchema = z.string().refine(value => /^(profile:[0-3]|welcome:(seen|new))$/.test(value) || parseRiskJourneyCursor(value) !== null);
const registry = globalThis as typeof globalThis & { safetyJourney?: WeakMap<DemoState, Map<string, string>> };
const states = registry.safetyJourney ??= new WeakMap();
export async function journeyState(demo: boolean, workplace: string, resource: string, value?: string): Promise<string | null> {
  if (value !== undefined) cursorSchema.parse(value);
  if (demo) {
    requireDemoConfig(process.env);
    const ctx = await context();
    if (!ctx.actor.tenantId || !ctx.workplaces.some(w => w.id === workplace)) throw new Error('access_denied');
    if (!['profile', 'welcome'].includes(resource)) {
      const { entry } = await demoTaskEntry(resource);
      if (entry.task.workplace_id !== workplace || entry.task.definition_id !== 'REVIEW-003') throw new Error('access_denied');
    }
    if (value && !value.startsWith(resource === 'profile' ? 'profile:' : resource === 'welcome' ? 'welcome:' : 'risk:')) throw new Error('invalid_state');
    const key = `${ctx.actor.persona}:${ctx.actor.tenantId}:${workplace}:${resource}`;
    let state = states.get(ctx.state);
    if (!state) { state = new Map(); states.set(ctx.state, state); }
    if (value !== undefined) state.set(key, value);
    return state.get(key) ?? null;
  }
  const { client } = await memberClient();
  const { data, error } = await client.rpc('safety_journey_state', { workplace: uuid.parse(workplace), resource, cursor: value ?? null });
  if (error) throw error;
  return data === null ? null : cursorSchema.parse(data);
}
