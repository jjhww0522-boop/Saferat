import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProfile } from '@/domain/workplace-profile';

const mocks = vi.hoisted(() => ({ saveDemo: vi.fn(), rpc: vi.fn(), member: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/supabase', () => ({ memberClient: mocks.member }));
vi.mock('@/server/demo-tasks', () => ({ saveDemoProfile: mocks.saveDemo }));
import { saveProfile } from '@/server/task-actions';

const workplace = 'a6bbf9d1-d1c5-4c82-87f7-85f920630fea';
function form(confirmed = false) {
  const result = new FormData();
  result.set('workplace', workplace); result.set('profile_revision', '2');
  result.set('profile', JSON.stringify({ ...emptyProfile, confirmed_at: '2026-09-15T00:00:00Z', facts: { ...emptyProfile.facts, businessName: '시험 사업장', actualAddress: '가상 현장', actualWork: '시설 점검' } }));
  result.set('intent', confirmed ? 'confirm' : 'draft');
  if (confirmed) result.set('confirmed', 'on');
  return result;
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('APP_MODE', 'demo'); mocks.member.mockResolvedValue({ client: { rpc: mocks.rpc } }); mocks.rpc.mockResolvedValue({ error: null }); });
afterEach(() => vi.unstubAllEnvs());
describe('사업장 정보 저장 서버 경계', () => {
  it('임시 저장은 클라이언트가 보낸 확인 시각을 신뢰하지 않는다', async () => {
    const result = await saveProfile(true, { ok: false, message: '' }, form());
    expect(result.ok).toBe(true); expect(result.redirectTo).toBeUndefined();
    expect(result.savedBasis?.revisions).toEqual({ profile_revision: '3' });
    expect(JSON.parse(result.savedBasis!.key)).toMatchObject({ facts: { businessName: '시험 사업장' } });
    expect(JSON.parse(result.savedBasis!.key)).not.toHaveProperty('confirmed_at');
    expect(mocks.saveDemo).toHaveBeenCalledWith(workplace, expect.objectContaining({ revision: 2, confirmed_at: null, headcount: null }));
  });
  it('확인 체크와 필수 사실이 없으면 확인 저장을 차단한다', async () => {
    const missingCheck = form(true); missingCheck.delete('confirmed');
    expect((await saveProfile(true, { ok: false, message: '' }, missingCheck)).ok).toBe(false);
    const missingFacts = form(true); missingFacts.set('profile', JSON.stringify(emptyProfile));
    expect((await saveProfile(true, { ok: false, message: '' }, missingFacts)).ok).toBe(false);
    expect(mocks.saveDemo).not.toHaveBeenCalled();
  });
  it('인원 부분집합 오류와 잘못된 JSON은 저장되지 않는다', async () => {
    const invalid = form(); invalid.set('profile', JSON.stringify({ ...emptyProfile, headcount: 0, facts: { ...emptyProfile.facts, temporary: 1 } }));
    expect((await saveProfile(true, { ok: false, message: '' }, invalid)).ok).toBe(false);
    invalid.set('profile', '{bad');
    expect((await saveProfile(true, { ok: false, message: '' }, invalid)).ok).toBe(false);
    expect(mocks.saveDemo).not.toHaveBeenCalled();
  });
  it('실제 저장은 사용자 인증과 명시적인 DB 인수만 사용한다', async () => {
    const result = await saveProfile(false, { ok: false, message: '' }, form(true));
    expect(mocks.member).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('safety_save_workplace_profile', {
      workplace, industry: 'all', headcount: null, work: [],
      facts: expect.objectContaining({ businessName: '시험 사업장', contractors: null }), expected_revision: 2, confirmed: true,
    });
    expect(result.redirectTo).toBe(`/workspace?workplace=${workplace}`);
    expect(result.savedBasis?.revisions).toEqual({ profile_revision: '3' });
  });
  it('DB 충돌을 성공이나 목록 이동으로 바꾸지 않는다', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'revision_conflict' } });
    const result = await saveProfile(false, { ok: false, message: '' }, form(true));
    expect(result.ok).toBe(false); expect(result.redirectTo).toBeUndefined();
    expect(result.savedBasis).toBeUndefined();
    expect(result.message).toContain('다른 변경');
  });
});
