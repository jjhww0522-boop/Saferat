import { describe, expect, it } from 'vitest';
import { homeTaskActions, taskActionSummary } from '@/domain/task-actions';
import { emptyProfile, type TaskRecord } from '@/domain/tasks';
import type { TaskActionSource } from '@/domain/task-action-source';

const task: TaskRecord = { id: 'risk-task', workplace_id: 'facility', definition_id: 'REVIEW-003', definition_version: '1', title: '위험성평가', category: 'management', document_id: 'doc', sensitive: false, owner: '', target_date: '2026-09-01', revision: 1, review_status: 'not_requested' };
const source: TaskActionSource = { task_id: task.id, version: 2, confirmed_at: null, risk: { state: 'available', improvement_count: 1, next_due_on: '2026-09-10' } };
const today = '2026-09-17';
describe('홈 다음 행동은 저장 사실과 작업 상태를 구분한다', () => {
  it('새 회차를 시작해도 지난 개선·보완·미확인 판단은 남기고 옛 준비 목표는 중복 계산하지 않는다', () => {
    const current = { ...task, id: 'cycle2', cycle_number: 2, target_date: null, document_id: null };
    const actions = homeTaskActions([task, current], [source], emptyProfile, 'facility', '/app', today);
    expect(actions.find(a => a.id === task.id)).toMatchObject({ title: '지난 1회차 · 위험성평가', action: '지난 기록 확인', href: '/app/tasks/risk-task#stored-record', priority: 0 });
    expect(actions.some(a => a.id === current.id)).toBe(true);
    const resolved = homeTaskActions([task, current], [{ ...source, risk: { state: 'available', improvement_count: 0, next_due_on: null } }], emptyProfile, 'facility', '/app', today);
    expect(resolved.some(a => a.id === task.id)).toBe(false);
    const unknown = homeTaskActions([{ ...task, review_status: 'reviewed' }, current], [{ ...source, confirmed_at: '2026-09-21T00:00:00Z', risk: null, journey: { definition_version: 1, ready_steps: null, unknown_count: 1 } }], emptyProfile, 'facility', '/app', today);
    expect(unknown.find(a => a.id === task.id)).toMatchObject({ needsAttention: true, priority: 4, dueOn: null });
    expect(unknown.find(a => a.id === task.id)?.reason).toContain('위험 판단 미확인 1건');
  });
  it.each(['queued', 'reviewed', 'changes_requested'])('%s여도 미해결 조치·기한을 유지한다', status => {
    const action = taskActionSummary({ ...task, review_status: status }, source, '/app', today);
    expect(action.priority).toBe(0);
    expect(action.reason).toContain('2026-09-10 경과');
    expect(action.needsAttention).toBe(true);
    expect(action.version).toBe(2);
    expect(action.confirmed).toBe(false);
    expect(action.href).toContain(status === 'queued' ? '#stored-record' : 'step=improve#task-editor');
  });
  it('개선, 보완, 경과한 준비, 임박한 준비, 미확인 정보, 초안 순으로 안내한다', () => {
    const tasks = [task, { ...task, id: 'feedback', definition_id: 'REVIEW-004', review_status: 'changes_requested' }, { ...task, id: 'overdue', definition_id: 'REVIEW-005' }, { ...task, id: 'soon', definition_id: 'FORM_PHOTO', target_date: today }, { ...task, id: 'draft', definition_id: 'FORM_PLAN', target_date: null }];
    const actions = homeTaskActions(tasks, [source], emptyProfile, 'facility', '/app', today);
    expect(actions.map(a => a.id)).toEqual(['risk-task', 'feedback', 'overdue', 'soon', 'workplace-information', 'draft']);
    expect(actions.find(a => a.id === 'workplace-information')?.href).toContain('setup=1&focus=registration');
  });
  it('검토 완료에 준비 목표일 경고를 되살리지 않고 조치 없는 자료는 이력으로 연결한다', () => {
    const action = taskActionSummary({ ...task, review_status: 'reviewed' }, { ...source, risk: null, confirmed_at: '2026-09-17T00:00:00Z' }, '/workspace', today);
    expect(action.needsAttention).toBe(false);
    expect(action.action).toBe('저장한 기록 확인');
    expect(action.confirmed).toBe(true);
    expect(action.href).toBe('/workspace/tasks/risk-task#stored-record');
  });
  it('미지원 저장 형식을 완료로 숨기지 않는다', () => {
    const action = taskActionSummary({ ...task, target_date: null, review_status: 'reviewed' }, { ...source, risk: { state: 'unreadable', improvement_count: 0, next_due_on: null } }, '/app', today);
    expect(action.needsAttention).toBe(true);
    expect(action.reason).toContain('집계할 수 없습니다');
  });
  it.each(['queued', 'reviewed'])('병행 조회 중 %s 상태와 미확인 새 버전이 섞이면 후속 항목을 유지한다', status => {
    const action = taskActionSummary({ ...task, target_date: null, review_status: status }, { ...source, risk: null }, '/app', today);
    expect(action.needsAttention).toBe(true);
    expect(action.action).toBe('저장 상태 다시 확인');
  });
});
