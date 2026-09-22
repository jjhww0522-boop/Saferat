import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

let db: PGlite;
const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');
async function asUser<T = Record<string, unknown>>(user: string, sql: string, values: unknown[] = [], aal = 'aal1') {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.exec("set local storage.operation = 'object.get_authenticated'");
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, aal })]);
    return (await tx.query<T>(sql, values)).rows;
  });
}
async function fixture() {
  const a = crypto.randomUUID(), b = crypto.randomUUID(), reviewer = crypto.randomUUID(), invitee = crypto.randomUUID();
  for (const id of [a, b, reviewer, invitee]) await db.query('insert into auth.users values($1, $2, now())', [id, `${id}@example.test`]);
  const workspace = async (user: string) => (await asUser<{ id: string }>(user, "select public.safety_create_workspace('테스트 조직', '테스트 현장') as id"))[0].id;
  const wa = await workspace(a), wb = await workspace(b);
  const org = (await db.query<{ organization_id: string }>('select organization_id from safety_workplaces where id = $1', [wa])).rows[0].organization_id;
  const hidden = crypto.randomUUID();
  await db.query("insert into safety_workplaces values ($1, $2, '권한 없는 현장')", [hidden, org]);
  const assignment = crypto.randomUUID();
  await db.query("insert into app_private.safety_operators(user_id, role) values($1, 'reviewer')", [reviewer]);
  await db.query("insert into safety_reviewer_assignments(id, organization_id, workplace_id, reviewer_id, expires_at) values ($1, $2, $3, $4, now() + interval '1 day')", [assignment, org, wa, reviewer]);
  const create = async (user = a, workplace = wa, sensitive = false) => (await asUser<{ id: string }>(user, "select safety_create_document($1, '현장 기록', '원본 내용', $2) as id", [workplace, sensitive]))[0].id;
  const document = await create();
  const version = (await db.query<{ id: string }>('select id from safety_document_versions where document_id = $1', [document])).rows[0].id;
  return { a, b, reviewer, invitee, wa, wb, org, hidden, assignment, create, document, version };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(await read('./bootstrap.sql'));
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
});
afterAll(async () => { await db?.close(); });

