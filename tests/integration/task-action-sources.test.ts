import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { summarizeTaskSource, summarizeJourneySource, type TaskActionSource } from '../../src/domain/task-action-source';
import { emptyRiskAssessment, emptyRiskHazard } from '../../src/domain/risk-assessment';
import { riskContent, sourceCases } from '../fixtures/task-action-source-cases';

let db: PGlite;
async function user<T = Record<string, unknown>>(id: string, sql: string, values: unknown[] = [], aal = 'aal1') {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, aal })]);
    return (await tx.query<T>(sql, values)).rows;
  });
}
async function fixture(sensitive = false) {
  const a = crypto.randomUUID(), b = crypto.randomUUID(), op = crypto.randomUUID();
  for (const id of [a, b, op]) await db.query('insert into auth.users values($1,$2,now())', [id, `${id}@example.test`]);
  const wa = (await user<{ id: string }>(a, "select safety_create_workspace('시험 조직','시험 현장') as id"))[0].id;
  const organization = (await db.query<{ id: string }>('select organization_id as id from safety_workplaces where id=$1', [wa])).rows[0].id;
  await user(a, 'select safety_save_workplace_profile($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)', [wa, 'facility', 3, '[]', JSON.stringify({ businessName: '시험', actualAddress: '시험 주소', actualWork: '시설 유지관리' }), 0, true]);
  if (sensitive) await db.query('update safety_workplace_access set can_read_sensitive=true where user_id=$1', [a]);
  const task = (await user<{ id: string }>(a, "select safety_start_task($1,'REVIEW-003',$2) as id", [wa, sensitive]))[0].id;
  const emptyTask = (await user<{ id: string }>(a, "select safety_start_task($1,'FORM_PHOTO',false) as id", [wa]))[0].id;
  const content = riskContent([{ ...emptyRiskHazard('a'), acceptable: 'no', dueOn: '2026-09-10' }]);
  const document = (await user<{ id: string }>(a, "select safety_save_task($1,1,null,'',null,$2) as id", [task, content]))[0].id;
  await db.query("insert into app_private.safety_operators values($1,'reviewer',true)", [op]);
  await db.query("insert into safety_reviewer_assignments(organization_id,workplace_id,reviewer_id,expires_at) values($1,$2,$3,now()+interval '1 day')", [organization, wa, op]);
  const sources = async (actor = a, aal = 'aal1') => (await user<{ value: TaskActionSource[] }>(actor, 'select safety_task_action_sources($1) as value', [wa], aal))[0].value;
  return { a, b, op, wa, organization, task, emptyTask, document, content, sources };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8'));
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, dir), 'utf8'));
});
afterAll(async () => { await db?.close(); });

