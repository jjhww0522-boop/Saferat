import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import type { DocumentPage } from '../../src/domain/document-search';

let db: PGlite;
async function user<T = Record<string, unknown>>(id: string, sql: string, values: unknown[] = [], aal = 'aal1') {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, aal })]);
    return (await tx.query<T>(sql, values)).rows;
  });
}
async function fixture(count = 111) {
  const owner = crypto.randomUUID(), other = crypto.randomUUID(), operator = crypto.randomUUID();
  for (const id of [owner, other, operator]) await db.query('insert into auth.users values($1,$2,now())', [id, `${id}@example.test`]);
  const workplace = (await user<{ id: string }>(owner, "select safety_create_workspace('검색 시험','첫 현장') as id"))[0].id;
  const otherWorkplace = (await user<{ id: string }>(other, "select safety_create_workspace('다른 고객','다른 현장') as id"))[0].id;
  const organization = (await db.query<{ id: string }>('select organization_id as id from safety_workplaces where id=$1', [workplace])).rows[0].id;
  const documents = (await db.query<{ id: string; title: string }>(`insert into safety_documents(organization_id,workplace_id,title,created_by,created_at)
    select $1,$2,'자료 '||lpad(i::text,3,'0'),$3,'2026-01-01'::timestamptz from generate_series(1,$4::integer) i returning id,title`, [organization, workplace, owner, count])).rows;
  await db.query(`insert into safety_document_versions(document_id,organization_id,workplace_id,number,content,created_by)
    select id,organization_id,workplace_id,1,'PRIVATE_ORIGINAL',created_by from safety_documents where workplace_id=$1`, [workplace]);
  await user(other, "select safety_create_document($1,'다른 고객 비공개','PRIVATE_OTHER',false)", [otherWorkplace]);
  const search = async ({ actor = owner, page = 1, place = null, query = '', status = 'all', view = 'documents', aal = 'aal1' }: { actor?: string; page?: number; place?: string | null; query?: string; status?: string; view?: string; aal?: string } = {}) =>
    (await user<{ value: DocumentPage }>(actor, 'select safety_document_search($1,$2,$3,$4,$5) as value', [page, place, query, status, view], aal))[0].value;
  return { owner, other, operator, workplace, otherWorkplace, organization, documents, search };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8'));
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, dir), 'utf8'));
});
afterAll(async () => { await db?.close(); });

