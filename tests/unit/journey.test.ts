import { describe, expect, it } from 'vitest';
import { journeyPrimary, journeyCandidates, journeyGroup, riskJourneySummary, savedJourneyLabel } from '@/domain/journey';
import { emptyProfile } from '@/domain/workplace-profile';
import { emptyRiskAssessment, emptyRiskHazard } from '@/domain/risk-assessment';
import { summarizeJourneySource } from '@/domain/task-action-source';
import { homeTaskActions } from '@/domain/task-actions';
import type { TaskRecord } from '@/domain/tasks';

describe('초보자의 첫 행동과 저장 기준 지도', () => {
  const profile = { ...emptyProfile, confirmed_at: '2026-09-18T00:00:00Z' };
  it('등록 업무가 없어도 첫 업무를 제안하며 등록증 보완이 가리지 않는다', () => {
    const actions = homeTaskActions([], [], profile, 'w', '/app', '2026-09-18');
    expect(journeyPrimary(actions, [], profile, 'w', '/app').id).toBe('first-risk');
    expect(journeyPrimary(actions, [], emptyProfile, 'w', '/app').id).toBe('start-profile');
    expect(journeyCandidates(emptyProfile, []).some(d => d.id === 'REVIEW-003')).toBe(true);
    expect(journeyGroup('REVIEW-003').id).toBe('risk');
  });
  it('실제 보완할 기록이 있으면 새 업무보다 먼저 안내한다', () => {
    const task = { id: 't', definition_id: 'REVIEW-004', title: '관리체계', review_status: 'changes_requested', target_date: null } as TaskRecord;
    const actions = homeTaskActions([task], [], profile, 'w', '/app', '2026-09-18');
    expect(journeyPrimary(actions, [task], profile, 'w', '/app').action).toBe('보완 의견 확인');
  });
  it('기록 준비와 미판단·개선 필요를 구분하며 빈 위험을 완료로 보지 않는다', () => {
    const risk = { ...emptyRiskAssessment(), hazards: [emptyRiskHazard('a')] };
    expect(riskJourneySummary(risk)).toEqual({ definition_version: 1, ready_steps: Array(7).fill(false), unknown_count: 1 });
    const source = summarizeJourneySource('t', { number: 1, content: JSON.stringify({ format: 'task-record-v1', definition: 'REVIEW-003', risk }), confirmed_at: null });
    expect(source.risk?.improvement_count).toBe(0);
    expect(savedJourneyLabel(source)).toBe('기록 준비 0/7단계 · v1');
    expect(summarizeJourneySource('t', undefined).journey?.ready_steps).toBeNull();
    expect(summarizeJourneySource('t', { number: 2, content: '이전 기록', confirmed_at: null }).journey?.ready_steps).toBeNull();
  });
});
