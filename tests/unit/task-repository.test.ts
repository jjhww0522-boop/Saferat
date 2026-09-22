import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { workspaceRepository } from '@/adapters/workspace';
const id = '11111111-1111-4111-8111-111111111111';
const workplace = '22222222-2222-4222-8222-222222222222';
const row = { id, workplace_id: workplace, definition_id: 'FORM_PHOTO', definition_version: '1', title: '사진 점검', category: 'inspection', document_id: null, sensitive: false, owner: '', target_date: null, revision: 1, safety_documents: null };
describe('업무 저장소 HTTP 연결 계약', () => {
  it('홈 요약은 일괄 RPC 한 번으로 읽고 본문·내부 의견을 제거한다', async () => {
    const requests: { url: string; body: string }[] = [];
    const client = createClient('http://127.0.0.1:59999', 'test-publishable', { auth: { persistSession: false }, global: { fetch: async (input, init) => {
      requests.push({ url: String(input), body: String(init?.body) });
      return new Response(JSON.stringify([{ task_id: id, version: 1, confirmed_at: null, risk: { state: 'available', improvement_count: 1, next_due_on: '2026-09-17', content: 'PRIVATE' }, internal_note: 'PRIVATE' }]), { headers: { 'Content-Type': 'application/json' } });
    } } });
    const result = await workspaceRepository(client).taskActionSources(workplace);
    expect(requests).toEqual([{ url: 'http://127.0.0.1:59999/rest/v1/rpc/safety_task_action_sources', body: JSON.stringify({ workplace }) }]);
    expect(result).toEqual([{ task_id: id, version: 1, confirmed_at: null, risk: { state: 'available', improvement_count: 1, next_due_on: '2026-09-17' } }]);
  });
  it('홈 요약의 잘못된 응답을 정상·빈 위험정보로 바꾸지 않는다', async () => {
    const client = createClient('http://127.0.0.1:59999', 'test-publishable', { auth: { persistSession: false }, global: { fetch: async () => new Response('[{"task_id":"task","version":1,"confirmed_at":null,"risk":{"state":"available","improvement_count":-1,"next_due_on":null}}]', { headers: { 'Content-Type': 'application/json' } }) } });
    await expect(workspaceRepository(client).taskActionSources(workplace)).rejects.toThrow();
  });
  it('현장 조건을 요청하고 연결 문서의 상태를 투영한다', async () => {
    const urls: URL[] = [];
    const client = createClient('http://127.0.0.1:59999', 'test-publishable', { auth: { persistSession: false }, global: { fetch: async input => {
      urls.push(new URL(String(input)));
      return new Response(JSON.stringify([{ ...row, safety_documents: { review_status: 'queued' }, internal_note: 'NEVER_INCLUDE' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } } });
    const records = await workspaceRepository(client).tasks(workplace);
    expect(urls[0].searchParams.get('workplace_id')).toBe(`eq.${workplace}`);
    expect(records[0].review_status).toBe('queued');
    expect(records[0]).not.toHaveProperty('internal_note');
    expect(records[0]).not.toHaveProperty('safety_documents');
  });
  it('원격 오류를 빈 정상 목록으로 바꾸지 않는다', async () => {
    const client = createClient('http://127.0.0.1:59999', 'test-publishable', { auth: { persistSession: false }, global: { fetch: async () => new Response(JSON.stringify({ message: 'access denied', code: '42501' }), { status: 403, headers: { 'Content-Type': 'application/json' } }) } });
    await expect(workspaceRepository(client).tasks(workplace)).rejects.toMatchObject({ code: '42501' });
  });
  it('검토 대기·현장·제목·페이지 조건을 DB의 검색 RPC에 전달한다', async () => {
    let request: { url: string; body: unknown } | undefined;
    const client = createClient('http://127.0.0.1:59999', 'test-publishable', { auth: { persistSession: false }, global: { fetch: async (input, init) => {
      request = { url: String(input), body: JSON.parse(String(init?.body)) };
      return new Response('{"items":[],"total":0,"page":1,"pageSize":25}', { headers: { 'Content-Type': 'application/json' } });
    } } });
    await workspaceRepository(client).documentPage({ workplace, query: ' 현장 점검 ', status: 'queued', view: 'reviews', page: 5 });
    expect(request).toEqual({ url: 'http://127.0.0.1:59999/rest/v1/rpc/safety_document_search', body: { workplace_filter: workplace, title_query: '현장 점검', status_filter: 'queued', list_view: 'reviews', page_number: 5 } });
  });
});
