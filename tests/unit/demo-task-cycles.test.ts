import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeed, actorFor } from '@/demo/seed';
import { emptyProfile } from '@/domain/workplace-profile';
import { taskRecordSchema } from '@/domain/tasks';
const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/store', () => ({ context: mocks.context }));
import { startDemoTask, startNextDemoTaskCycle, demoTaskEntry, saveDemoTask, saveDemoProfile, updateDemoTaskDocument } from '@/server/demo-tasks';

let ctx: { state: ReturnType<typeof createSeed>; actor: ReturnType<typeof actorFor>; workplaces: ReturnType<typeof createSeed>['workplaces']; workplace: ReturnType<typeof createSeed>['workplaces'][number] };
beforeEach(async () => {
  const state = createSeed(), workplaces = state.workplaces.filter(w => w.tenantId === 'tenant-a');
  ctx = { state, actor: actorFor('member-a'), workplaces, workplace: workplaces[0] };
  mocks.context.mockImplementation(async () => ctx);
  await saveDemoProfile(ctx.workplace.id, { ...emptyProfile, facts: { ...emptyProfile.facts, businessName: '시험', actualAddress: '시험 장소', actualWork: '시험 작업' }, confirmed_at: '2026-09-21T00:00:00Z' });
});
async function savedTask() {
  const task = await startDemoTask(ctx.workplace.id, 'REVIEW-003');
  await saveDemoTask(task, { expected_revision: 1, document_revision: null, owner: '이전 담당', target_date: '2026-09-01' }, '이전 원본');
  return task;
}
describe('데모 새 회차 보존', () => {
  it('검토 대기 기록은 그대로 두고 새 회차에는 출처와 분류 외 사실을 복사하지 않는다', async () => {
    const task = await savedTask();
    const form = new FormData(); form.set('command', 'confirm'); form.set('revision', '1');
    await updateDemoTaskDocument(task, form);
    form.set('command', 'submit'); form.set('revision', '2'); await updateDemoTaskDocument(task, form);
    const old = structuredClone((await demoTaskEntry(task)).entry);
    const [next, duplicate] = await Promise.all([startNextDemoTaskCycle(task, 2), startNextDemoTaskCycle(task, 2)]);
    expect(next).toBe(duplicate);
    expect((await demoTaskEntry(task)).entry).toEqual(old);
    expect((await demoTaskEntry(next)).entry).toMatchObject({ task: { document_id: null, owner: '', target_date: null, revision: 1, review_status: 'not_requested', cycle_number: 2, previous_task_id: task }, document: null, history: [] });
    expect(await startDemoTask(ctx.workplace.id, 'REVIEW-003')).toBe(next);
  });
  it('이전 수정은 새 버전으로 보존하며 다음회차 반복 요청은 revision을 확인한다', async () => {
    const task = await savedTask(), next = await startNextDemoTaskCycle(task, 2);
    await saveDemoTask(task, { expected_revision: 2, document_revision: 1, owner: '', target_date: null }, '이전 회차 보완');
    await expect(startNextDemoTaskCycle(task, 2)).rejects.toThrow('revision_conflict');
    expect(await startNextDemoTaskCycle(task, 3)).toBe(next);
    expect((await demoTaskEntry(task)).entry.document?.versions.map(v => v.content)).toEqual(['이전 회차 보완', '이전 원본']);
    await saveDemoTask(next, { expected_revision: 1, document_revision: null, owner: '', target_date: null }, '새 회차 수행');
    const third = await startNextDemoTaskCycle(next, 2);
    expect((await demoTaskEntry(third)).entry.task.cycle_number).toBe(3);
    expect(await startDemoTask(ctx.workplace.id, 'REVIEW-003')).toBe(third);
    expect(await startNextDemoTaskCycle(task, 3)).toBe(next);
  });
  it('빈 회차·지원하지 않는 업무·다른 고객·검토자는 생성하지 못한다', async () => {
    const empty = await startDemoTask(ctx.workplace.id, 'REVIEW-003');
    await expect(startNextDemoTaskCycle(empty, 1)).rejects.toThrow('cycle_record_required');
    const photo = await startDemoTask(ctx.workplace.id, 'FORM_PHOTO');
    await expect(startNextDemoTaskCycle(photo, 1)).rejects.toThrow('invalid_state');
    const task = await savedTask();
    ctx = { ...ctx, actor: actorFor('reviewer') };
    await expect(startNextDemoTaskCycle(task, 2)).rejects.toThrow('access_denied');
    ctx = { ...ctx, actor: actorFor('member-b'), workplaces: ctx.state.workplaces.filter(w => w.tenantId === 'tenant-b') };
    await expect(startNextDemoTaskCycle(task, 2)).rejects.toThrow('access_denied');
  });
  it('이전 저장소 응답에는 1회차 기본값을 적용한다', async () => {
    const task = (await demoTaskEntry(await savedTask())).entry.task;
    const legacy = { ...task }; delete legacy.cycle_number; delete legacy.previous_task_id;
    expect(taskRecordSchema.parse(legacy)).toMatchObject({ cycle_number: 1, previous_task_id: null });
    expect(taskRecordSchema.safeParse({ ...task, cycle_number: 0 }).success).toBe(false);
  });
});
