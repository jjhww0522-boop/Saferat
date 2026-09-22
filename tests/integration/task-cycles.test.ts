import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

let db: PGlite;
let legacy: Awaited<ReturnType<typeof fixture>>;
async function user<T = Record<string, unknown>>(id: string, sql: string, values: unknown[] = [], aal = 'aal1') {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, aal })]);
    return (await tx.query<T>(sql, values)).rows;
  });
}
async function fixture(sensitive = false) {
  const a = crypto.randomUUID(), b = crypto.randomUUID(), reviewer = crypto.randomUUID();
  for (const id of [a, b, reviewer]) await db.query('insert into auth.users values($1,$2,now())', [id, `${id}@example.test`]);
  const workplace = (await user<{ id: string }>(a, "select safety_create_workspace('회차 시험','시험 현장') as id"))[0].id;
  const org = (await db.query<{ organization_id: string }>('select organization_id from safety_workplaces where id=$1', [workplace])).rows[0].organization_id;
  await user(a, "select safety_save_workplace_profile($1,'all',null,'[]',$2,0,true)", [workplace, JSON.stringify({ businessName: '시험', actualAddress: '시험 장소', actualWork: '시험 작업' })]);
  if (sensitive) await db.query('update safety_workplace_access set can_read_sensitive=true where workplace_id=$1 and user_id=$2', [workplace, a]);
  const start = async (definition = 'REVIEW-003') => (await user<{ id: string }>(a, 'select safety_start_task($1,$2,$3) as id', [workplace, definition, sensitive]))[0].id;
  const task = await start();
  const save = async (id = task, revision = 1, documentRevision: number | null = null, content = '이전 원본') => (await user<{ id: string }>(a, "select safety_save_task($1,$2,$3,'이전 담당','2026-09-01',$4) as id", [id, revision, documentRevision, content]))[0].id;
  const next = async (id = task, revision = 2, actor = a) => (await user<{ id: string }>(actor, 'select safety_start_next_task_cycle($1,$2) as id', [id, revision]))[0].id;
  return { a, b, reviewer, workplace, org, task, start, save, next };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8'));
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
    if (file === '202609210010_task_cycles.sql') { legacy = await fixture(); await legacy.save(); }
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }
});
afterAll(async () => { await db?.close(); });

