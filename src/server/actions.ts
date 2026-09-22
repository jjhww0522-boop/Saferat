'use server';

import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { applyCommand, WorkflowError } from '@/domain/workflow';
import { requireDemoConfig } from '@/domain/config';
import { context, newSession, requireWorkplace } from './store';
import type { ActionResult, Fact } from '@/domain/types';

const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 86400 };
export async function startDemo() {
  requireDemoConfig(process.env);
  const jar = await cookies();
  jar.set('safety-demo', newSession(), cookieOptions);
  jar.delete('safety-persona');
  jar.set('safety-workplace', 'facility', cookieOptions);
  redirect('/app');
}
export async function selectWorkplace(form: FormData) {
  const ctx = await context();
  const id = String(form.get('workplace'));
  if (!ctx.workplaces.some(w => w.id === id)) throw new Error('현장 접근 불가');
  (await cookies()).set('safety-workplace', id, cookieOptions);
  redirect(ctx.actor.tenantId ? '/app' : '/ops');
}

const text = z.string().trim().max(2000, '입력은 2,000자 이내로 작성해주세요.');
const fieldsSchema = z.object({ location: text, observation: text, owner: text, schedule: text, budget: text });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜를 입력해주세요.').refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, '올바른 날짜를 입력해주세요.');
function resultError(error: unknown): ActionResult {
  unstable_rethrow(error);
  return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : error instanceof WorkflowError ? error.message : '저장하지 못했습니다. 입력 내용을 유지한 채 다시 시도해주세요.' };
}

export async function updateObligation(id: string, _previous: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { state, actor } = await context();
    const revision = z.coerce.number().int().positive().parse(form.get('revision'));
    const type = form.get('command');
    if (type === 'document') {
      const kind = z.enum(['sample', 'draft']).parse(form.get('kind'));
      const fields = fieldsSchema.parse(Object.fromEntries(['location', 'observation', 'owner', 'schedule', 'budget'].map(k => [k, String(form.get(k) ?? '')])));
      applyCommand(state, actor, id, revision, { type, kind, fields });
    } else if (type === 'confirm' || type === 'submit') {
      applyCommand(state, actor, id, revision, { type, versionId: z.string().uuid().parse(form.get('versionId')) });
    } else if (type === 'activity') {
      const performedAt = date.parse(form.get('date'));
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
      if (performedAt > today) throw new WorkflowError('실제 수행 기록에는 미래 날짜를 입력할 수 없습니다.');
      const note = text.min(1, '직접 확인한 수행 내용을 입력해주세요.').parse(form.get('note'));
      applyCommand(state, actor, id, revision, { type, date: performedAt, note });
    } else if (type === 'review') {
      const parsed = z.object({ reviewId: z.string().uuid(), decision: z.enum(['changes_requested', 'reviewed']), comment: text.min(1, '검토 범위와 의견을 입력해주세요.'), internalNote: text, location: text.min(1, '검토한 항목 또는 자료 위치를 입력해주세요.') }).parse(Object.fromEntries(form));
      applyCommand(state, actor, id, revision, { type, ...parsed });
    } else throw new WorkflowError('지원하지 않는 작업입니다.');
    revalidatePath('/', 'layout');
    return { ok: true, message: '저장했습니다. 아래에서 현재 상태와 이력을 확인하세요.' };
  } catch (error) { return resultError(error); }
}

const count = z.preprocess(v => v === '' || v === null ? null : Number(v), z.number().int().min(0).max(10000000).nullable());
const optionalDate = z.union([z.literal(''), date]);
const factSchema = z.object({
  name: z.string().trim().min(1, '가상 사업장 이름을 입력해주세요.').max(100),
  industry: text, registrationItems: text, registeredAddress: text, address: text,
  openingDate: optionalDate, issueDate: optionalDate, headcount: count, temporary: count, contractors: count,
  countDate: optionalDate, work: text, role: text,
  photoCheck: z.enum(['true', 'false', 'unknown']), training: z.enum(['true', 'false', 'unknown']), contractor: z.enum(['true', 'false', 'unknown']),
});
export async function saveWorkplace(id: string, _previous: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await context();
    const workplace = requireWorkplace(ctx, id);
    const expected = z.coerce.number().int().positive().parse(form.get('revision'));
    if (workplace.revision !== expected) throw new WorkflowError('다른 화면에서 정보가 바뀌었습니다. 새로고침 후 다시 확인해주세요.');
    const parsed = factSchema.parse(Object.fromEntries(form));
    const confirmed = form.get('confirmed') === 'on';
    const now = new Date().toISOString();
    const facts: Record<string, Fact> = {};
    for (const [key, raw] of Object.entries(parsed)) {
      const value = ['photoCheck', 'training', 'contractor'].includes(key) ? raw === 'unknown' ? null : raw === 'true' : raw === '' ? null : raw;
      facts[key] = { value, confirmed: confirmed && value !== null, source: 'user' };
    }
    const snapshot = { id: crypto.randomUUID(), recordedAt: now, confirmedAt: confirmed ? now : null, facts };
    ctx.state.snapshots.push(snapshot); workplace.snapshotIds.push(snapshot.id); workplace.revision += 1;
    workplace.name = parsed.name; workplace.industry = parsed.industry; workplace.headcount = parsed.headcount;
    revalidatePath('/', 'layout');
    return { ok: true, message: confirmed ? '사업장 정보를 확인했습니다. 할 일 목록에서 결과와 추가 질문을 확인하세요.' : '임시 저장했습니다. 입력한 정보를 확인하면 체험 규칙을 다시 평가합니다.' };
  } catch (error) { return resultError(error); }
}
