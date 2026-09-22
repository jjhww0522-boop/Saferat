import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { taskDefinitions, taskDefinition, readTaskForm, parseTaskContent } from '../../src/domain/tasks';
import { emptyRiskAssessment, emptyRiskHazard } from '../../src/domain/risk-assessment';
let db: PGlite;
let legacy: Awaited<ReturnType<typeof fixture>>;
const essentials = { businessName: '시험 사업장', actualAddress: '시험 주소', actualWork: '시설 유지관리' };
const profileSql = 'select safety_save_workplace_profile($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)';
async function saveProfile(actor: string, workplace: string, revision = 0, confirmed = true, facts: unknown = essentials, headcount: number | null = null, industry = 'all', work: unknown = []) {
  return user(actor, profileSql, [workplace, industry, headcount, JSON.stringify(work), JSON.stringify(facts), revision, confirmed]);
}
async function user<T = Record<string, unknown>>(id: string, sql: string, values: unknown[] = [], aal = 'aal1') {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, aal, role: 'operator', user_metadata: { operator: true } })]);
    return (await tx.query<T>(sql, values)).rows;
  });
}
async function fixture(confirmed = true) {
  const a = crypto.randomUUID(), b = crypto.randomUUID(), op = crypto.randomUUID();
  for (const id of [a, b, op]) await db.query('insert into auth.users values($1,$2,now())', [id, `${id}@example.test`]);
  const workspace = async (id: string) => (await user<{ id: string }>(id, "select safety_create_workspace('시험 조직','시험 현장') as id"))[0].id;
  const wa = await workspace(a), wb = await workspace(b);
  const start = async (actor = a, workplace = wa, definition = 'FORM_PHOTO', sensitive = false) => (await user<{ id: string }>(actor, 'select safety_start_task($1,$2,$3) as id', [workplace, definition, sensitive]))[0].id;
  if (confirmed) await saveProfile(a, wa);
  const task = confirmed ? await start() : '';
  return { a, b, op, wa, wb, task, start };
}
beforeAll(async () => {
  db = new PGlite(); await db.exec(await readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8'));
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
    if (file === '202609150007_workplace_profile.sql') {
      legacy = await fixture(false);
      await user(legacy.a, "select safety_save_workplace_profile($1,'facility',0,'[]')", [legacy.wa]);
      legacy.task = await legacy.start(legacy.a, legacy.wa, 'FORM_REGISTRATION');
    }
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }
});
afterAll(async () => { await db?.close(); });
describe('업무 저장과 운영자 진입 DB 경계', () => {
  it('DB 후보 정의가 화면의 원본 81개와 일치한다', async () => {
    const rows = (await db.query<{ id: string; title: string; version: string }>('select id,title,version from safety_task_definitions order by id')).rows;
    expect(rows).toEqual(taskDefinitions.map(d => ({ id: d.id, title: d.title, version: d.version })).sort((a, b) => a.id.localeCompare(b.id)));
  });
  it('중복 시작은 동일 ID이며 권한 없는 현장·직접 쓰기는 차단한다', async () => {
    const f = await fixture(); expect(await f.start()).toBe(f.task);
    expect(await user(f.b, 'select id from safety_tasks where id=$1', [f.task])).toEqual([]);
    await expect(f.start(f.b, f.wa)).rejects.toThrow('access_denied');
    await expect(f.start(f.a, f.wa, 'APPROVED_FAKE')).rejects.toThrow('invalid_state');
    await expect(user(f.a, "update safety_tasks set title='임의 의무' where id=$1", [f.task])).rejects.toThrow(/permission denied/);
    expect(await user(f.a, 'select document_id from safety_tasks where id=$1', [f.task])).toEqual([{ document_id: null }]);
  });
  it('메타데이터 임시 저장과 문서 버전을 구분하고 과거 자료·행위 이력을 보존한다', async () => {
    const f = await fixture();
    await user(f.a, "select safety_save_task($1,1,null,'담당자','2026-09-15',null)", [f.task]);
    expect((await user(f.a, 'select document_id from safety_tasks where id=$1', [f.task]))[0].document_id).toBeNull();
    const doc = (await user<{ id: string }>(f.a, "select safety_save_task($1,2,null,'담당자','2026-09-15','확인한 원본') as id", [f.task]))[0].id;
    await user(f.a, "select safety_save_task($1,3,1,'새 담당자','2026-09-16','보완한 내용')", [f.task]);
    const versions = (await db.query<{ content: string }>('select content from safety_document_versions where document_id=$1 order by number', [doc])).rows;
    expect(versions).toEqual([{ content: '확인한 원본' }, { content: '보완한 내용' }]);
    expect((await user(f.a, 'select submission_status from safety_documents where id=$1', [doc]))[0].submission_status).toBe('needs_confirmation');
    expect(await user(f.a, 'select id from safety_activity_records where document_id=$1', [doc])).toEqual([]);
    expect((await db.query('select id from safety_audit_events where resource_id=$1', [f.task])).rows).toHaveLength(4);
  });
  it('오래된 업무·문서 revision의 변경을 원자적으로 거부한다', async () => {
    const f = await fixture();
    const doc = (await user<{ id: string }>(f.a, "select safety_save_task($1,1,null,'',null,'원본') as id", [f.task]))[0].id;
    await expect(user(f.a, "select safety_save_task($1,1,1,'변조',null,'새 내용')", [f.task])).rejects.toThrow('revision_conflict');
    await user(f.a, "select safety_new_version($1,1,'다른 창의 변경')", [doc]);
    await expect(user(f.a, "select safety_save_task($1,2,1,'덮어쓰기',null,'새 내용')", [f.task])).rejects.toThrow('revision_conflict');
    expect((await user(f.a, 'select owner from safety_tasks where id=$1', [f.task]))[0].owner).toBe('');
  });
  it('위험성평가의 단계·위험요인과 정정 전 버전을 권한 범위 안에 보존한다', async () => {
    const f = await fixture();
    const task = await f.start(f.a, f.wa, 'REVIEW-003');
    const risk = { ...emptyRiskAssessment(), scope: '시험 작업장', hazards: [{ ...emptyRiskHazard('risk-1'), hazard: '물기에 미끄러짐' }, emptyRiskHazard('risk-2')] };
    const form = new FormData(); form.set('risk_assessment', JSON.stringify(risk));
    const content = readTaskForm(taskDefinition('REVIEW-003')!, form)!;
    const doc = (await user<{ id: string }>(f.a, "select safety_save_task($1,1,null,'',null,$2) as id", [task, content]))[0].id;
    risk.hazards[0].measure = '배수 상태 보완';
    form.set('risk_assessment', JSON.stringify(risk));
    await user(f.a, "select safety_save_task($1,2,1,'',null,$2)", [task, readTaskForm(taskDefinition('REVIEW-003')!, form)]);
    const versions = (await db.query<{ content: string }>('select content from safety_document_versions where document_id=$1 order by number', [doc])).rows.map(row => parseTaskContent(row.content)!);
    expect(versions).toHaveLength(2);
    expect(versions[0].risk?.hazards[0].measure).toBe('');
    expect(versions[1].risk?.hazards[0].measure).toBe('배수 상태 보완');
    expect(versions[1].risk?.hazards[1].acceptable).toBe('unknown');
    expect(await user(f.b, 'select id from safety_documents where id=$1', [doc])).toEqual([]);
    expect(await user(f.a, 'select id from safety_activity_records where document_id=$1', [doc])).toEqual([]);
    expect((await user(f.a, 'select review_status,submission_status from safety_documents where id=$1', [doc]))[0]).toEqual({ review_status: 'reopened', submission_status: 'needs_confirmation' });
  });
  it('기존 자료 연결은 동일 현장과 쓰기 권한을 요구하고 원본을 유지한다', async () => {
    const f = await fixture();
    const create = async (u: string, w: string) => (await user<{ id: string }>(u, "select safety_create_document($1,'기존 자료','원본 내용',false) as id", [w]))[0].id;
    const wrong = await create(f.b, f.wb), doc = await create(f.a, f.wa);
    await expect(user(f.a, 'select safety_link_task_document($1,$2,1)', [f.task, wrong])).rejects.toThrow('access_denied');
    await user(f.a, 'select safety_link_task_document($1,$2,1)', [f.task, doc]);
    await expect(user(f.a, 'select safety_link_task_document($1,$2,2)', [f.task, doc])).rejects.toThrow('invalid_state');
    expect((await db.query('select content from safety_document_versions where document_id=$1', [doc])).rows).toEqual([{ content: '원본 내용' }]);
    await db.query('update safety_workplace_access set can_read_sensitive=true where workplace_id=$1 and user_id=$2', [f.wa, f.a]);
    const sensitiveTask = await f.start(f.a, f.wa, 'REVIEW-041', true);
    await expect(user(f.a, 'select safety_link_task_document($1,$2,1)', [sensitiveTask, doc])).rejects.toThrow('record_sensitivity_mismatch');
  });
  it('회원 주장·배정만으로 중앙관제 권한을 만들 수 없다', async () => {
    const f = await fixture();
    const org = (await db.query<{ organization_id: string }>('select organization_id from safety_workplaces where id=$1', [f.wa])).rows[0].organization_id;
    await db.query("insert into safety_reviewer_assignments(organization_id,workplace_id,reviewer_id,expires_at) values($1,$2,$3,now()+interval '1 day')", [org, f.wa, f.op]);
    expect((await user<{ a: { operator: boolean } }>(f.op, 'select safety_portal_access() as a', [], 'aal2'))[0].a.operator).toBe(false);
    expect(await user(f.op, 'select id from safety_tasks where id=$1', [f.task], 'aal2')).toEqual([]);
    await expect(user(f.a, "insert into app_private.safety_operators values($1,'reviewer',true)", [f.a])).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into app_private.safety_operators values($1,'reviewer',true)", [f.a])).rejects.toThrow('separate_operator_account_required');
    await db.query("insert into app_private.safety_operators values($1,'reviewer',true)", [f.op]);
    expect(await user(f.op, 'select id from safety_tasks where id=$1', [f.task])).toEqual([]);
    expect(await user(f.op, 'select id from safety_tasks where id=$1', [f.task], 'aal2')).toHaveLength(1);
    await db.query('update app_private.safety_operators set active=false where user_id=$1', [f.op]);
    expect(await user(f.op, 'select id from safety_tasks where id=$1', [f.task], 'aal2')).toEqual([]);
  });
  it('민감 업무와 탐색 조건의 다른 현장 접근을 차단한다', async () => {
    const f = await fixture();
    await expect(f.start(f.a, f.wa, 'REVIEW-041', true)).rejects.toThrow('access_denied');
    await expect(saveProfile(f.b, f.wa, 1)).rejects.toThrow('access_denied');
    await saveProfile(f.a, f.wa, 1, true, essentials, 0, 'facility');
    expect((await user(f.a, 'select headcount from safety_workplace_profiles where workplace_id=$1', [f.wa]))[0].headcount).toBe(0);
    expect(await user(f.b, 'select * from safety_workplace_profiles where workplace_id=$1', [f.wa])).toEqual([]);
  });
});

