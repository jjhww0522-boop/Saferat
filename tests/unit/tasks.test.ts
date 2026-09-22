import { describe, expect, it } from 'vitest';
import { taskDefinitions, taskDefinition, readTaskForm, parseTaskContent, profileInput, taskUrgency, seoulDate, storedAnswerLabel, taskAnswerQuestions } from '@/domain/tasks';
describe('업무 기록과 자료 준비 목표일', () => {
  const now = new Date('2026-09-14T15:10:00Z');
  it('한국 날짜로 당일·7일·경과를 구분한다', () => {
    expect(seoulDate(now)).toBe('2026-09-15');
    expect(taskUrgency('2026-09-14', 'not_requested', now)).toBe('overdue');
    expect(taskUrgency('2026-09-15', 'not_requested', now)).toBe('soon');
    expect(taskUrgency('2026-09-22', 'not_requested', now)).toBe('soon');
    expect(taskUrgency('2026-09-23', 'not_requested', now)).toBe('normal');
  });
  it('미정·잘못된 날짜와 준비를 마친 자료에 기한 경고를 만들지 않는다', () => {
    expect(taskUrgency(null, 'changes_requested', now)).toBe('normal');
    expect(taskUrgency('2026-02-30', 'not_requested', now)).toBe('normal');
    for (const state of ['queued', 'reviewed']) expect(taskUrgency('2026-09-01', state, now)).toBe('normal');
  });
  it('빈 입력에서 참석·일정·예산이나 문서 내용을 만들어 저장하지 않는다', () => {
    expect(readTaskForm(taskDefinition('FORM_PLAN')!, new FormData())).toBeNull();
    const form = new FormData(); form.set('objective', '직접 확인한 작업부터 정리');
    const content = parseTaskContent(readTaskForm(taskDefinition('FORM_PLAN')!, form)!)!;
    expect(content.fields.budget).toBe(''); expect(content.fields.responsible).toBe('');
  });
  it('78개 검토 후보와 자체 서식 3종의 기록을 구분한다', () => {
    expect(taskDefinitions.filter(d => d.template === 'common')).toHaveLength(78);
    expect(new Set(taskDefinitions.map(d => d.id)).size).toBe(81);
    expect(taskDefinition('DEMO_APPROVED_LEGAL')).toBeUndefined();
  });
  it('내용은 형식 검증하고 0명과 미응답을 유지한다', () => {
    expect(parseTaskContent('{"format":"unknown"}')).toBeNull();
    expect(profileInput.parse({ industry: 'all', headcount: 0, work: [] }).headcount).toBe(0);
    expect(profileInput.parse({ industry: 'all', headcount: null, work: [] }).headcount).toBeNull();
    expect(profileInput.safeParse({ industry: 'invented', headcount: -1, work: [] }).success).toBe(false);
    const form = new FormData(); form.set('notes', 'a'.repeat(4001));
    expect(() => readTaskForm(taskDefinition('REVIEW-001')!, form)).toThrow();
  });
  it('새 답변에 당시 질문·버전을 보관하고 질문 변경 뒤에도 의미를 유지한다', () => {
    const definition = taskDefinition('FORM_PHOTO')!;
    const form = new FormData(); form.set('answer-0', '직접 확인했습니다');
    const first = readTaskForm(definition, form)!;
    const stored = parseTaskContent(first)!;
    expect(storedAnswerLabel(stored, 0)).toBe(definition.checks[0]);
    const revised = parseTaskContent(readTaskForm({ ...definition, version: 'next', checks: ['전혀 다른 질문'] }, form, first)!)!;
    expect(revised.questions).toEqual(stored.questions);
    expect(revised.answers).toEqual(stored.answers);
  });
  it('과거 질문 원문이 없는 답변에 현재 질문을 임의로 붙이지 않는다', () => {
    const legacy = JSON.stringify({ format: 'task-record-v1', definition: 'FORM_PHOTO', answers: ['과거 답변'], fields: {}, notes: '' });
    const form = new FormData(); form.set('answer-0', '과거 답변을 확인');
    const stored = parseTaskContent(readTaskForm(taskDefinition('FORM_PHOTO')!, form, legacy)!)!;
    expect(stored.questions?.[0].label).toBeNull();
    expect(storedAnswerLabel(stored, 0)).toContain('당시 질문 원문 미보관');
  });
  it('첫 입력 도중 질문이 변경되면 새 질문에 기존 답변을 붙여 저장하지 않는다', () => {
    const definition = taskDefinition('FORM_PHOTO')!;
    const form = new FormData(); form.set('answer-0', '열었을 때 보았던 질문의 답변');
    expect(() => readTaskForm(definition, form, undefined, true)).toThrow('questions_changed');
    form.set('questions_context', JSON.stringify(taskAnswerQuestions(definition, null)));
    expect(readTaskForm(definition, form, undefined, true)).not.toBeNull();
    expect(() => readTaskForm({ ...definition, version: 'next', checks: ['변경된 질문'] }, form, undefined, true)).toThrow('questions_changed');
  });
});
