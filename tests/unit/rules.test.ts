import { describe, it, expect } from 'vitest';
import { and, or, evaluate } from '@/domain/rules';
import { readConfig } from '@/domain/config';
import type { Rule, Snapshot } from '@/domain/types';
const snapshot = (value: number | null, confirmed = true): Snapshot => ({ id: 'test-snapshot', recordedAt: '2026-09-14T00:00:00Z', confirmedAt: null, facts: { count: { value, confirmed, source: 'sample' } } });
const rule: Rule = { id: 'DEMO_TEST_ONLY', version: '1', title: '합성 경계 시험', kind: 'demo', status: 'draft', productionEligible: false, sourceRefs: [], condition: { op: 'gte', fact: 'count', value: 10 } };
describe('확정·미확정 판정', () => {
  it.each([0, 4, 5, 20, 50, 500, 501])('인원 %i를 구간으로 바꾸지 않고 보존', value => {
    const input = snapshot(value);
    expect(input.facts.count.value).toBe(value);
    expect(evaluate(rule, input, input.recordedAt).applicability).toBe(value >= 10 ? 'applicable' : 'not_applicable');
  });
  it('미응답과 미확인은 비적용이 되지 않음', () => {
    for (const input of [snapshot(null), snapshot(0, false)]) expect(evaluate(rule, input, input.recordedAt).applicability).toBe('needs_review');
    expect(evaluate(rule, snapshot(0), '2026-09-14').applicability).toBe('not_applicable');
  });
  it.each([
    ['lt', [true, false, false]], ['lte', [true, true, false]], ['gt', [false, false, true]], ['gte', [false, true, true]],
  ] as const)('%s 합성 임계값 N-1/N/N+1', (op, expected) => {
    [9, 10, 11].forEach((value, i) => expect(evaluate({ ...rule, condition: { op, fact: 'count', value: 10 } }, snapshot(value), '2026-09-14').applicability).toBe(expected[i] ? 'applicable' : 'not_applicable'));
  });
  it('3값 논리 truth table을 지킴', () => {
    expect(and([false, 'unknown'])).toBe(false); expect(and([true, 'unknown'])).toBe('unknown'); expect(and([true, true])).toBe(true);
    expect(or([true, 'unknown'])).toBe(true); expect(or([false, 'unknown'])).toBe('unknown'); expect(or([false, false])).toBe(false);
    const unknownNot = { ...rule, condition: { op: 'not' as const, arg: rule.condition } };
    expect(evaluate(unknownNot, snapshot(null), '2026-09-14').applicability).toBe('needs_review');
  });
  it('같은 스냅샷·규칙·시점의 결과와 trace 재현', () => {
    expect(evaluate(rule, snapshot(20), '2026-09-14')).toEqual(evaluate(rule, snapshot(20), '2026-09-14'));
  });
  it('체험 규칙은 live에서 차단하고 조사 미검증을 비적용으로 숨기지 않음', () => {
    expect(evaluate(rule, snapshot(0), '2026-09-14', 'live').applicability).toBe('needs_review');
    expect(evaluate(rule, snapshot(0), '2026-09-14', 'demo', false).applicability).toBe('needs_review');
    expect(evaluate({ ...rule, kind: 'legal' }, snapshot(0), '2026-09-14').applicability).toBe('needs_review');
  });
  it('다른 작업 사실은 관련 조건에만 반영', () => {
    const input = snapshot(20);
    input.facts.unrelated = { value: false, confirmed: true, source: 'sample' };
    const before = evaluate(rule, input, '2026-09-14');
    input.facts.unrelated.value = true;
    expect(evaluate(rule, input, '2026-09-14')).toEqual(before);
  });
});
describe('명시적 실행 설정', () => {
  it('키 없이 demo/mock 기본값', () => expect(readConfig({})).toEqual({ app: 'demo', ai: 'mock', ocr: 'mock' }));
  it.each([{ APP_MODE: 'live' }, { APP_MODE: 'typo' }, { AI_MODE: 'live' }, { OCR_MODE: 'live' }])('미연동 live·잘못된 모드 거부 %j', env => expect(() => readConfig(env)).toThrow());
});