describe('자료 검색·검토 대기열의 DB 페이지와 권한', () => {
  it('동일 생성일 111건을 안정된 순서로 모두 찾고 마지막 페이지를 벗어나도 누락하지 않는다', async () => {
    const f = await fixture();
    const pages = [];
    for (let page = 1; page <= 5; page++) pages.push(await f.search({ page }));
    expect(pages.map(page => page.items.length)).toEqual([25,25,25,25,11]);
    expect(pages.every(page => page.total === 111 && page.pageSize === 25)).toBe(true);
    const ids = pages.flatMap(page => page.items.map(item => item.id));
    expect(ids).toEqual(f.documents.map(document => document.id).sort().reverse());
    expect(new Set(ids).size).toBe(111);
    expect((await f.search({ page: 999 })).items).toEqual(pages[4].items);
    expect(JSON.stringify(pages)).not.toContain('PRIVATE');
  });
  it('100건 밖의 오래된 자료를 제목·현장·상태로 검색하고 %도 검색어 그대로 처리한다', async () => {
    const f = await fixture();
    await db.query("update safety_documents set title='지난 평가 50% 기록', created_at='2020-01-01',review_status='reopened' where id=$1", [f.documents[0].id]);
    const result = await f.search({ place: f.workplace, query: '50%', status: 'reopened', page: 7 });
    expect(result).toMatchObject({ total: 1, page: 1, items: [{ id: f.documents[0].id, workplace_name: '첫 현장', review: null }] });
    expect((await f.search({ query: '%' })).total).toBe(1);
    expect((await f.search({ query: '찾을 수 없는 제목' })).items).toEqual([]);
    expect((await f.search({ place: f.otherWorkplace })).total).toBe(0);
  });
  it('검토 대기는 자료 생성일이 아닌 실제 요청일 오래된 순이며 요청 버전을 고정한다', async () => {
    const f = await fixture();
    await db.query("update safety_documents set review_status='queued' where workplace_id=$1", [f.workplace]);
    await db.query(`insert into safety_reviews(document_id,version_id,organization_id,workplace_id,requested_by,requested_at,comment)
      select document_id,id,organization_id,workplace_id,created_by,'2026-09-20'::timestamptz,'PRIVATE_COMMENT' from safety_document_versions where workplace_id=$1`, [f.workplace]);
    const oldest = f.documents[0].id;
    await db.query("update safety_documents set created_at='2020-01-01' where id=$1", [oldest]);
    await db.query("update safety_reviews set requested_at='2026-08-01T00:00:00Z' where document_id=$1", [oldest]);
    const result = await f.search({ status: 'queued', view: 'reviews' });
    expect(result.total).toBe(111);
    expect(result.items[0]).toMatchObject({ id: oldest, review: { version_number: 1, status: 'queued' } });
    expect(new Date(result.items[0].review!.requested_at).toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    // A stale document flag must not resurrect an older queued request.
    await db.query(`with v as (insert into safety_document_versions(document_id,organization_id,workplace_id,number,content,created_by)
      values($1,$2,$3,2,'PRIVATE_NEW',$4) returning *)
      insert into safety_reviews(document_id,version_id,organization_id,workplace_id,status,requested_by,requested_at)
      select document_id,id,organization_id,workplace_id,'reviewed',created_by,'2026-09-21' from v`, [oldest, f.organization, f.workplace, f.owner]);
    expect((await f.search({ status: 'queued', view: 'reviews' })).total).toBe(110);
    const history = await f.search({ query: f.documents[0].title, view: 'reviews' });
    expect(history.items[0].review).toMatchObject({ version_number: 2, status: 'reviewed' });
  });
  it('다른 고객·민감자료·미배정 현장은 건수에도 포함하지 않고 배정·MFA·철회를 반영한다', async () => {
    const f = await fixture(2);
    await db.query('update safety_documents set sensitive=true where id=$1', [f.documents[0].id]);
    const hiddenWorkplace = crypto.randomUUID();
    await db.query("insert into safety_workplaces(id,organization_id,name) values($1,$2,'미허용 현장')", [hiddenWorkplace,f.organization]);
    await db.query("insert into safety_documents(organization_id,workplace_id,title,created_by) values($1,$2,'미허용 자료',$3)", [f.organization,hiddenWorkplace,f.owner]);
    expect((await f.search()).total).toBe(1);
    expect((await f.search({ actor: f.other, place: f.workplace })).total).toBe(0);
    expect((await f.search({ actor: f.operator, aal: 'aal2' })).total).toBe(0);
    await db.query("insert into app_private.safety_operators values($1,'reviewer',true)", [f.operator]);
    await db.query("insert into safety_reviewer_assignments(organization_id,workplace_id,reviewer_id,expires_at) values($1,$2,$3,now()+interval '1 day')", [f.organization,f.workplace,f.operator]);
    expect((await f.search({ actor: f.operator })).total).toBe(0);
    expect((await f.search({ actor: f.operator, aal: 'aal2' })).total).toBe(1);
    await db.query('update safety_reviewer_assignments set can_read_sensitive=true where reviewer_id=$1', [f.operator]);
    expect((await f.search({ actor: f.operator, aal: 'aal2' })).total).toBe(2);
    await db.query('update safety_reviewer_assignments set revoked_at=now() where reviewer_id=$1', [f.operator]);
    expect((await f.search({ actor: f.operator, aal: 'aal2' })).total).toBe(0);
  });
  it('같은 제목의 평가 회차를 구분하되 권한 없는 연결 업무의 메타정보는 노출하지 않는다', async () => {
    const f = await fixture(2), first = crypto.randomUUID(), second = crypto.randomUUID();
    await db.query(`insert into safety_tasks(id,organization_id,workplace_id,definition_id,definition_version,title,category,document_id)
      select $1,$2,$3,id,version,title,category,$4 from safety_task_definitions where id='REVIEW-003'`, [first,f.organization,f.workplace,f.documents[0].id]);
    await db.query(`insert into safety_tasks(id,organization_id,workplace_id,definition_id,definition_version,title,category,document_id,cycle_number,previous_task_id)
      select $1,$2,$3,id,version,title,category,$4,2,$5 from safety_task_definitions where id='REVIEW-003'`, [second,f.organization,f.workplace,f.documents[1].id,first]);
    const result = await f.search();
    expect(result.items.find(item => item.id === f.documents[0].id)?.task).toEqual({ id: first, definition_id: 'REVIEW-003', cycle_number: 1 });
    expect(result.items.find(item => item.id === f.documents[1].id)?.task).toEqual({ id: second, definition_id: 'REVIEW-003', cycle_number: 2 });
    await db.query('update safety_tasks set sensitive=true where id=$1', [second]);
    const restricted = await f.search();
    expect(restricted.total).toBe(2);
    expect(restricted.items.find(item => item.id === f.documents[1].id)?.task).toBeNull();
  });
  it('익명 실행과 잘못된 페이지·상태·보기는 거부한다', async () => {
    const f = await fixture(1);
    await expect(f.search({ page: 0 })).rejects.toThrow('invalid_state');
    await expect(f.search({ status: 'completed' })).rejects.toThrow('invalid_state');
    await expect(f.search({ view: 'private' })).rejects.toThrow('invalid_state');
    await expect(db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query('select safety_document_search()'); })).rejects.toThrow('permission denied');
  });
});