describe('위험성평가 회차의 보존과 생성 경계', () => {
  it('기존 업무와 원본은 첫 회차로 보존하고 기존 시작 호출은 최신 회차를 반환한다', async () => {
    expect((await user(legacy.a, 'select cycle_number,previous_task_id,revision from safety_tasks where id=$1', [legacy.task]))[0]).toEqual({ cycle_number: 1, previous_task_id: null, revision: 2 });
    expect(await legacy.start()).toBe(legacy.task);
    const next = await legacy.next();
    expect(await legacy.start()).toBe(next);
    expect((await db.query('select content from safety_document_versions v join safety_tasks t on t.document_id=v.document_id where t.id=$1', [legacy.task])).rows).toEqual([{ content: '이전 원본' }]);
  });
  it('검토 대기 중에도 독립 회차를 만들며 이전 수행·증빙·확인·검토·담당·기한을 복사하지 않는다', async () => {
    const f = await fixture(); const doc = await f.save();
    const version = (await db.query<{ id: string }>('select id from safety_document_versions where document_id=$1', [doc])).rows[0].id;
    const file = (await user<{ f: { id: string } }>(f.a, "select safety_reserve_file($1,'현장.pdf','application/pdf',10,$2) as f", [version, 'a'.repeat(64)]))[0].f.id;
    await user(f.a, 'select safety_complete_upload($1,true)', [file]);
    await db.query("select safety_record_file_inspection($1,true,$2,10,'test-scanner')", [file, 'a'.repeat(64)]);
    await user(f.a, 'select safety_confirm_version($1,1)', [version]);
    await user(f.a, 'select safety_request_review($1,2)', [version]);
    await user(f.a, "select safety_record_activity($1,3,'2026-09-01','직접 확인')", [doc]);
    const original = (await db.query('select to_jsonb(t) as task from safety_tasks t where id=$1', [f.task])).rows[0];
    const next = await f.next();
    await expect(user(f.a, 'select safety_link_task_document($1,$2,1)', [next, doc])).rejects.toThrow('invalid_state');
    expect((await user(f.a, 'select document_id,owner,target_date,revision,cycle_number,previous_task_id,sensitive from safety_tasks where id=$1', [next]))[0]).toEqual({ document_id: null, owner: '', target_date: null, revision: 1, cycle_number: 2, previous_task_id: f.task, sensitive: false });
    expect((await db.query('select to_jsonb(t) as task from safety_tasks t where id=$1', [f.task])).rows[0]).toEqual(original);
    expect((await user(f.a, 'select review_status from safety_documents where id=$1', [doc]))[0]).toEqual({ review_status: 'queued' });
    expect((await user(f.a, 'select id from safety_activity_records where document_id=$1', [doc]))).toHaveLength(1);
    expect((await user(f.a, 'select id from safety_reviews where document_id=$1', [doc]))).toHaveLength(1);
    expect((await user(f.a, 'select id from safety_files where document_id=$1', [doc]))).toHaveLength(1);
    const nextDoc = await f.save(next, 1, null, '이번 회차 직접 확인');
    expect(nextDoc).not.toBe(doc);
    expect((await user(f.a, 'select number,confirmed_at from safety_document_versions where document_id=$1', [nextDoc]))).toEqual([{ number: 1, confirmed_at: null }]);
    expect((await user(f.a, 'select id from safety_activity_records where document_id=$1', [nextDoc]))).toEqual([]);
    expect((await user(f.a, 'select id from safety_files where document_id=$1', [nextDoc]))).toEqual([]);
  });
  it('중복 요청은 같은 다음 회차를 반환하고 출처 revision이 바뀌면 거부한다', async () => {
    const f = await fixture(); const doc = await f.save();
    const [a, b] = await Promise.all([f.next(), f.next()]);
    expect(a).toBe(b);
    const thirdDoc = await f.save(a); expect(thirdDoc).not.toBe(doc);
    const third = await f.next(a);
    expect(await f.start()).toBe(third);
    expect(await f.next()).toBe(a);
    expect((await db.query("select details from safety_audit_events where resource_id=$1 and action='task_cycle_started'", [a])).rows).toEqual([{ details: { previous_task_id: f.task, previous_revision: 2, cycle_number: 2 } }]);
    await f.save(f.task, 2, 1, '이전 회차 정정');
    await expect(f.next()).rejects.toThrow('revision_conflict');
    expect(await f.next(f.task, 3)).toBe(a);
    expect((await db.query('select content from safety_document_versions where document_id=$1 order by number', [doc])).rows).toEqual([{ content: '이전 원본' }, { content: '이전 회차 정정' }]);
  });
  it('기록 없는 회차·다른 업무·미확인 프로필로 신규 회차를 만들지 않는다', async () => {
    const f = await fixture();
    await expect(f.next(f.task, 1)).rejects.toThrow('cycle_record_required');
    await f.save();
    await expect(f.next(f.task, 1)).rejects.toThrow('revision_conflict');
    const photo = await f.start('FORM_PHOTO'); await f.save(photo);
    await expect(f.next(photo)).rejects.toThrow('invalid_state');
    await user(f.a, "select safety_save_workplace_profile($1,'all',null,'[]','{}',1,false)", [f.workplace]);
    await expect(f.next()).rejects.toThrow('profile_required');
    expect(await f.start()).toBe(f.task);
  });
  it('타인·읽기 전용·운영 검토자·철회 권한의 생성과 중복요청을 차단한다', async () => {
    const f = await fixture(); await f.save(); const next = await f.next();
    await expect(f.next(f.task, 2, f.b)).rejects.toThrow('access_denied');
    await db.query("insert into app_private.safety_operators values($1,'reviewer',true)", [f.reviewer]);
    await db.query("insert into safety_reviewer_assignments(organization_id,workplace_id,reviewer_id,expires_at) values($1,$2,$3,now()+interval '1 day')", [f.org, f.workplace, f.reviewer]);
    await expect(user(f.reviewer, 'select safety_start_next_task_cycle($1,2)', [f.task], 'aal2')).rejects.toThrow('access_denied');
    await db.query('update safety_workplace_access set can_write=false where workplace_id=$1 and user_id=$2', [f.workplace, f.a]);
    expect(await user(f.a, 'select id from safety_tasks where id=$1', [next])).toHaveLength(1);
    await expect(f.next()).rejects.toThrow('access_denied');
    await db.query('update safety_workplace_access set can_write=true,active=false where workplace_id=$1 and user_id=$2', [f.workplace, f.a]);
    await expect(f.next()).rejects.toThrow('access_denied');
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('anon','public.safety_start_next_task_cycle(uuid,integer)','execute') as allowed")).rows[0].allowed).toBe(false);
  });
  it('민감 분류와 현장 경계를 보존하고 이전 회차 요약을 숨기지 않는다', async () => {
    const f = await fixture(true); await f.save(); const next = await f.next();
    expect((await user(f.a, 'select sensitive from safety_tasks where id=$1', [next]))[0].sensitive).toBe(true);
    const sources = (await user<{ value: { task_id: string }[] }>(f.a, 'select safety_task_action_sources($1) as value', [f.workplace]))[0].value;
    expect(sources.map(s => s.task_id).sort()).toEqual([f.task, next].sort());
    await db.query('update safety_workplace_access set can_read_sensitive=false where workplace_id=$1 and user_id=$2', [f.workplace, f.a]);
    await expect(f.next()).rejects.toThrow('access_denied');
    await expect(f.start()).rejects.toThrow('access_denied');
    expect(await user(f.a, 'select id from safety_tasks where workplace_id=$1', [f.workplace])).toEqual([]);
    await expect(user(f.a, 'update safety_tasks set previous_task_id=$1 where id=$2', [next, f.task])).rejects.toThrow(/permission denied/);
    const other = await fixture();
    await expect(db.query('insert into safety_tasks(organization_id,workplace_id,definition_id,definition_version,title,category,cycle_number,previous_task_id) select organization_id,workplace_id,definition_id,definition_version,title,category,2,$1 from safety_tasks where id=$2', [f.task, other.task])).rejects.toThrow(/foreign key|duplicate key/);
  });
});
