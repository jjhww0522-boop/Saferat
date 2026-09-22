import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
let db: PGlite;
async function user<T = Record<string, unknown>>(id: string, sql: string, values: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, aal: 'aal1' })]);
    return (await tx.query<T>(sql, values)).rows;
  });
}
async function fixture() {
  const a = crypto.randomUUID(), b = crypto.randomUUID();
  for (const id of [a, b]) await db.query('insert into auth.users values($1,$2,now())', [id, `${id}@example.test`]);
  const workplace = (await user<{ id: string }>(a, "select safety_create_workspace('파일 시험','시험 현장') as id"))[0].id;
  const document = (await user<{ id: string }>(a, "select safety_create_document($1,'증빙 기록','저장한 원본',false) as id", [workplace]))[0].id;
  const version = (await user<{ id: string }>(a, 'select id from safety_document_versions where document_id=$1', [document]))[0].id;
  const reserve = async (v = version) => (await user<{ value: { id: string; object_path: string } }>(a, "select safety_reserve_file($1,'증빙.pdf','application/pdf',10,$2) as value", [v, 'a'.repeat(64)]))[0].value;
  const complete = (id: string, success: boolean | null, actor = a) => user(actor, 'select safety_complete_upload($1,$2)', [id, success]);
  const retry = async (v = version, revision = 1, actor = a) => (await user<{ value: { document_id: string; version_id: string } }>(actor, 'select safety_retry_evidence_version($1,$2) as value', [v, revision]))[0].value;
  return { a, b, workplace, document, version, reserve, complete, retry };
}
beforeAll(async () => {
  db = new PGlite(); await db.exec(await readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8'));
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, dir), 'utf8'));
});
afterAll(async () => { await db?.close(); });
describe('실패 파일의 원본 보존과 재시도', () => {
  it('10회 실패 후 새 버전으로 재시도하며 이전 본문·파일·검사상태를 그대로 남긴다', async () => {
    const f = await fixture();
    for (let i = 0; i < 10; i++) await f.complete((await f.reserve()).id, false);
    await expect(f.reserve()).rejects.toThrow('file_limit');
    await expect(user(f.a, 'select safety_confirm_version($1,1)', [f.version])).rejects.toThrow('file_inspection_pending');
    const originals = (await db.query('select * from safety_files where version_id=$1 order by id', [f.version])).rows;
    const next = await f.retry();
    expect(next.document_id).toBe(f.document);
    expect((await db.query('select number,content,confirmed_at from safety_document_versions where document_id=$1 order by number', [f.document])).rows).toEqual([{ number: 1, content: '저장한 원본', confirmed_at: null }, { number: 2, content: '저장한 원본', confirmed_at: null }]);
    expect((await db.query('select * from safety_files where version_id=$1 order by id', [f.version])).rows).toEqual(originals);
    expect(await user(f.a, 'select id from safety_files where version_id=$1', [next.version_id])).toEqual([]);
    expect(await user(f.a, 'select id from safety_reviews where document_id=$1', [f.document])).toEqual([]);
    expect(await user(f.a, 'select id from safety_activity_records where document_id=$1', [f.document])).toEqual([]);
    expect((await user(f.a, 'select review_status,revision from safety_documents where id=$1', [f.document]))[0]).toEqual({ review_status: 'reopened', revision: 2 });
    await f.reserve(next.version_id);
    await expect(f.retry()).rejects.toThrow('revision_conflict');
    await expect(f.retry(f.version, 2)).rejects.toThrow('invalid_state');
    const audit = (await db.query<{ details: { source_version_id: string; source_file_ids: string[] } }>("select details from safety_audit_events where action='file_retry_version_created' and resource_id=$1", [next.version_id])).rows[0].details;
    expect(audit.source_version_id).toBe(f.version); expect(audit.source_file_ids).toHaveLength(10);
  });
  it('10분 지난 업로드 대기만 복구하고 원본 경로를 삭제하거나 재사용하지 않는다', async () => {
    const f = await fixture(); const file = await f.reserve();
    await expect(f.retry()).rejects.toThrow('file_retry_unavailable');
    await db.query("update safety_files set created_at=now()-interval '11 minutes' where id=$1", [file.id]);
    const next = await f.retry(); const newFile = await f.reserve(next.version_id);
    expect(newFile.object_path).not.toBe(file.object_path);
    expect((await user(f.a, 'select state,object_path from safety_files where id=$1', [file.id]))[0]).toEqual({ state: 'reserved', object_path: file.object_path });
    await expect(user(f.a, 'select safety_prepare_download($1)', [file.id])).rejects.toThrow('file_inspection_pending');
  });
  it('검사 대기는 오래되어도 복구하지 않고 거부 파일과 검사완료 파일은 이전 버전에 보존한다', async () => {
    const f = await fixture(), rejected = await f.reserve(), clean = await f.reserve();
    await f.complete(rejected.id, true); await f.complete(clean.id, true);
    await db.query("update safety_files set created_at=now()-interval '1 day' where version_id=$1", [f.version]);
    await expect(f.retry()).rejects.toThrow('file_retry_unavailable');
    await db.query("select safety_record_file_inspection($1,false,$2,10,'test-scanner')", [rejected.id, 'a'.repeat(64)]);
    await db.query("select safety_record_file_inspection($1,true,$2,10,'test-scanner')", [clean.id, 'a'.repeat(64)]);
    const before = (await db.query('select * from safety_files where version_id=$1 order by id', [f.version])).rows;
    const next = await f.retry();
    expect((await db.query('select * from safety_files where version_id=$1 order by id', [f.version])).rows).toEqual(before);
    expect(await user(f.a, 'select id from safety_files where version_id=$1', [next.version_id])).toEqual([]);
    await expect(user(f.a, 'select safety_prepare_download($1)', [rejected.id])).rejects.toThrow('file_inspection_pending');
  });
  it('완료 응답 유실 재호출은 같은 결과만 허용하고 검사 상태나 감사를 덮어쓰지 않는다', async () => {
    const f = await fixture(), failed = await f.reserve(), clean = await f.reserve();
    await f.complete(failed.id, false); await f.complete(failed.id, false);
    await expect(f.complete(failed.id, true)).rejects.toThrow('invalid_state');
    await expect(f.complete(clean.id, null)).rejects.toThrow('invalid_state');
    await f.complete(clean.id, true); await f.complete(clean.id, true);
    await db.query("select safety_record_file_inspection($1,true,$2,10,'test-scanner')", [clean.id, 'a'.repeat(64)]);
    await f.complete(clean.id, true);
    await expect(f.complete(clean.id, false)).rejects.toThrow('invalid_state');
    expect((await user(f.a, 'select state,scanner_version from safety_files where id=$1', [clean.id]))[0]).toEqual({ state: 'clean', scanner_version: 'test-scanner' });
    expect((await db.query("select id from safety_audit_events where resource_id=$1 and action='file_upload_recorded'", [clean.id])).rows).toHaveLength(1);
    await expect(f.complete(clean.id, true, f.b)).rejects.toThrow('access_denied');
    await db.query('update safety_workplace_access set can_write=false where user_id=$1 and workplace_id=$2', [f.a, f.workplace]);
    await expect(f.complete(clean.id, true)).rejects.toThrow('access_denied');
    await expect(f.retry()).rejects.toThrow('access_denied');
  });
  it('타인·민감자료·오래된 revision·확인완료·검토대기는 복구하지 못한다', async () => {
    const f = await fixture(); await f.complete((await f.reserve()).id, false);
    await expect(f.retry(f.version, 1, f.b)).rejects.toThrow('access_denied');
    await expect(f.retry(f.version, 99)).rejects.toThrow('revision_conflict');
    await db.query('update safety_documents set sensitive=true where id=$1', [f.document]);
    await expect(f.retry()).rejects.toThrow('access_denied');
    await db.query('update safety_documents set sensitive=false where id=$1', [f.document]);
    await db.query("update safety_documents set review_status='queued' where id=$1", [f.document]);
    await expect(f.retry()).rejects.toThrow('review_pending');
    await db.query("update safety_documents set review_status='not_requested' where id=$1", [f.document]);
    await db.query('update safety_document_versions set confirmed_at=now(),confirmed_by=$2 where id=$1', [f.version, f.a]);
    await expect(f.retry()).rejects.toThrow('invalid_state');
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('anon','public.safety_retry_evidence_version(uuid,integer)','execute') as allowed")).rows[0].allowed).toBe(false);
  });
});
