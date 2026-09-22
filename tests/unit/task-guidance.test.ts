import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { taskDefinitions, taskDefinition } from '@/domain/tasks';
import { reviewCandidates, catalogCsv } from '@/domain/review-catalog';
import { guidedTaskIds, taskGuidance } from '@/domain/task-guidance';
import { TaskGuidance } from '@/components/task-guidance';

const guide = (id: string) => taskGuidance(taskDefinition(id)!)!;

describe('초보 담당자 실행 안내', () => {
  it('현재 후보 78개와 핵심 서식 3개를 누락·유령 ID 없이 안내한다', () => {
    expect(reviewCandidates).toHaveLength(78);
    expect(taskDefinitions).toHaveLength(81);
    expect([...guidedTaskIds].sort()).toEqual(taskDefinitions.map(item => item.id).sort());
    for (const definition of taskDefinitions) {
      const result = taskGuidance(definition)!;
      expect(result, definition.id).toBeDefined();
      expect(result.goal.length).toBeGreaterThan(10);
      expect(result.firstAction.length).toBeGreaterThan(15);
      for (const field of ['steps', 'evidence', 'done', 'help'] as const) {
        expect(result[field].length, `${definition.id} ${field}`).toBeGreaterThanOrEqual(2);
        expect(result[field].every(text => text.trim().length > 10)).toBe(true);
      }
    }
  });

  it('항목마다 첫 행동과 실제 증빙 예시가 다르다', () => {
    const guides = taskDefinitions.map(item => taskGuidance(item)!);
    expect(new Set(guides.map(item => item.firstAction)).size).toBe(81);
    expect(new Set(guides.map(item => item.evidence[0])).size).toBe(81);
    expect(guide('REVIEW-015').evidence[0]).toMatch(/교재.*참석/);
    expect(guide('REVIEW-054').evidence[0]).toMatch(/점검.*보수.*접수/);
    expect(guide('REVIEW-077').firstAction).toContain('퇴직연금');
  });

  it('등록 준비와 실제 업무·자체 기록을 구분한다', () => {
    for (const id of ['REVIEW-001', 'REVIEW-002', 'FORM_REGISTRATION']) expect(guide(id).kind).toBe('setup');
    expect(guide('REVIEW-003').kind).toBe('activity');
    expect(guide('REVIEW-015').kind).toBe('activity');
    expect(guide('FORM_PHOTO').kind).toBe('record');
    expect(guide('FORM_PLAN').kind).toBe('record');
    expect(guide('REVIEW-002').done.join(' ')).toContain('추가 확인');
    expect(guide('FORM_PLAN').done[0]).toContain('실제 이행 완료가 아니');
  });

  it('알 수 없는 ID에 일반 안내를 만들어 확정하지 않는다', () => {
    for (const id of ['REVIEW-079', 'DEMO_APPROVED_LEGAL', 'toString', '__proto__']) {
      const definition = { ...taskDefinitions[0], id };
      expect(taskGuidance(definition)).toBeUndefined();
      expect(renderToStaticMarkup(createElement(TaskGuidance, { definition }))).toContain('아직 준비 중');
    }
  });

  it('반복 조회가 동일하고 원본 후보와 CSV를 바꾸지 않는다', () => {
    const original = JSON.stringify(reviewCandidates);
    const csv = catalogCsv(reviewCandidates);
    for (const definition of taskDefinitions) {
      const frozen = Object.freeze({ ...definition });
      const first = taskGuidance(frozen)!;
      expect(first).toEqual(taskGuidance(frozen));
      first.steps.push('외부에서 수정한 문구');
      expect(taskGuidance(frozen)!.steps).not.toContain('외부에서 수정한 문구');
    }
    expect(JSON.stringify(reviewCandidates)).toBe(original);
    expect(catalogCsv(reviewCandidates)).toBe(csv);
  });

  it('위험 작업의 임의 수행·측정값 추정과 민감자료 노출을 유도하지 않는다', () => {
    expect(guide('REVIEW-028').steps.join(' ')).toContain('임의로 들어가지 마세요');
    expect(guide('REVIEW-034').firstAction).toContain('만지지 않고');
    expect(guide('REVIEW-041').evidence[0]).toContain('권한이 제한');
    expect(guide('REVIEW-067').firstAction).toContain('긴급 연락을 먼저');
    expect(guide('REVIEW-072').steps.join(' ')).toContain('자재를 뜯지 마세요');
    for (const definition of taskDefinitions) {
      expect(taskGuidance(definition)!.help.join(' ')).toContain('해당 없음으로 바꾸지');
    }
  });

  it('서버에서 모든 항목을 렌더링하며 첫 행동은 접힌 상세 밖에 둔다', () => {
    for (const definition of taskDefinitions) {
      const html = renderToStaticMarkup(createElement(TaskGuidance, { definition }));
      expect(html).toContain('실행 안내');
      expect(html.indexOf('<strong>')).toBeLessThan(html.indexOf('<details'));
      expect(html).toContain('<summary>');
      expect(html).not.toContain('<details open');
      expect(html).toContain('모르거나 자료가 없을 때');
    }
  });
});
