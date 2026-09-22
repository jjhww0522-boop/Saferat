import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireDemoConfig } from '@/domain/config';
import { createSeed, actorFor } from '@/demo/seed';
import type { DemoState, Persona } from '@/domain/types';
import { canAccess, WorkflowError } from '@/domain/workflow';

type DemoSession = { state: DemoState; touched: number; persona: Persona; fixture: boolean };
const registry = globalThis as typeof globalThis & { safetyDemo?: Map<string, DemoSession> };
const sessions: Map<string, DemoSession> = registry.safetyDemo ??= new Map();
export function newSession() {
  for (const [key, value] of sessions) if (Date.now() - value.touched > 86400000) sessions.delete(key);
  if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
  const id = crypto.randomUUID();
  sessions.set(id, { state: createSeed(), touched: Date.now(), persona: 'member-a', fixture: false });
  return id;
}
export async function context() {
  const config = requireDemoConfig(process.env);
  const jar = await cookies();
  const token = jar.get('safety-demo')?.value;
  const entry = token ? sessions.get(token) : undefined;
  if (!entry) redirect('/demo?expired=1');
  entry.touched = Date.now();
  const persona: Persona = entry.persona ?? 'member-a';
  const actor = actorFor(persona);
  const workplaces = entry.state.workplaces.filter(w => canAccess(actor, w.tenantId));
  const selected = jar.get('safety-workplace')?.value;
  const workplace = workplaces.find(w => w.id === selected) ?? workplaces[0];
  return { config, actor, state: entry.state, workplaces, workplace };
}
export async function memberContext() {
  const ctx = await context();
  if (!ctx.actor.tenantId) redirect('/demo');
  return ctx;
}
export async function opsContext() {
  if (!(await demoOperatorContext())) redirect('/ops/login');
  const ctx = await context();
  return ctx;
}
export async function demoOperatorContext() {
  if (process.env.APP_MODE === 'live' || process.env.SAFETY_ENABLE_TEST_FIXTURES !== '1') return null;
  const token = (await cookies()).get('safety-demo')?.value;
  const entry = token ? sessions.get(token) : undefined;
  if (!entry?.fixture || !['reviewer', 'unassigned'].includes(entry.persona)) return null;
  return context();
}
// Called only by the token-protected E2E fixture handler, never by a server action.
export function fixtureSession(source: string, persona: Persona) {
  const entry = sessions.get(source);
  if (!entry || process.env.SAFETY_ENABLE_TEST_FIXTURES !== '1' || process.env.APP_MODE === 'live') throw new Error('Fixture unavailable');
  const token = crypto.randomUUID();
  sessions.set(token, { state: entry.state, persona, fixture: true, touched: Date.now() });
  return token;
}
export function requireWorkplace(ctx: Awaited<ReturnType<typeof context>>, id: string) {
  const workplace = ctx.state.workplaces.find(w => w.id === id && w.tenantId === ctx.actor.tenantId);
  if (!workplace) throw new WorkflowError('이 현장을 수정할 수 없습니다.');
  return workplace;
}
