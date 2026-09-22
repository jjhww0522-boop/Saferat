import { describe, expect, it } from 'vitest';
import { summarizeTaskSource, taskActionSourceSchema } from '@/domain/task-action-source';
import { sourceCases } from '../fixtures/task-action-source-cases';

describe('저장 버전의 다음 행동 원천 요약', () => {
  it('저장본이 없으면 버전이나 위험정보를 생성하지 않는다', () => {
    expect(summarizeTaskSource('task', undefined)).toEqual({ task_id: 'task', version: null, confirmed_at: null, risk: null });
  });
  it.each(sourceCases)('$name', ({ content, risk }) => {
    const result = summarizeTaskSource('task', { number: 3, content, confirmed_at: null });
    expect(result).toEqual({ task_id: 'task', version: 3, confirmed_at: null, risk });
    expect(taskActionSourceSchema.safeParse(result).success).toBe(true);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_BODY');
  });
  it('저장본의 확인 상태만 보존하고 수행·법적 완료를 추가하지 않는다', () => {
    const confirmed_at = '2026-09-17T03:00:00Z';
    expect(summarizeTaskSource('task', { number: 2, content: sourceCases[3].content, confirmed_at })).toEqual({ task_id: 'task', version: 2, confirmed_at, risk: sourceCases[3].risk });
  });
});
