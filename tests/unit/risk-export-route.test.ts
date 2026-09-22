import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { emptyRiskAssessment } from '@/domain/risk-assessment';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), demo: vi.fn(), detail: vi.fn(), read: vi.fn(), linked: vi.fn(), task: vi.fn() }));
vi.mock('@/server/supabase', () => ({ authenticatedClient: mocks.auth }));
vi.mock('@/server/demo-tasks', () => ({ demoTaskEntry: mocks.demo }));
vi.mock('@/adapters/workspace', () => ({ workspaceRepository: () => ({ detail: mocks.detail, readVersion: mocks.read, linkedTask: mocks.linked, task: mocks.task }) }));
import { GET } from '@/app/api/documents/[id]/export/route';

const id = 'af3c8399-a60d-4e6c-8525-e6ef91c62b06', versionId = 'bf3c8399-a60d-4e6c-8525-e6ef91c62b06';
const content = JSON.stringify({ format: 'task-record-v1', definition: 'REVIEW-003', notes: '확인 기록', answers: [], fields: {}, risk: emptyRiskAssessment() });
const version = { id: versionId, document_id: id, number: 1, content, created_at: '2026-09-15T00:00:00Z', confirmed_at: null };
function request(format = 'json', selected = versionId, document = id) {
  return GET(new Request(`http://localhost/api/documents/${document}/export?version=${selected}&format=${format}`), { params: Promise.resolve({ id: document }) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('APP_MODE', 'live');
  mocks.auth.mockResolvedValue({ client: {} });
  mocks.detail.mockResolvedValue({ document: { id, title: '시험 평가' }, versions: [version], permissions: { read: true }, reviews: [], activities: [], files: [] });
  mocks.read.mockResolvedValue(version);
  mocks.linked.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());
describe('위험성평가 다운로드 서버 경계', () => {
  it('서버가 확인한 회차 번호를 본문과 파일 이름에 넣는다', async () => {
    mocks.linked.mockResolvedValue('task-cycle-2');
    mocks.task.mockResolvedValue({ id: 'task-cycle-2', definition_id: 'REVIEW-003', cycle_number: 2 });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('cycle2-v1-');
    expect((await response.json()).cycle).toEqual({ taskId: 'task-cycle-2', number: 2 });
  });
  it('인증·소속 버전 확인 후 감사 조회 경로를 사용하고 캐시 없는 사본을 반환한다', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.read).toHaveBeenCalledWith(versionId);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain(`risk-assessment-v1-${versionId}.json`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const body = await response.json();
    expect(body.source).toBe('live');
    expect(body.version.originalContent).toBe(content);
    expect(body.version.contentSha256).toBe(createHash('sha256').update(content).digest('hex'));
    expect(body.version.confirmedAt).toBeNull();
    expect(body.activities).toEqual([]);
    expect(mocks.demo).not.toHaveBeenCalled();
  });
  it.each(['html', 'json'])('%s 형식을 첨부파일로 반환한다', async format => {
    const response = await request(format);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(format === 'html' ? 'text/html' : 'application/json');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(response.headers.get('content-security-policy')).toContain('sandbox');
  });
  it('로그인 실패·타 조직/현장 자료와 읽기 권한 없는 자료는 원문 조회 전에 거부한다', async () => {
    mocks.auth.mockRejectedValueOnce(new Error('authentication_required'));
    expect((await request()).status).toBe(404);
    mocks.detail.mockResolvedValueOnce(null);
    expect((await request()).status).toBe(404);
    mocks.detail.mockResolvedValueOnce({ versions: [version], permissions: { read: false } });
    expect((await request()).status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('다른 문서의 버전 번호를 결합해도 조회할 수 없다', async () => {
    const response = await request('json', 'cf3c8399-a60d-4e6c-8525-e6ef91c62b06');
    expect(response.status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('감사 조회에서 권한이 철회되거나 다른 문서를 반환하면 실패한다', async () => {
    mocks.read.mockRejectedValueOnce(new Error('access_denied'));
    expect((await request()).status).toBe(404);
    mocks.read.mockResolvedValueOnce({ ...version, document_id: 'other' });
    expect((await request()).status).toBe(404);
  });
  it('잘못된 형식과 버전 식별자를 조기에 거부한다', async () => {
    expect((await request('pdf')).status).toBe(400);
    expect((await request('json', '../other')).status).toBe(400);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it('데모도 문서에 속한 저장 버전만 내보내며 실제 연결을 호출하지 않는다', async () => {
    vi.stubEnv('APP_MODE', 'demo');
    mocks.demo.mockResolvedValue({ entry: { task: { id: 'task1', cycle_number: 1 }, document: { id: 'demo-doc-1', title: '데모', versions: [version], reviews: [], activities: [] } } });
    const response = await request('json', versionId, 'demo-doc-1');
    expect(response.status).toBe(200);
    expect((await response.json()).source).toBe('demo');
    expect((await request('json', versionId, 'task-id')).status).toBe(404);
    mocks.demo.mockRejectedValueOnce(new Error('access_denied'));
    expect((await request('json', versionId, 'demo-doc-1')).status).toBe(404);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
});
