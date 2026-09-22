import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { inspectUpload, isSameOrigin, maxFileBytes, readUploadBody, unavailableFileInspector } from '@/domain/files';
import { readConfig, readSupabaseConfig, requireDemoConfig } from '@/domain/config';
import { workspaceRepository } from '@/adapters/workspace';
import { evidenceRepository } from '@/adapters/evidence';

const live = { APP_MODE: 'live', AI_MODE: 'off', OCR_MODE: 'off', SUPABASE_URL: 'https://project.example.test', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const id = '11111111-1111-4111-8111-111111111111';
const pdf = new TextEncoder().encode('%PDF-1.7\nbody\n%%EOF');
const file = { id, version_id: id, document_id: id, object_path: `organization/site/document/version/${id}`, state: 'reserved', ...inspectUpload(pdf, '현장.pdf', 'application/pdf') };
function clientFor(fetcher: typeof fetch) {
  return createClient(live.SUPABASE_URL, live.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetcher } });
}
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }

describe('P2 모드·키 경계', () => {
  it('필수 실제 설정이 있을 때만 live를 허용하고 데모 진입은 차단한다', () => {
    expect(readConfig(live)).toEqual({ app: 'live', ai: 'off', ocr: 'off' });
    expect(() => requireDemoConfig(live)).toThrow();
    expect(() => readSupabaseConfig({ ...live, APP_MODE: 'demo' })).toThrow();
  });
  it.each([
    { SUPABASE_PUBLISHABLE_KEY: undefined }, { SUPABASE_URL: undefined }, { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' },
    { SUPABASE_PUBLISHABLE_KEY: 'eyJ_service_role_or_legacy' }, { SUPABASE_URL: 'http://external.example.test' },
    { SUPABASE_URL: 'https://user:password@example.test' }, { AI_MODE: 'mock' }, { OCR_MODE: 'live' },
  ])('설정 누락·관리자 키·비보안 원격 URL·mock 혼용 거부 %j', override => expect(() => readConfig({ ...live, ...override })).toThrow());
});
describe('파일 사전검사와 격리', () => {
  it('내부 서버 주소와 공개 Host가 달라도 같은 출처를 인식하며 다른 출처를 차단한다', () => {
    const request = (origin: string) => new Request('http://localhost:3013/api/files', { headers: { host: '127.0.0.1:3013', origin, 'x-forwarded-proto': 'http' } });
    expect(isSameOrigin(request('http://127.0.0.1:3013'))).toBe(true);
    expect(isSameOrigin(request('https://untrusted.example.test'))).toBe(false);
    expect(isSameOrigin(request('null'))).toBe(false);
    expect(isSameOrigin(new Request('http://localhost:3013/api/files'))).toBe(false);
  });
  it('바이트·확장자·MIME이 일치할 때 해시를 계산하되 검사 완료로 표시하지 않는다', async () => {
    expect(inspectUpload(pdf, '현장.pdf', 'application/pdf')).toMatchObject({ byte_size: pdf.length, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(await unavailableFileInspector.inspect({ bytes: pdf, mimeType: 'application/pdf', expectedSha256: file.sha256 })).toMatchObject({ verdict: 'unavailable', scannerVersion: null });
  });
  it.each([
    [new Uint8Array(), 'empty.pdf', 'application/pdf'], [pdf, '../현장.pdf', 'application/pdf'],
    [pdf, '현장.png', 'image/png'], [new TextEncoder().encode('<script>fake</script>'), 'file.pdf', 'application/pdf'],
    [pdf, '현장.pdf', 'text/html'], [new Uint8Array(maxFileBytes + 1), 'huge.pdf', 'application/pdf'],
  ])('빈 파일·경로·위장 형식·초과 크기를 거부한다', (bytes, name, type) => expect(() => inspectUpload(bytes as Uint8Array, name as string, type as string)).toThrow());
  it('Content-Length가 없거나 거짓으로 작아도 실제 스트림 크기를 제한한다', async () => {
    const request = new Request('https://example.test', { method: 'POST', headers: { 'Content-Length': '1' }, body: new Uint8Array(maxFileBytes + 1) });
    await expect(readUploadBody(request)).rejects.toThrow('10MB');
  });
  it('크기 제한 이내의 바이트를 변조 없이 읽는다', async () => {
    const bytes = await readUploadBody(new Request('https://example.test', { method: 'POST', body: pdf }));
    expect([...bytes]).toEqual([...pdf]);
  });
});
describe('실제 Supabase SDK의 HTTP 연결 계약', () => {
  it('권한 오류를 빈 목록이나 성공으로 바꾸지 않는다', async () => {
    const client = clientFor(async () => json({ code: '42501', message: 'access_denied' }, 403));
    await expect(workspaceRepository(client).documentPage()).rejects.toMatchObject({ message: 'access_denied' });
  });
  it('원본 본문을 감사 RPC로 읽고 잘못된 응답을 거부한다', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ id, document_id: id, number: 1, content: '원본', created_at: '2026-09-15', confirmed_at: null }));
    expect((await workspaceRepository(clientFor(fetcher)).readVersion(id)).content).toBe('원본');
    expect(String(fetcher.mock.calls[0][0])).toContain('/rest/v1/rpc/safety_read_version');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ version: id });
    await expect(workspaceRepository(clientFor(async () => json({ content: 'missing identifiers' }))).readVersion(id)).rejects.toThrow();
  });
  it('업로드 실패를 기록하고 기존 원본을 덮어쓰지 않는다', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = clientFor(async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('safety_reserve_file')) return json(file);
      if (String(url).includes('/storage/v1/')) return json({ message: 'Storage unavailable', statusCode: '503', error: 'unavailable' }, 503);
      return json(null);
    });
    await expect(evidenceRepository(client).upload(id, pdf, '현장.pdf', 'application/pdf')).rejects.toBeDefined();
    const storageCall = calls.find(c => c.url.includes('/storage/v1/'))!;
    expect(new Headers(storageCall.init?.headers).get('x-upsert')).toBe('false');
    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({ file: id, succeeded: false });
  });
  it('다운로드 대기 중 권한이 철회되면 파일 바이트를 반환하지 않는다', async () => {
    const client = clientFor(async url => {
      if (String(url).includes('safety_prepare_download')) return json({ ...file, state: 'clean' });
      if (String(url).includes('/storage/v1/')) return new Response(pdf);
      return json({ read: false, write: false, review: false });
    });
    await expect(evidenceRepository(client).download(id)).rejects.toThrow('access_denied');
  });
  it('승인된 원본과 다운로드 바이트의 해시가 다르면 거부한다', async () => {
    const client = clientFor(async url => {
      if (String(url).includes('safety_prepare_download')) return json({ ...file, sha256: 'b'.repeat(64), state: 'clean' });
      if (String(url).includes('/storage/v1/')) return new Response(pdf);
      return json({ read: true, write: true, review: false });
    });
    await expect(evidenceRepository(client).download(id)).rejects.toThrow('file_integrity');
  });
});
