'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { memberClient } from './supabase';
import { workspaceRepository } from '@/adapters/workspace';
import { taskDefinition, readTaskForm, taskMetadataInput, profileInput } from '@/domain/tasks';
import { uuid, workspaceError, type WorkspaceResult } from '@/domain/workspace';
import { startDemoTask, startNextDemoTaskCycle, demoTaskEntry, saveDemoTask, saveDemoProfile, updateDemoTaskDocument } from './demo-tasks';
import { requireDemoConfig } from '@/domain/config';
import { canConfirmProfile } from '@/domain/workplace-profile';
import { RiskInputError } from '@/domain/risk-assessment';

function refresh() { revalidatePath('/workspace', 'layout'); revalidatePath('/app', 'layout'); revalidatePath('/ops', 'layout'); }
export async function startTask(demo: boolean, _previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const definition = String(form.get('definition')), workplace = String(form.get('workplace'));
    if (!taskDefinition(definition)) throw new Error('invalid_state');
    let id: string;
    if (demo) { requireDemoConfig(process.env); id = await startDemoTask(workplace, definition); }
    else { const { client } = await memberClient(); const result = await client.rpc('safety_start_task', { workplace: uuid.parse(workplace), definition, sensitive: form.get('sensitive') === 'on' }); if (result.error) throw result.error; id = uuid.parse(result.data); }
    refresh();
    const base = demo ? '/app' : '/workspace', back = String(form.get('return') ?? '');
    const suffix = back.startsWith(`${base}?`) || back === `${base}/map` || back.startsWith(`${base}/map?`) ? `?return=${encodeURIComponent(back)}` : '';
    return { ok: true, message: '관리 업무에 추가했습니다. 적용 여부는 확인이 필요합니다.', redirectTo: `${base}/tasks/${id}${suffix}` };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function saveTask(demo: boolean, id: string, _previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const input = taskMetadataInput.parse({ owner: form.get('owner') ?? '', target_date: form.get('target_date') || null, expected_revision: form.get('task_revision'), document_revision: form.get('document_revision') || null });
    let content: string | null, previousContent: string | undefined, hadDocument: boolean;
    if (demo) {
      requireDemoConfig(process.env);
      const { entry } = await demoTaskEntry(id, true);
      const definition = taskDefinition(entry.task.definition_id)!;
      hadDocument = !!entry.document;
      previousContent = entry.document?.versions[0]?.content;
      content = readTaskForm(definition, form, previousContent, true);
      if (entry.document && !content) throw new Error('empty_record');
      await saveDemoTask(id, input, content);
    } else {
      const { client } = await memberClient();
      const repo = workspaceRepository(client);
      const task = await repo.task(id);
      const definition = task && taskDefinition(task.definition_id);
      if (!definition) throw new Error('access_denied');
      hadDocument = !!task.document_id;
      const detail = task.document_id ? await repo.detail(task.document_id) : null;
      const previous = detail?.versions[0] ? await repo.readVersion(detail.versions[0].id) : null;
      previousContent = previous?.content;
      content = readTaskForm(definition, form, previousContent, true);
      if (task?.document_id && !content) throw new Error('empty_record');
      const { error } = await client.rpc('safety_save_task', { task: uuid.parse(id), ...input, content });
      if (error) throw error;
    }
    // A successful atomic save advances the task once and the document only for
    // a new body. Do not reread "latest": another writer may already have saved.
    const documentRevision = content ? !hadDocument ? 1 : input.document_revision! + (content === previousContent ? 0 : 1) : null;
    refresh(); return { ok: true, message: '기록을 저장했습니다. 실제 수행·검토 상태는 별도입니다.', savedBasis: { key: JSON.stringify([input.owner, input.target_date, content]), revisions: { task_revision: String(input.expected_revision + 1), document_revision: documentRevision === null ? '' : String(documentRevision) } } };
  } catch (error) { return error instanceof RiskInputError ? { ok: false, message: error.issue.message, riskIssue: error.issue } : { ok: false, message: workspaceError(error) }; }
}
export async function startNextTaskCycle(demo: boolean, id: string, _previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    if (form.get('confirm_new_cycle') !== 'on') return { ok: false, message: '이전 회차의 수정이 아닌 새로운 평가 회차를 시작하는지 확인해주세요.' };
    const revision = z.coerce.number().int().positive().parse(form.get('cycle_revision'));
    let next: string;
    if (demo) { requireDemoConfig(process.env); next = await startNextDemoTaskCycle(id, revision); }
    else {
      const { client } = await memberClient();
      const result = await client.rpc('safety_start_next_task_cycle', { task: uuid.parse(id), expected_revision: revision });
      if (result.error) throw result.error;
      next = uuid.parse(result.data);
    }
    refresh();
    return { ok: true, message: '새 평가 회차를 열었습니다. 이전 기록은 보존되며 수행 내용은 새로 입력해주세요.', redirectTo: `${demo ? '/app' : '/workspace'}/tasks/${next}` };
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    return { ok: false, message: message === 'cycle_record_required' ? '현재 회차의 기록을 먼저 저장한 뒤 새로운 평가 회차를 시작해주세요.' : workspaceError(error) };
  }
}
export async function saveProfile(demo: boolean, _previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const workplace = String(form.get('workplace'));
    const serialized = String(form.get('profile') ?? '');
    if (serialized.length > 20000) throw new Error('record_too_long');
    const input = profileInput.parse(JSON.parse(serialized));
    const revision = z.coerce.number().int().nonnegative().parse(form.get('profile_revision'));
    const confirmed = form.get('intent') === 'confirm';
    if (confirmed && (form.get('confirmed') !== 'on' || !canConfirmProfile(input))) throw new Error('profile_incomplete');
    if (demo) { requireDemoConfig(process.env); await saveDemoProfile(workplace, { ...input, revision, confirmed_at: confirmed ? new Date().toISOString() : null }); }
    else { const { client } = await memberClient(); const { error } = await client.rpc('safety_save_workplace_profile', { workplace: uuid.parse(workplace), industry: input.industry, headcount: input.headcount, work: input.work, facts: input.facts, expected_revision: revision, confirmed }); if (error) throw error; }
    refresh();
    return { ok: true, message: confirmed ? '사업장 정보를 확인했습니다. 관련 업무를 확인해주세요.' : '임시 저장했습니다. 입력 확인을 마치면 업무 목록이 열립니다.', savedBasis: { key: JSON.stringify({ industry: input.industry, headcount: input.headcount, work: [...input.work].sort(), facts: input.facts }), revisions: { profile_revision: String(revision + 1) } }, ...(confirmed ? { redirectTo: `${demo ? '/app' : '/workspace'}?workplace=${encodeURIComponent(workplace)}` } : {}) };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function linkTaskDocument(task: string, _previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const { client } = await memberClient();
    const { error } = await client.rpc('safety_link_task_document', { task: uuid.parse(task), document: uuid.parse(form.get('document')), expected_revision: z.coerce.number().int().positive().parse(form.get('task_revision')) });
    if (error) throw error;
    refresh(); return { ok: true, message: '기존 자료와 이력을 연결했습니다.' };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function demoDocumentAction(id: string, _previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try { requireDemoConfig(process.env); await updateDemoTaskDocument(id, form); refresh(); return { ok: true, message: '저장했습니다.' }; }
  catch (error) { return { ok: false, message: workspaceError(error) }; }
}
