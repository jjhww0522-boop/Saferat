import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

let db: PGlite;
async function user<T = { value: string | null }>(id: string, sql: string, values: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, aal: 'aal1' })]);
    return (await tx.query<T>(sql, values)).rows;
  });
}
async function fixture() {
  const member = crypto.randomUUID(), other = crypto.randomUUID();
  for (const id of [member, other]) await db.query('insert into auth.users values($1,$2,now())', [id, `${id}@example.test`]);
  const workplace = (await user(member, "select safety_create_workspace('시험 조직','시험 현장') as value"))[0].value!;
  await user(member, 'select safety_save_workplace_profile($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)', [workplace, 'facility', 3, '[]', JSON.stringify({ businessName: '시험', actualAddress: '시험 주소', actualWork: '시설 유지관리' }), 0, true]);
  const task = (await user(member, "select safety_start_task($1,'REVIEW-003',false) as value", [workplace]))[0].value!;
  return { member, other, workplace, task };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8'));
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, dir), 'utf8'));
});
afterAll(async () => { await db?.close(); });

describe('위험요인 위치의 DB 저장과 권한 경계', () => {
  it('이전 커서와 안정 ID를 저장하되 업무·버전·수행 기록은 바꾸지 않는다', async () => {
    const f = await fixture();
    const before = await db.query('select * from safety_tasks where id=$1', [f.task]);
    for (const cursor of ['risk:4:1', 'risk:4:1:second', 'risk:2:0:현장:위험-1', 'risk:5:0:already-removed']) {
      expect((await user(f.member, 'select safety_journey_state($1,$2,$3) as value', [f.workplace, f.task, cursor]))[0].value).toBe(cursor);
      expect((await user(f.member, 'select safety_journey_state($1,$2) as value', [f.workplace, f.task]))[0].value).toBe(cursor);
    }
    expect((await db.query('select * from safety_tasks where id=$1', [f.task])).rows).toEqual(before.rows);
    expect((await db.query('select id from safety_document_versions')).rows).toEqual([]);
    expect((await db.query('select id from safety_activity_records')).rows).toEqual([]);
  });
  it('잘못된 단계·빈 ID·초과 ID·다른 용도의 위치 저장을 거절한다', async () => {
    const f = await fixture();
    for (const cursor of ['risk:7:0', 'risk:2:1', 'risk:4:2', 'risk:4:1:', `risk:4:1:${'a'.repeat(81)}`, 'profile:1']) {
      await expect(user(f.member, 'select safety_journey_state($1,$2,$3)', [f.workplace, f.task, cursor])).rejects.toThrow('invalid_state');
    }
    await expect(user(f.member, 'select safety_journey_state($1,$2,$3)', [f.workplace, 'profile', 'risk:4:1:second'])).rejects.toThrow('invalid_state');
  });
  it('다른 사용자·현장·민감자료 권한과 직접 테이블 접근을 차단한다', async () => {
    const f = await fixture();
    await user(f.member, 'select safety_journey_state($1,$2,$3)', [f.workplace, f.task, 'risk:4:1:second']);
    await expect(user(f.other, 'select safety_journey_state($1,$2)', [f.workplace, f.task])).rejects.toThrow('access_denied');
    await expect(user(f.other, 'select safety_journey_state($1,$2,$3)', [f.workplace, f.task, 'risk:2:0:first'])).rejects.toThrow('access_denied');
    await expect(user(f.member, 'select * from app_private.safety_journey_positions')).rejects.toThrow(/permission denied/);
    await db.query('update safety_tasks set sensitive=true where id=$1', [f.task]);
    await db.query('update safety_workplace_access set can_read_sensitive=false where user_id=$1', [f.member]);
    await expect(user(f.member, 'select safety_journey_state($1,$2)', [f.workplace, f.task])).rejects.toThrow('access_denied');
  });
});
