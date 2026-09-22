import { describe, expect, it } from 'vitest';
import { currentTasks, taskCycleLabel } from '@/domain/task-cycles';
import type { TaskRecord } from '@/domain/tasks';

const task = (id: string, cycle_number?: number, workplace_id = 'a', definition_id = 'REVIEW-003'): TaskRecord => ({ id, workplace_id, definition_id, definition_version: '1', title: '평가', category: 'management', document_id: null, sensitive: false, owner: '', target_date: null, revision: 1, review_status: 'not_requested', cycle_number });
describe('현재 평가 회차의 선택', () => {
  it('현장·업무별 최신 번호를 선택하며 원본 목록과 순서에 의존하지 않는다', () => {
    const tasks = [task('a3', 3), task('b1', 1, 'b'), task('a1'), task('photo', 1, 'a', 'FORM_PHOTO'), task('a2', 2)];
    expect(currentTasks(tasks).map(t => t.id)).toEqual(['a3', 'b1', 'photo']);
    expect(tasks).toHaveLength(5);
    expect(taskCycleLabel(tasks[2])).toBe('1회차');
    expect(taskCycleLabel(tasks[3])).toBe('');
  });
});