describe('홈 행동 원천의 DB 요약·권한 경계', () => {
  it('JSONB가 표현할 수 없는 본문 하나가 현장 전체 요약을 중단하지 않는다', async () => {
    const f = await fixture();
    const content = '{"risk":"\\u0000"}';
    await user(f.a, 'select safety_new_version($1,1,$2)', [f.document, content]);
    const rows = await f.sources();
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.task_id === f.task)).toMatchObject({ risk: { state: 'unreadable' }, journey: { ready_steps: null, unknown_count: null } });
    expect(rows.find(row => row.task_id === f.emptyTask)?.version).toBeNull();
    const versions = (await db.query<{ content: string }>('select content from safety_document_versions where document_id=$1 order by number desc', [f.document])).rows;
    expect(versions.map(version => version.content)).toEqual([content, f.content]);
    const large = (await db.query<{ value: TaskActionSource['risk'] }>('select app_private.safety_task_risk_source($1) as value', ['{"risk":1e999999}'])).rows[0].value;
    expect(large?.state).toBe('unreadable');
  });
  it('갖춘 일곱 단계와 보완으로 돌아간 단계를 SQL·상세에서 같은 기준으로 읽는다', async () => {
    const day = '2026-09-18';
    const risk = { ...emptyRiskAssessment(), kind: 'initial', scope: '시험 작업', assessor: '시험 담당', plannedOn: day, criteria: '참여자가 정한 기준', learningStatus: 'sufficient', learningBasis: '확인한 경험',
      announcedOn: day, announcementPeople: '작업자', announcementNote: '일정 안내', participationOn: day, participants: '작업자', workerOpinion: '작업 의견', representativeRequested: 'no', participationMethod: 'walkthrough',
      startedOn: day, finishedOn: day, sharedOn: day, sharedPeople: '작업자', sharedNote: '결과 설명', reviewTrigger: '작업 변경', storageNote: '시험 보관 장소',
      hazards: [{ ...emptyRiskHazard('ready'), work: '작업', location: '장소', hazard: '위험', people: '작업자', existingControls: '조치', level: 'low', acceptable: 'yes', decisionReason: '확인한 기준' }] };
    const check = async () => {
      const content = JSON.stringify({ format: 'task-record-v1', definition: 'REVIEW-003', risk });
      const result = (await db.query<{ value: TaskActionSource['journey'] }>('select app_private.safety_journey_risk($1) as value', [content])).rows[0].value;
      expect(result).toEqual(summarizeJourneySource('t', { number: 1, content, confirmed_at: null }).journey);
      return result!;
    };
    expect((await check()).ready_steps).toEqual(Array(7).fill(true));
    risk.hazards[0].residualAcceptable = 'no';
    expect((await check()).ready_steps).toEqual([true, true, true, true, false, false, false]);
    risk.workerOpinion = ' \u3000';
    expect((await check()).ready_steps?.[1]).toBe(false);
  });
  it.each(sourceCases)('SQL과 순수함수 의미 일치: $name', async ({ content, risk }) => {
    const result = (await db.query<{ risk: TaskActionSource['risk'] }>('select app_private.safety_task_risk_source($1) as risk', [content])).rows[0].risk;
    expect(result).toEqual(risk);
    expect(result).toEqual(summarizeTaskSource('task', { number: 1, content, confirmed_at: null }).risk);
    const journey = (await db.query<{ value: unknown }>('select app_private.safety_journey_risk($1) as value', [content])).rows[0].value;
    expect(journey).toEqual(summarizeJourneySource('task', { number: 1, content, confirmed_at: null }).journey);
  });
  it('최신 저장본만 집계하고 전체 목록 조회에 요약 감사 한 건만 남긴다', async () => {
    const f = await fixture();
    await user(f.a, 'select safety_new_version($1,1,$2)', [f.document, riskContent([{ ...emptyRiskHazard('new'), measure: 'PRIVATE_MEASURE', dueOn: '2026-09-20' }, { ...emptyRiskHazard('other'), residualAcceptable: 'no' }])]);
    const result = await f.sources();
    expect(result).toHaveLength(2);
    expect(result.find(s => s.task_id === f.task)).toMatchObject({ task_id: f.task, version: 2, confirmed_at: null, risk: { state: 'available', improvement_count: 2, next_due_on: '2026-09-20' }, journey: { definition_version: 1, ready_steps: Array(7).fill(false), unknown_count: 2 } });
    expect(result.find(s => s.task_id === f.emptyTask)).toMatchObject({ task_id: f.emptyTask, version: null, confirmed_at: null, risk: null, journey: { definition_version: 1, ready_steps: null, unknown_count: null } });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect((await db.query("select action,details from safety_audit_events where workplace_id=$1 and action in ('task_action_sources_read','version_read')", [f.wa])).rows).toEqual([{ action: 'task_action_sources_read', details: { task_count: 2 } }]);
    expect((await db.query('select id from safety_activity_records where document_id=$1', [f.document])).rows).toEqual([]);
  });
  it('읽기 전용 회원도 조회하지만 타 고객·미허용 현장·철회 소속은 거부한다', async () => {
    const f = await fixture();
    await db.query('update safety_workplace_access set can_write=false where user_id=$1', [f.a]);
    expect(await f.sources()).toHaveLength(2);
    await expect(f.sources(f.b)).rejects.toThrow('access_denied');
    const other = crypto.randomUUID();
    await db.query("insert into safety_workplaces(id,organization_id,name) values($1,$2,'다른 현장')", [other, f.organization]);
    await expect(user(f.a, 'select safety_task_action_sources($1)', [other])).rejects.toThrow('access_denied');
    await db.query('update safety_memberships set active=false where user_id=$1', [f.a]);
    await expect(f.sources()).rejects.toThrow('access_denied');
    await expect(db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query('select safety_task_action_sources($1)', [f.wa]); })).rejects.toThrow(/permission denied/);
  });
  it('민감자료 범위와 검토자 배정·MFA·만료를 모두 지킨다', async () => {
    const f = await fixture(true);
    expect(await f.sources()).toHaveLength(2);
    await db.query('update safety_workplace_access set can_read_sensitive=false where user_id=$1', [f.a]);
    expect((await f.sources()).map(s => s.task_id)).toEqual([f.emptyTask]);
    await expect(f.sources(f.op)).rejects.toThrow('access_denied');
    expect((await f.sources(f.op, 'aal2')).map(s => s.task_id)).toEqual([f.emptyTask]);
    await db.query('update safety_reviewer_assignments set can_read_sensitive=true where reviewer_id=$1', [f.op]);
    expect(await f.sources(f.op, 'aal2')).toHaveLength(2);
    await db.query("update safety_reviewer_assignments set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where reviewer_id=$1", [f.op]);
    await expect(f.sources(f.op, 'aal2')).rejects.toThrow('access_denied');
  });
  it('확인·검토 대기·검토 완료가 미해결 개선정보를 없애지 않는다', async () => {
    const f = await fixture();
    const version = (await db.query<{ id: string }>('select id from safety_document_versions where document_id=$1', [f.document])).rows[0].id;
    await user(f.a, 'select safety_confirm_version($1,1)', [version]);
    const review = (await user<{ id: string }>(f.a, 'select safety_request_review($1,2) as id', [version]))[0].id;
    const queued = (await f.sources()).find(s => s.task_id === f.task)!;
    expect(queued.confirmed_at).toBeTruthy();
    expect(queued.risk?.improvement_count).toBe(1);
    await user(f.op, "select safety_decide_review($1,3,'reviewed','','','PRIVATE_INTERNAL_NOTE')", [review], 'aal2');
    const reviewed = (await f.sources()).find(s => s.task_id === f.task)!;
    expect(reviewed.risk).toEqual(queued.risk);
    expect(reviewed.journey).toEqual(queued.journey);
    expect(queued.task_snapshot?.review_status).toBe('queued');
    expect(reviewed.task_snapshot?.review_status).toBe('reviewed');
  });
  it('요약용 private 함수와 원문 열람 우회를 일반 사용자에게 열지 않는다', async () => {
    const f = await fixture();
    await expect(user(f.a, 'select app_private.safety_task_risk_source($1)', [f.content])).rejects.toThrow(/permission denied/);
    await expect(user(f.a, 'select content from safety_document_versions where document_id=$1', [f.document])).rejects.toThrow(/permission denied/);
  });
  it('안내 위치는 사용자·현장·업무 권한을 지키고 기록·수행을 변경하지 않는다', async () => {
    const f = await fixture(true);
    expect((await user<{ value: string }>(f.a, 'select safety_journey_state($1,$2,$3) as value', [f.wa, f.task, 'risk:4:1']))[0].value).toBe('risk:4:1');
    expect((await user<{ value: string }>(f.a, 'select safety_journey_state($1,$2) as value', [f.wa, f.task]))[0].value).toBe('risk:4:1');
    await user(f.a, 'select safety_journey_state($1,$2,$3)', [f.wa, 'profile', 'profile:2']);
    await expect(user(f.b, 'select safety_journey_state($1,$2)', [f.wa, f.task])).rejects.toThrow('access_denied');
    await expect(user(f.a, 'select safety_journey_state($1,$2,$3)', [f.wa, f.emptyTask, 'risk:1:0'])).rejects.toThrow('access_denied');
    await expect(user(f.a, 'select safety_journey_state($1,$2,$3)', [f.wa, 'profile', 'risk:1:0'])).rejects.toThrow('invalid_state');
    expect((await db.query('select id from safety_activity_records where document_id=$1', [f.document])).rows).toEqual([]);
    expect((await db.query('select number from safety_document_versions where document_id=$1', [f.document])).rows).toEqual([{ number: 1 }]);
    await db.query('update safety_workplace_access set can_read_sensitive=false where user_id=$1', [f.a]);
    await expect(user(f.a, 'select safety_journey_state($1,$2)', [f.wa, f.task])).rejects.toThrow('access_denied');
    await expect(user(f.a, 'select * from app_private.safety_journey_positions')).rejects.toThrow(/permission denied/);
  });
});
