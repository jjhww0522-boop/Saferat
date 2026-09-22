import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ next: vi.fn(), rpc: vi.fn(), member: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/supabase', () => ({ memberClient: mocks.member }));
vi.mock('@/server/demo-tasks', () => ({ startNextDemoTaskCycle: mocks.next }));
import { startNextTaskCycle } from '@/server/task-actions';

const id = '11111111-1111-4111-8111-111111111111', next = '22222222-2222-4222-8222-222222222222';
const previous = { ok: false, message: '' };
function form() { const data = new FormData(); data.set('confirm_new_cycle', 'on'); data.set('cycle_revision', '2'); return data; }
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('APP_MODE', 'demo'); mocks.member.mockResolvedValue({ client: { rpc: mocks.rpc } }); mocks.rpc.mockResolvedValue({ data: next, error: null }); mocks.next.mockResolvedValue(next); });
afterEach(() => vi.unstubAllEnvs());
describe('새 회차 생성 서버 동작', () => {
  it('체크와 revision이 유효해야 생성하며 브라우저의 이전 사실을 전달하지 않는다', async () => {
    const missing = form(); missing.delete('confirm_new_cycle');
    expect((await startNextTaskCycle(false, id, previous, missing)).ok).toBe(false);
    const invalid = form(); invalid.set('cycle_revision', '0');
    expect((await startNextTaskCycle(false, id, previous, invalid)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const valid = form(); valid.set('owner', '복사 금지'); valid.set('content', '복사 금지');
    const result = await startNextTaskCycle(false, id, previous, valid);
    expect(mocks.member).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('safety_start_next_task_cycle', { task: id, expected_revision: 2 });
    expect(result).toMatchObject({ ok: true, redirectTo: `/workspace/tasks/${next}` });
  });
  it('데모는 데모 설정에서만 생성하고 실제 모드에서는 데모 쓰기를 거부한다', async () => {
    expect(await startNextTaskCycle(true, id, previous, form())).toMatchObject({ ok: true, redirectTo: `/app/tasks/${next}` });
    expect(mocks.next).toHaveBeenCalledWith(id, 2);
    mocks.next.mockClear(); vi.stubEnv('APP_MODE', 'live');
    expect((await startNextTaskCycle(true, id, previous, form())).ok).toBe(false);
    expect(mocks.next).not.toHaveBeenCalled();
  });
  it('충돌·권한·기록없음 오류를 성공이나 이동으로 바꾸지 않는다', async () => {
    for (const message of ['revision_conflict', 'access_denied', 'cycle_record_required']) {
      mocks.rpc.mockResolvedValue({ error: { message } });
      const result = await startNextTaskCycle(false, id, previous, form());
      expect(result.ok).toBe(false); expect(result.redirectTo).toBeUndefined();
      if (message === 'cycle_record_required') expect(result.message).toContain('먼저 저장');
    }
  });
});