describe('사업장 사실 확인과 신규 업무 선행 조건', () => {
  it('프로필 없음·초안은 신규 업무를 막고 확인 후 사진과 계획을 시작한다', async () => {
    const f = await fixture(false);
    await expect(f.start()).rejects.toThrow('profile_required');
    await saveProfile(f.a, f.wa, 0, false, {});
    await expect(f.start()).rejects.toThrow('profile_required');
    for (const key of Object.keys(essentials)) {
      await expect(saveProfile(f.a, f.wa, 1, true, { ...essentials, [key]: ' \n\t ' })).rejects.toThrow('profile_required');
    }
    await saveProfile(f.a, f.wa, 1);
    expect(await f.start()).toBeTruthy();
    expect(await f.start(f.a, f.wa, 'FORM_PLAN')).toBeTruthy();
    for (const id of ['FORM_REGISTRATION', 'REVIEW-001', 'REVIEW-002']) await expect(f.start(f.a, f.wa, id)).rejects.toThrow('profile_required');
  });

  it('0명과 미확인을 구별하고 기간제는 직접고용의 부분집합으로 검증한다', async () => {
    const f = await fixture(false);
    await saveProfile(f.a, f.wa, 0, false, { temporary: 0, dispatched: null, contractors: 8 }, 0);
    expect((await user(f.a, 'select headcount,facts,revision,confirmed_at from safety_workplace_profiles where workplace_id=$1', [f.wa]))[0]).toMatchObject({ headcount: 0, facts: { temporary: 0, dispatched: null, contractors: 8 }, revision: 1, confirmed_at: null });
    await expect(saveProfile(f.a, f.wa, 1, false, { temporary: 1 }, 0)).rejects.toThrow('invalid_state');
    await saveProfile(f.a, f.wa, 1, true, { ...essentials, temporary: 3 }, null);
    expect((await user(f.a, 'select headcount,facts from safety_workplace_profiles where workplace_id=$1', [f.wa]))[0]).toMatchObject({ headcount: null, facts: { temporary: 3, dispatched: null } });
  });

  it('잘못된 업종·작업·사실 JSON·인원·날짜를 원자적으로 거부한다', async () => {
    const f = await fixture(false);
    for (const work of [{}, null, ['made_up'], [1], [null], Array(15).fill('height')]) await expect(saveProfile(f.a, f.wa, 0, false, {}, null, 'all', work)).rejects.toThrow('invalid_state');
    for (const facts of [null, [], 'text', { unknown: true }, { businessName: null }, { actualWork: {} }, { businessName: 'x'.repeat(2001) }, { temporary: -1 }, { contractors: 1000001 }, { dispatched: 1.5 }, { temporary: '0' }, { workReviewed: 'true' }, { contractRole: 'owner' }, { contractRole: null }, { countDate: '2026-02-30' }, { countDate: '2026-9-15' }, { countDate: 2026 }]) await expect(saveProfile(f.a, f.wa, 0, false, facts)).rejects.toThrow('invalid_state');
    for (const count of [-1, 1000001]) await expect(saveProfile(f.a, f.wa, 0, false, {}, count)).rejects.toThrow('invalid_state');
    await expect(saveProfile(f.a, f.wa, 0, false, {}, null, 'invented')).rejects.toThrow('invalid_state');
    await expect(user(f.a, profileSql, [f.wa, 'all', null, '[]', '{}', 0, null])).rejects.toThrow('invalid_state');
    expect(await user(f.a, 'select * from safety_workplace_profiles where workplace_id=$1', [f.wa])).toEqual([]);
    expect((await db.query("select id from safety_audit_events where workplace_id=$1 and action='task_profile_saved'", [f.wa])).rows).toEqual([]);
  });

  it('오래된 revision 저장을 거부하고 모든 이전 사실과 확인 시점을 보존한다', async () => {
    const f = await fixture(false);
    await saveProfile(f.a, f.wa, 0, true, { ...essentials, countDate: '2026-09-15', temporary: 0 }, 0);
    const first = (await db.query<{ value: unknown }>('select to_jsonb(p) as value from safety_workplace_profiles p where workplace_id=$1', [f.wa])).rows[0].value;
    await expect(saveProfile(f.a, f.wa, 0)).rejects.toThrow('revision_conflict');
    await expect(user(f.a, profileSql, [f.wa, 'all', null, '[]', '{}', null, false])).rejects.toThrow('revision_conflict');
    await saveProfile(f.a, f.wa, 1, false, { ...essentials, actualWork: '변경한 작업' }, 5, 'facility', ['machine']);
    const second = (await db.query<{ value: unknown }>('select to_jsonb(p) as value from safety_workplace_profiles p where workplace_id=$1', [f.wa])).rows[0].value;
    const audit = (await db.query<{ details: { before: unknown; after: unknown } }>("select details from safety_audit_events where workplace_id=$1 and action='task_profile_saved' order by (details->'after'->>'revision')::integer", [f.wa])).rows;
    expect(audit).toEqual([{ details: { before: null, after: first } }, { details: { before: first, after: second } }]);
    expect(second).toMatchObject({ revision: 2, confirmed_at: null });
    await expect(f.start()).rejects.toThrow('profile_required');
  });

  it('직접 쓰기·구 RPC·다른 조직·읽기 전용·비활성 구성원의 우회를 차단한다', async () => {
    const f = await fixture(false);
    await expect(saveProfile(f.b, f.wa)).rejects.toThrow('access_denied');
    await expect(user(f.a, "insert into safety_workplace_profiles(workplace_id,confirmed_at) values($1,now())", [f.wa])).rejects.toThrow(/permission denied/);
    await expect(user(f.a, "select safety_save_workplace_profile($1,'all',0,'[]')", [f.wa])).rejects.toThrow(/does not exist/);
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('anon','public.safety_save_workplace_profile(uuid,text,integer,jsonb,jsonb,integer,boolean)','EXECUTE') as allowed")).rows[0].allowed).toBe(false);
    await saveProfile(f.a, f.wa);
    await expect(user(f.a, 'update safety_workplace_profiles set confirmed_at=now() where workplace_id=$1', [f.wa])).rejects.toThrow(/permission denied/);
    await db.query('update safety_workplace_access set can_write=false where workplace_id=$1 and user_id=$2', [f.wa, f.a]);
    await expect(saveProfile(f.a, f.wa, 1)).rejects.toThrow('access_denied');
    await expect(f.start()).rejects.toThrow('access_denied');
    await db.query('update safety_workplace_access set can_write=true where workplace_id=$1 and user_id=$2', [f.wa, f.a]);
    await db.query('update safety_memberships set active=false where user_id=$1', [f.a]);
    await expect(saveProfile(f.a, f.wa, 1)).rejects.toThrow('access_denied');
    await expect(f.start()).rejects.toThrow('access_denied');
    expect(await user(f.a, 'select * from safety_workplace_profiles where workplace_id=$1', [f.wa])).toEqual([]);
  });

  it('기존 프로필 기본값은 미확인이며 과거 설정 업무 읽기·수정은 유지한다', async () => {
    const f = legacy;
    expect((await user(f.a, 'select revision,confirmed_at from safety_workplace_profiles where workplace_id=$1', [f.wa]))[0]).toEqual({ revision: 0, confirmed_at: null });
    await expect(f.start()).rejects.toThrow('profile_required');
    const old = f.task;
    expect(await f.start(f.a, f.wa, 'FORM_REGISTRATION')).toBe(old);
    expect(await user(f.a, 'select id from safety_tasks where id=$1', [old])).toEqual([{ id: old }]);
    await user(f.a, "select safety_save_task($1,1,null,'기존 담당자',null,'과거 업무 보완')", [old]);
    expect((await user(f.a, 'select revision,document_id from safety_tasks where id=$1', [old]))[0]).toMatchObject({ revision: 2, document_id: expect.any(String) });
    await saveProfile(f.a, f.wa);
    expect(await f.start()).toBeTruthy();
  });
});
