import 'server-only';
import { context } from './store';
import { emptyProfile, taskDefinition, type TaskRecord, type TaskProfile } from '@/domain/tasks';
import type { DemoState } from '@/domain/types';
import { profileInput, isSetupDefinition, canConfirmProfile } from '@/domain/workplace-profile';
import { summarizeJourneySource } from '@/domain/task-action-source';

export interface DemoTaskDocument {
  id: string; title: string; revision: number; review_status: string; submission_status: 'needs_confirmation';
  versions: { id: string; number: number; content: string; created_at: string; confirmed_at: string | null; sample: boolean }[];
  reviews: { id: string; version_id: string; status: string; location: string; comment: string; internal_note: string }[];
  activities: { id: string; performed_on: string; note: string; corrects_id: string | null }[];
}
type Entry = { task: TaskRecord; document: DemoTaskDocument | null; history: { at: string; before: TaskRecord; after: TaskRecord }[] };
const registry = globalThis as typeof globalThis & { safetyTasks?: WeakMap<DemoState, { tasks: Map<string, Entry>; profiles: Map<string, TaskProfile> }> };
const states = registry.safetyTasks ??= new WeakMap();
const profileRegistry = globalThis as typeof globalThis & { safetyProfileHistory?: WeakMap<DemoState, { workplace: string; at: string; before: TaskProfile; after: TaskProfile }[]> };
const profileHistory = profileRegistry.safetyProfileHistory ??= new WeakMap();
async function taskState() {
  const ctx = await context();
  let state = states.get(ctx.state);
  if (!state) { state = { tasks: new Map(), profiles: new Map() }; states.set(ctx.state, state); }
  return { ...ctx, taskState: state };
}
export async function demoTaskList(workplace?: string) {
  const ctx = await taskState();
  const selected = ctx.workplaces.find(w => w.id === workplace) ?? ctx.workplace;
  if (workplace && selected?.id !== workplace) throw new Error('access_denied');
  const tasks = [...ctx.taskState.tasks.values()].filter(e => ctx.workplaces.some(w => w.id === e.task.workplace_id) && (!selected || e.task.workplace_id === selected.id)).map(e => ({ ...e.task, review_status: e.document?.review_status ?? 'not_requested' }));
  const sources = tasks.map(task => ({ ...summarizeJourneySource(task.id, ctx.taskState.tasks.get(task.id)?.document?.versions[0]), task_snapshot: { revision: task.revision, review_status: task.review_status, owner: task.owner, target_date: task.target_date } }));
  return { tasks, sources, profile: selected ? profileInput.parse(ctx.taskState.profiles.get(selected.id) ?? emptyProfile) : emptyProfile, workplace: selected, workplaces: ctx.workplaces };
}
export async function demoTaskEntry(id: string, write = false) {
  const ctx = await taskState();
  const entry = ctx.taskState.tasks.get(id) ?? [...ctx.taskState.tasks.values()].find(e => e.document?.id === id);
  if (!entry || !ctx.workplaces.some(w => w.id === entry.task.workplace_id) || (write && !ctx.actor.tenantId)) throw new Error('access_denied');
  return { entry, ctx };
}
export async function startDemoTask(workplace: string, definition: string) {
  const ctx = await taskState();
  if (!ctx.actor.tenantId || !ctx.workplaces.some(w => w.id === workplace)) throw new Error('access_denied');
  const def = taskDefinition(definition);
  if (!def) throw new Error('invalid_state');
  const found = [...ctx.taskState.tasks.values()].filter(e => e.task.workplace_id === workplace && e.task.definition_id === definition).sort((a, b) => (b.task.cycle_number ?? 1) - (a.task.cycle_number ?? 1))[0];
  if (found) return found.task.id;
  if (isSetupDefinition(definition) || !ctx.taskState.profiles.get(workplace)?.confirmed_at) throw new Error('profile_required');
  const id = crypto.randomUUID();
  ctx.taskState.tasks.set(id, { task: { id, workplace_id: workplace, definition_id: definition, definition_version: def.version, title: def.title, category: def.category, document_id: null, sensitive: false, owner: '', target_date: null, revision: 1, review_status: 'not_requested', cycle_number: 1, previous_task_id: null }, document: null, history: [] });
  return id;
}
export async function startNextDemoTaskCycle(id: string, expectedRevision: number) {
  const { entry, ctx } = await demoTaskEntry(id, true);
  const previous = entry.task;
  if (previous.revision !== expectedRevision) throw new Error('revision_conflict');
  if (previous.definition_id !== 'REVIEW-003') throw new Error('invalid_state');
  const successor = [...ctx.taskState.tasks.values()].find(e => e.task.previous_task_id === previous.id);
  if (successor) return successor.task.id;
  if (!entry.document?.versions.length) throw new Error('cycle_record_required');
  if (!ctx.taskState.profiles.get(previous.workplace_id)?.confirmed_at) throw new Error('profile_required');
  const definition = taskDefinition(previous.definition_id)!;
  const next = crypto.randomUUID();
  ctx.taskState.tasks.set(next, { task: { id: next, workplace_id: previous.workplace_id, definition_id: definition.id, definition_version: definition.version, title: definition.title, category: definition.category, document_id: null, sensitive: previous.sensitive, owner: '', target_date: null, revision: 1, review_status: 'not_requested', cycle_number: (previous.cycle_number ?? 1) + 1, previous_task_id: previous.id }, document: null, history: [] });
  return next;
}
export async function saveDemoTask(id: string, input: { expected_revision: number; document_revision: number | null; owner: string; target_date: string | null }, content: string | null) {
  const { entry } = await demoTaskEntry(id, true);
  if (entry.task.revision !== input.expected_revision || (entry.document && entry.document.revision !== input.document_revision)) throw new Error('revision_conflict');
  if (content && entry.document?.review_status === 'queued') throw new Error('review_pending');
  const before = { ...entry.task };
  if (content) {
    if (!entry.document) entry.document = { id: `demo-doc-${crypto.randomUUID()}`, title: entry.task.title, revision: 1, review_status: 'not_requested', submission_status: 'needs_confirmation', versions: [], reviews: [], activities: [] };
    const doc = entry.document;
    if (doc.versions[0]?.content !== content) {
      if (doc.versions.length) { doc.revision++; doc.review_status = 'reopened'; }
      doc.versions.unshift({ id: crypto.randomUUID(), number: doc.versions.length + 1, content, created_at: new Date().toISOString(), confirmed_at: null, sample: false });
    }
    entry.task.document_id = doc.id;
  }
  entry.task.owner = input.owner; entry.task.target_date = input.target_date; entry.task.revision++;
  entry.history.push({ at: new Date().toISOString(), before, after: { ...entry.task } });
}
export async function saveDemoProfile(workplace: string, profile: TaskProfile) {
  const ctx = await taskState();
  if (!ctx.actor.tenantId || !ctx.workplaces.some(w => w.id === workplace)) throw new Error('access_denied');
  const before = profileInput.parse(ctx.taskState.profiles.get(workplace) ?? emptyProfile);
  if (profile.revision !== before.revision) throw new Error('revision_conflict');
  if (profile.confirmed_at && !canConfirmProfile(profile)) throw new Error('profile_incomplete');
  const after = { ...profile, revision: before.revision + 1 };
  const history = profileHistory.get(ctx.state) ?? [];
  history.push({ workplace, at: new Date().toISOString(), before: structuredClone(before), after: structuredClone(after) });
  profileHistory.set(ctx.state, history);
  ctx.taskState.profiles.set(workplace, after);
}
export async function updateDemoTaskDocument(id: string, form: FormData) {
  const { entry, ctx } = await demoTaskEntry(id);
  const d = entry.document;
  if (!d) throw new Error('invalid_state');
  if (Number(form.get('revision')) !== d.revision) throw new Error('revision_conflict');
  const command = String(form.get('command'));
  if (command === 'review' ? ctx.actor.persona !== 'reviewer' : !ctx.actor.tenantId) throw new Error('access_denied');
  const v = d.versions[0];
  if (command === 'sample') {
    if (v.confirmed_at) throw new Error('invalid_state');
    v.sample = true;
  } else if (command === 'confirm') {
    if (v.confirmed_at) throw new Error('invalid_state');
    v.confirmed_at = new Date().toISOString();
  } else if (command === 'submit') {
    if (!v.confirmed_at || d.reviews.some(r => r.version_id === v.id)) throw new Error('invalid_state');
    d.reviews.push({ id: crypto.randomUUID(), version_id: v.id, status: 'queued', location: '', comment: '', internal_note: '' }); d.review_status = 'queued';
  } else if (command === 'review') {
    const r = d.reviews.find(r => r.id === form.get('review') && r.status === 'queued');
    const decision = String(form.get('decision'));
    const location = String(form.get('location') ?? '').trim(), comment = String(form.get('comment') ?? '').trim(), internal = String(form.get('internal_note') ?? '').trim();
    if (!r || !['changes_requested', 'reviewed'].includes(decision) || location.length > 200 || comment.length > 4000 || internal.length > 4000) throw new Error('invalid_state');
    if (decision === 'changes_requested' && (!location || !comment)) throw new Error('feedback_required');
    Object.assign(r, { status: decision, location, comment, internal_note: internal }); d.review_status = decision;
  } else if (command === 'activity') {
    const date = String(form.get('performed_on')), note = String(form.get('note') ?? '').trim();
    const { z } = await import('zod');
    const { seoulDate } = await import('@/domain/tasks');
    if (!z.iso.date().safeParse(date).success || date > seoulDate() || !note || note.length > 2000) throw new Error('future_activity');
    const corrects = String(form.get('corrects') ?? '') || null;
    if (corrects && !d.activities.some(a => a.id === corrects)) throw new Error('invalid_state');
    d.activities.push({ id: crypto.randomUUID(), performed_on: date, note, corrects_id: corrects });
  } else throw new Error('invalid_state');
  d.revision++;
}
