import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readTaskForm, taskAnswerQuestions, taskDefinition } from '@/domain/tasks';

const mocks = vi.hoisted(() => ({ entry: vi.fn(), saveDemo: vi.fn(), member: vi.fn(), rpc: vi.fn(), task: vi.fn(), detail: vi.fn(), readVersion: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/supabase', () => ({ memberClient: mocks.member }));
vi.mock('@/server/demo-tasks', () => ({ demoTaskEntry: mocks.entry, saveDemoTask: mocks.saveDemo }));
vi.mock('@/adapters/workspace', () => ({ workspaceRepository: () => ({ task: mocks.task, detail: mocks.detail, readVersion: mocks.readVersion }) }));
import { saveTask } from '@/server/task-actions';

const id = '11111111-1111-4111-8111-111111111111', definition = taskDefinition('FORM_PHOTO')!;
const previous = { ok: false, message: '' };
function form(notes: string, documentRevision = '') {
  const data = new FormData();
  data.set('task_revision', '3'); data.set('document_revision', documentRevision);
  data.set('owner', ' 담당자 '); data.set('target_date', '2026-10-01'); data.set('notes', notes);
  data.set('questions_context', JSON.stringify(taskAnswerQuestions(definition, null)));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('APP_MODE', 'demo');
  mocks.entry.mockResolvedValue({ entry: { task: { definition_id: definition.id }, document: null } });
  mocks.member.mockResolvedValue({ client: { rpc: mocks.rpc } }); mocks.rpc.mockResolvedValue({ error: null });
  mocks.task.mockResolvedValue({ definition_id: definition.id, document_id: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('저장 성공 응답은 실제 저장한 입력과 정확한 revision을 결합한다', () => {
  it.each([true, false])('새 본문은 첫 문서 기준을 반환한다 (demo=%s)', async demo => {
    // A caller-supplied document revision cannot invent a pre-existing document.
    const data = form(' 새 관찰 ', '99'), content = readTaskForm(definition, data);
    const result = await saveTask(demo, id, previous, data);
    expect(result).toMatchObject({ ok: true, savedBasis: { key: JSON.stringify(['담당자', '2026-10-01', content]), revisions: { task_revision: '4', document_revision: '1' } } });
  });
  it.each([true, false])('문서 없는 담당·목표일 저장은 문서 revision을 만들지 않는다 (demo=%s)', async demo => {
    expect(await saveTask(demo, id, previous, form(''))).toMatchObject({ ok: true, savedBasis: { revisions: { task_revision: '4', document_revision: '' } } });
  });
  it.each([true, false])('메타 revision이 증가한 기존 본문은 보존하고 새 본문만 문서 기준을 증가시킨다 (demo=%s)', async demo => {
    const content = readTaskForm(definition, form('이전 관찰'));
    mocks.entry.mockResolvedValue({ entry: { task: { definition_id: definition.id }, document: { versions: [{ content }] } } });
    mocks.task.mockResolvedValue({ definition_id: definition.id, document_id: 'doc' });
    mocks.detail.mockResolvedValue({ versions: [{ id: 'version' }] }); mocks.readVersion.mockResolvedValue({ content });
    expect(await saveTask(demo, id, previous, form('이전 관찰', '7'))).toMatchObject({ ok: true, savedBasis: { revisions: { task_revision: '4', document_revision: '7' } } });
    expect(await saveTask(demo, id, previous, form('보완한 관찰', '7'))).toMatchObject({ ok: true, savedBasis: { revisions: { task_revision: '4', document_revision: '8' } } });
    // There is no post-save reread that could adopt a concurrent writer's newer state.
    if (!demo) { expect(mocks.task).toHaveBeenCalledTimes(2); expect(mocks.readVersion).toHaveBeenCalledTimes(2); }
  });
  it('권한·revision 충돌은 새 입력 기준을 반환하지 않는다', async () => {
    for (const message of ['access_denied', 'revision_conflict']) {
      mocks.rpc.mockResolvedValue({ error: { message } });
      expect(await saveTask(false, id, previous, form('관찰'))).toMatchObject({ ok: false });
      expect((await saveTask(false, id, previous, form('관찰'))).savedBasis).toBeUndefined();
    }
  });
});
