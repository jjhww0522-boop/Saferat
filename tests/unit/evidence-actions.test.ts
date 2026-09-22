import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), member: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/supabase', () => ({ memberClient: mocks.member }));
import { retryEvidenceVersion } from '@/server/evidence-actions';
const id = '11111111-1111-4111-8111-111111111111', next = '22222222-2222-4222-8222-222222222222';
const previous = { ok: false, message: '' };
function form() { const data = new FormData(); data.set('confirm_file_retry', 'on'); data.set('recovery_revision', '2'); return data; }
beforeEach(() => { vi.clearAllMocks(); mocks.member.mockResolvedValue({ client: { rpc: mocks.rpc } }); mocks.rpc.mockResolvedValue({ data: { document_id: id, version_id: next }, error: null }); });
describe('증빙 재시도 새 버전 서버 경계', () => {
  it('명시적 확인과 revision을 요구하며 클라이언트 본문·상태는 DB로 전달하지 않는다', async () => {
    const missing = form(); missing.delete('confirm_file_retry');
    expect((await retryEvidenceVersion(id, previous, missing)).ok).toBe(false);
    missing.set('confirm_file_retry', 'on'); missing.delete('recovery_revision');
    expect((await retryEvidenceVersion(id, previous, missing)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const valid = form(); valid.set('content', '변조 본문'); valid.set('state', 'clean');
    expect(await retryEvidenceVersion(id, previous, valid)).toMatchObject({ ok: true, redirectTo: `/workspace/documents/${id}?version=${next}#evidence-records` });
    expect(mocks.member).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('safety_retry_evidence_version', { source_version: id, expected_revision: 2 });
  });
  it('실패·권한·충돌·복구불가 응답에 성공 이동을 만들지 않는다', async () => {
    for (const message of ['access_denied', 'revision_conflict', 'file_retry_unavailable']) {
      mocks.rpc.mockResolvedValue({ error: { message } });
      const result = await retryEvidenceVersion(id, previous, form());
      expect(result.ok).toBe(false); expect(result.redirectTo).toBeUndefined();
    }
    mocks.rpc.mockResolvedValue({ data: { document_id: id }, error: null });
    expect((await retryEvidenceVersion(id, previous, form())).ok).toBe(false);
  });
});