describe('PostgreSQL RLS와 서버 RPC', () => {
  it('고객·현장·직접 원본 읽기·직접 쓰기·역할 위조를 차단한다', async () => {
    const f = await fixture();
    expect(await asUser(f.b, 'select id from safety_documents where id = $1', [f.document])).toEqual([]);
    expect(await asUser(f.a, 'select id from safety_workplaces where id = $1', [f.hidden])).toEqual([]);
    await expect(f.create(f.a, f.hidden)).rejects.toThrow('access_denied');
    await expect(asUser(f.b, 'select safety_read_version($1)', [f.version])).rejects.toThrow('access_denied');
    await expect(asUser(f.a, 'select content from safety_document_versions where id = $1', [f.version])).rejects.toThrow(/permission denied/);
    await expect(asUser(f.a, "update safety_memberships set role = 'owner' where user_id = $1", [f.b])).rejects.toThrow(/permission denied/);
    await expect(asUser(f.a, "update safety_document_versions set content = '덮어쓰기' where id = $1", [f.version])).rejects.toThrow(/permission denied/);
    await expect(asUser(f.a, 'delete from safety_documents where id = $1', [f.document])).rejects.toThrow(/permission denied/);
    await expect(asUser(f.a, "select app_private.safety_audit($1, '위조')", [f.document])).rejects.toThrow(/permission denied/);
    await expect(db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query('select safety_read_version($1)', [f.version]); })).rejects.toThrow(/permission denied/);
  });
  it('다른 조직·현장·문서의 ID를 섞으면 DB 외래키가 거부한다', async () => {
    const f = await fixture();
    await expect(db.query("insert into safety_workplace_access values ($1, $2, $3, true, false, true)", [f.wb, f.org, f.a])).rejects.toThrow(/foreign key/);
    await expect(db.query("insert into safety_document_versions(document_id, organization_id, workplace_id, number, content, created_by) values ($1, $2, $3, 2, '혼합', $4)", [f.document, f.org, f.wb, f.a])).rejects.toThrow(/foreign key/);
  });
  it('v1 요청→보완→v2→검토를 보존하고 수행·접수 상태를 바꾸지 않는다', async () => {
    const f = await fixture();
    await expect(asUser(f.a, 'select safety_request_review($1, 1)', [f.version])).rejects.toThrow('invalid_state');
    await asUser(f.a, 'select safety_confirm_version($1, 1)', [f.version]);
    const review = (await asUser<{ id: string }>(f.a, 'select safety_request_review($1, 2) as id', [f.version]))[0].id;
    expect((await asUser<{ id: string }>(f.a, 'select safety_request_review($1, 2) as id', [f.version]))[0].id).toBe(review);
    await expect(asUser(f.a, "select safety_new_version($1, 3, '수정')", [f.document])).rejects.toThrow('review_pending');
    await expect(asUser(f.reviewer, "select safety_decide_review($1, 3, 'changes_requested', '내용', '위치 추가', '내부 메모')", [review])).rejects.toThrow('access_denied');
    await asUser(f.reviewer, "select safety_decide_review($1, 3, 'changes_requested', '내용', '위치 추가', '내부 메모')", [review], 'aal2');
    expect(await asUser(f.a, 'select * from safety_review_notes where review_id = $1', [review])).toEqual([]);
    expect(await asUser(f.reviewer, 'select note from safety_review_notes where review_id = $1', [review], 'aal2')).toEqual([{ note: '내부 메모' }]);
    const v2 = (await asUser<{ id: string }>(f.a, "select safety_new_version($1, 4, '위치를 보완한 새 내용') as id", [f.document]))[0].id;
    await expect(asUser(f.a, "select safety_new_version($1, 4, '중복')", [f.document])).rejects.toThrow('revision_conflict');
    await asUser(f.a, 'select safety_confirm_version($1, 5)', [v2]);
    const r2 = (await asUser<{ id: string }>(f.a, 'select safety_request_review($1, 6) as id', [v2]))[0].id;
    await asUser(f.reviewer, "select safety_decide_review($1, 7, 'reviewed', '', '자료 확인', '')", [r2], 'aal2');
    const original = (await asUser<{ value: { content: string } }>(f.a, 'select safety_read_version($1) as value', [f.version]))[0].value;
    expect(original.content).toBe('원본 내용');
    expect(await asUser(f.a, 'select status from safety_reviews where id = $1', [review])).toEqual([{ status: 'changes_requested' }]);
    expect(await asUser(f.a, 'select review_status, submission_status from safety_documents where id = $1', [f.document])).toEqual([{ review_status: 'reviewed', submission_status: 'needs_confirmation' }]);
    expect(await asUser(f.a, 'select * from safety_activity_records where document_id = $1', [f.document])).toEqual([]);
    expect((await asUser(f.a, "select id from safety_audit_events where document_id = $1 and action = 'version_read'", [f.document])).length).toBe(1);
  });
  it('유효한 배정·AAL2·민감자료 권한을 각각 요구하며 철회를 즉시 적용한다', async () => {
    const f = await fixture();
    expect(await asUser(f.reviewer, 'select id from safety_documents where id = $1', [f.document])).toEqual([]);
    expect((await asUser(f.reviewer, 'select id from safety_documents where id = $1', [f.document], 'aal2')).length).toBe(1);
    await expect(f.create(f.a, f.wa, true)).rejects.toThrow('access_denied');
    await db.query('update safety_workplace_access set can_read_sensitive = true where workplace_id = $1 and user_id = $2', [f.wa, f.a]);
    const sensitive = await f.create(f.a, f.wa, true);
    expect(await asUser(f.reviewer, 'select id from safety_documents where id = $1', [sensitive], 'aal2')).toEqual([]);
    await db.query('update safety_reviewer_assignments set revoked_at = now() where id = $1', [f.assignment]);
    const audit = (await db.query<{ details: { before: { revoked_at: string | null }; after: { revoked_at: string | null } } }>("select details from safety_audit_events where resource_id = $1 and action = 'safety_reviewer_assignments_update'", [f.assignment])).rows[0];
    expect(audit.details.before.revoked_at).toBeNull();
    expect(audit.details.after.revoked_at).not.toBeNull();
    expect(await asUser(f.reviewer, 'select id from safety_documents where id = $1', [f.document], 'aal2')).toEqual([]);
    await db.query('update safety_workplace_access set active = false where workplace_id = $1 and user_id = $2', [f.wa, f.a]);
    expect(await asUser(f.a, 'select id from safety_documents where id = $1', [f.document])).toEqual([]);
    await expect(asUser(f.a, 'select safety_read_version($1)', [f.version])).rejects.toThrow('access_denied');
  });
  it('배정 시작 전·만료 후에는 추가 인증을 해도 접근할 수 없다', async () => {
    const f = await fixture();
    await db.query("update safety_reviewer_assignments set starts_at = now() + interval '1 hour' where id = $1", [f.assignment]);
    expect(await asUser(f.reviewer, 'select id from safety_documents where id = $1', [f.document], 'aal2')).toEqual([]);
    await db.query("update safety_reviewer_assignments set starts_at = now() - interval '2 days', expires_at = now() - interval '1 day' where id = $1", [f.assignment]);
    expect(await asUser(f.reviewer, 'select id from safety_documents where id = $1', [f.document], 'aal2')).toEqual([]);
  });
  it('초대를 확인된 이메일·현장에 묶고 재사용·철회·계정 재활성화를 막는다', async () => {
    const f = await fixture();
    const make = async () => (await asUser<{ value: { id: string; token: string } }>(f.a, 'select safety_create_invitation($1, $2, true) as value', [f.wa, `${f.invitee}@example.test`]))[0].value;
    const invite = await make();
    expect(await asUser(f.b, 'select * from safety_list_invitations() where id = $1', [invite.id])).toEqual([]);
    const listed = (await asUser(f.a, 'select * from safety_list_invitations() where id = $1', [invite.id]))[0];
    expect(listed).toMatchObject({ email: `${f.invitee}@example.test`, expired: false });
    expect(listed).not.toHaveProperty('token_hash');
    await expect(asUser(f.b, 'select safety_accept_invitation($1)', [invite.token])).rejects.toThrow('invalid_invitation');
    await db.query('update auth.users set email_confirmed_at = null where id = $1', [f.invitee]);
    await expect(asUser(f.invitee, 'select safety_accept_invitation($1)', [invite.token])).rejects.toThrow('invalid_invitation');
    await db.query('update auth.users set email_confirmed_at = now() where id = $1', [f.invitee]);
    await asUser(f.invitee, 'select safety_accept_invitation($1)', [invite.token]);
    expect((await asUser(f.invitee, 'select id from safety_documents where id = $1', [f.document])).length).toBe(1);
    expect(await asUser(f.invitee, 'select id from safety_workplaces where id = $1', [f.hidden])).toEqual([]);
    await expect(asUser(f.invitee, 'select safety_accept_invitation($1)', [invite.token])).rejects.toThrow('invalid_invitation');
    const revoked = await make();
    await asUser(f.a, 'select safety_revoke_invitation($1)', [revoked.id]);
    await expect(asUser(f.invitee, 'select safety_accept_invitation($1)', [revoked.token])).rejects.toThrow('invalid_invitation');
    const pending = await make();
    await db.query('update safety_memberships set active = false where organization_id = $1 and user_id = $2', [f.org, f.invitee]);
    await expect(asUser(f.invitee, 'select safety_accept_invitation($1)', [pending.token])).rejects.toThrow('access_denied');
  });
  it('만료된 초대와 원문 바이트가 다른 검사 승인을 거부한다', async () => {
    const f = await fixture();
    const invite = (await asUser<{ value: { id: string; token: string } }>(f.a, 'select safety_create_invitation($1, $2) as value', [f.wa, `${f.invitee}@example.test`]))[0].value;
    await db.query("update app_private.safety_invitations set expires_at = now() - interval '1 second' where id = $1", [invite.id]);
    await expect(asUser(f.invitee, 'select safety_accept_invitation($1)', [invite.token])).rejects.toThrow('invalid_invitation');
    const file = (await asUser<{ value: { id: string } }>(f.a, "select safety_reserve_file($1, '현장.pdf', 'application/pdf', 10, $2) as value", [f.version, 'a'.repeat(64)]))[0].value;
    await asUser(f.a, 'select safety_complete_upload($1, true)', [file.id]);
    await db.query("select safety_record_file_inspection($1, true, $2, 10, 'test-scanner')", [file.id, 'b'.repeat(64)]);
    expect(await asUser(f.a, 'select state from safety_files where id = $1', [file.id])).toEqual([{ state: 'rejected' }]);
    await expect(asUser(f.a, 'select safety_prepare_download($1)', [file.id])).rejects.toThrow('file_inspection_pending');
  });
  it('수행 정정은 새 기록으로 남고 다른 문서의 기록을 정정할 수 없다', async () => {
    const f = await fixture();
    const original = (await asUser<{ id: string }>(f.a, "select safety_record_activity($1, 1, '2026-01-01', '현장 확인') as id", [f.document]))[0].id;
    await expect(asUser(f.a, "select safety_record_activity($1, 1, '2026-01-01', '중복')", [f.document])).rejects.toThrow('revision_conflict');
    await asUser(f.a, "select safety_record_activity($1, 2, '2026-01-02', '날짜 정정', $2)", [f.document, original]);
    const other = await f.create();
    await expect(asUser(f.a, "select safety_record_activity($1, 1, '2026-01-02', '다른 자료', $2)", [other, original])).rejects.toThrow('invalid_correction');
    await expect(asUser(f.a, "select safety_record_activity($1, 3, '2999-01-01', '미래')", [f.document])).rejects.toThrow('future_activity');
    expect((await asUser(f.a, 'select id from safety_activity_records where document_id = $1', [f.document])).length).toBe(2);
  });
  it('격리 파일·위조 검사·직접 Storage 다운로드·권한 철회 우회를 차단한다', async () => {
    const f = await fixture();
    const file = (await asUser<{ value: { id: string; object_path: string } }>(f.a, "select safety_reserve_file($1, '현장.pdf', 'application/pdf', 10, $2) as value", [f.version, 'a'.repeat(64)]))[0].value;
    await expect(asUser(f.b, "insert into storage.objects(bucket_id, name) values('safety-evidence', $1)", [file.object_path])).rejects.toThrow(/row-level security/);
    await asUser(f.a, "insert into storage.objects(bucket_id, name) values('safety-evidence', $1)", [file.object_path]);
    expect(await asUser(f.a, 'select name from storage.objects where name = $1', [file.object_path])).toEqual([]);
    await asUser(f.a, 'select safety_complete_upload($1, true)', [file.id]);
    await expect(asUser(f.a, 'select safety_prepare_download($1)', [file.id])).rejects.toThrow('file_inspection_pending');
    await expect(asUser(f.a, 'select safety_confirm_version($1, 1)', [f.version])).rejects.toThrow('file_inspection_pending');
    await expect(asUser(f.a, "select safety_record_file_inspection($1, true, $2, 10, 'test')", [file.id, 'a'.repeat(64)])).rejects.toThrow(/permission denied/);
    await db.query("select safety_record_file_inspection($1, true, $2, 10, 'test-scanner')", [file.id, 'a'.repeat(64)]);
    await asUser(f.a, 'select safety_prepare_download($1)', [file.id]);
    expect((await asUser(f.a, 'select name from storage.objects where name = $1', [file.object_path])).length).toBe(1);
    await db.transaction(async tx => {
      await tx.exec("set local role authenticated; set local storage.operation = 'object.sign'");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: f.a, aal: 'aal1' })]);
      expect((await tx.query('select name from storage.objects where name = $1', [file.object_path])).rows).toEqual([]);
    });
    expect((await asUser(f.a, "update storage.objects set name = 'overwritten' where name = $1 returning id", [file.object_path])).length).toBe(0);
    await db.query('update safety_memberships set active = false where organization_id = $1 and user_id = $2', [f.org, f.a]);
    expect(await asUser(f.a, 'select name from storage.objects where name = $1', [file.object_path])).toEqual([]);
    await expect(asUser(f.a, 'select safety_prepare_download($1)', [file.id])).rejects.toThrow('access_denied');
  });
  it('SQL 백업 복원·디스크 저장·DB 재시작 뒤에도 원본과 철회된 권한을 보존한다', async () => {
    const f = await fixture();
    await db.query('update safety_reviewer_assignments set revoked_at = now() where id = $1', [f.assignment]);
    const backup = await db.dumpDataDir();
    const testRoot = resolve('test-results');
    await mkdir(testRoot, { recursive: true });
    const dataDir = await mkdtemp(`${testRoot}${sep}p2-postgres-`);
    const target = resolve(dataDir);
    if (!target.startsWith(`${testRoot}${sep}p2-postgres-`)) throw new Error('Refusing to remove a path outside the owned test directory');
    let restored = new PGlite({ dataDir, loadDataDir: backup });
    try {
      expect((await restored.query<{ content: string }>('select content from safety_document_versions where id = $1', [f.version])).rows[0].content).toBe('원본 내용');
      await restored.close();
      restored = new PGlite(dataDir);
      expect((await restored.query<{ content: string }>('select content from safety_document_versions where id = $1', [f.version])).rows[0].content).toBe('원본 내용');
      await restored.transaction(async tx => {
        await tx.exec('set local role authenticated');
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: f.reviewer, aal: 'aal2' })]);
        expect((await tx.query('select id from safety_documents where id = $1', [f.document])).rows).toEqual([]);
      });
    } finally {
      await restored.close();
      await rm(target, { recursive: true, force: true });
    }
  });
});
