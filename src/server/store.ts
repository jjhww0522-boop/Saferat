import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readConfig } from '@/domain/config';
import { createSeed, actorFor } from '@/demo/seed';
import type { DemoState, Persona } from '@/domain/types';
import { canAccess, WorkflowError } from '@/domain/workflow';

const registry = globalThis as typeof globalThis & { safetyDemo?: Map<string, { state: DemoState; touched: number }> };
const sessions: Map<string, { state: DemoState; touched: number }> = registry.safetyDemo ??= new Map();
export function newSession() {
  for (const [key, value] of sessions) if (Date.now() - value.touched > 86400000) sessions.delete(key);
  if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
  const id = crypto.randomUUID();
  sessions.set(id, { state: createSeed(), touched: Date.now() });
  return id;
}
export async function context() {
  const config = readConfig(process.env);
  const jar = await cookies();
  const token = jar.get('safety-demo')?.value;
  const entry = token ? sessions.get(token) : undefined;
  if (!entry) redirect('/demo?expired=1');
  entry.touched = Date.now();
  const raw = jar.get('safety-persona')?.value;
  const persona: Persona = raw === 'member-b' || raw === 'reviewer' || raw === 'unassigned' ? raw : 'member-a';
  const actor = actorFor(persona);
  const workplaces = entry.state.workplaces.filter(w => canAccess(actor, w.tenantId));
  const selected = jar.get('safety-workplace')?.value;
  const workplace = workplaces.find(w => w.id === selected) ?? workplaces[0];
  return { config, actor, state: entry.state, workplaces, workplace };
}
export async function memberContext() {
  const ctx = await context();
  if (!ctx.actor.tenantId) redirect('/ops');
  return ctx;
}
export async function opsContext() {
  const ctx = await context();
  if (ctx.actor.tenantId) redirect('/app');
  return ctx;
}
export function requireWorkplace(ctx: Awaited<ReturnType<typeof context>>, id: string) {
  const workplace = ctx.state.workplaces.find(w => w.id === id && w.tenantId === ctx.actor.tenantId);
  if (!workplace) throw new WorkflowError('이 현장을 수정할 수 없습니다.');
  return workplace;
}
