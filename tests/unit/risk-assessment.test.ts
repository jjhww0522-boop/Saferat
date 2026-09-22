import { describe, expect, it } from 'vitest';
import { emptyRiskAssessment, emptyRiskHazard, readRiskAssessment, riskProgress, riskAssessmentSchema } from '@/domain/risk-assessment';
import { parseTaskContent, readTaskForm, taskDefinition } from '@/domain/tasks';

describe('위험성평가의 실제 기록과 확인·개선 분리', () => {
  const today = '2026-09-15';
  function identified() {
    return { ...emptyRiskHazard('hazard-1'), work: '청소', location: '세척구역', hazard: '물기에 미끄러짐', people: '청소 근로자', existingControls: '표지 설치', level: 'medium' as const, acceptable: 'no' as const, decisionReason: '표지만으로 미끄러짐을 막지 못함' };
  }
  it('빈 기록을 완료·위험 없음으로 취급하거나 예시를 저장하지 않는다', () => {
    const risk = emptyRiskAssessment();
    expect(riskProgress(risk).readyCount).toBe(0);
    expect(risk.hazards).toEqual([]);
    const form = new FormData(); form.set('risk_assessment', JSON.stringify(risk));
    expect(readTaskForm(taskDefinition('REVIEW-003')!, form)).toBeNull();
  });
  it('일부 입력은 저장하고 여러 위험요인의 미확인을 그대로 보존한다', () => {
    const risk = { ...emptyRiskAssessment(), scope: '매장과 창고', hazards: [identified(), emptyRiskHazard('hazard-2')] };
    const form = new FormData(); form.set('risk_assessment', JSON.stringify(risk));
    const result = parseTaskContent(readTaskForm(taskDefinition('REVIEW-003')!, form)!)!;
    expect(result.risk?.hazards).toHaveLength(2);
    expect(result.risk?.hazards[1].acceptable).toBe('unknown');
    expect(result.risk?.learningPeople).toBe('');
    expect(riskProgress(result.risk!).unresolvedCount).toBe(2);
  });
  it('계획·조치일만으로 개선을 닫지 않고 실제 실행과 후속 확인을 요구한다', () => {
    const h = { ...identified(), measure: '바닥 개선', owner: '김 담당', dueOn: today, performedOn: today };
    const risk = { ...emptyRiskAssessment(), hazards: [h] };
    expect(riskProgress(risk).steps[4].ready).toBe(false);
    h.performedNote = '배수·바닥 보수함';
    expect(riskProgress(risk).steps[4].ready).toBe(true);
    expect(riskProgress(risk).steps[5].ready).toBe(false);
    Object.assign(h, { verifiedOn: today, verifier: '이 확인', residualAcceptable: 'no', verificationNote: '물기가 남음' });
    expect(riskProgress(risk).unresolvedCount).toBe(1);
    Object.assign(h, { residualAcceptable: 'yes', verificationNote: '보수 후 배수 상태 확인' });
    expect(riskProgress(risk).unresolvedCount).toBe(0);
    expect(riskProgress(risk).readyCount).toBeLessThan(7);
  });
  it('처음 허용 가능했더라도 새로 확인된 잔여 위험을 무시하지 않는다', () => {
    const risk = { ...emptyRiskAssessment(), hazards: [{ ...identified(), acceptable: 'yes' as const, residualAcceptable: 'no' as const }] };
    expect(riskProgress(risk).unresolvedCount).toBe(1);
    expect(riskProgress(risk).steps[5].ready).toBe(false);
  });
  it('사전교육 시간·참석을 만들지 않고 순회 점검 대체 사유와 참여 사실을 구분한다', () => {
    const risk = { ...emptyRiskAssessment(), announcedOn: today, announcementPeople: '현장 근로자', announcementNote: '일정 안내', participationOn: today, participants: '참여자', workerOpinion: '작업 의견', participationMethod: 'exception' as const, representativeRequested: 'no' as const };
    expect(riskProgress(risk).steps[1].ready).toBe(false);
    risk.participationException = '정지 설비 내부 진입 불가로 담당 작업자 면담';
    expect(riskProgress(risk).steps[1].ready).toBe(true);
    expect(risk.learningOn).toBe('');
  });
  it('미래 수행일·중복 위험요인·역전된 확인일·비정상 입력을 거부한다', () => {
    const risk = emptyRiskAssessment();
    risk.sharedOn = '2026-09-16';
    expect(() => readRiskAssessment(JSON.stringify(risk), today)).toThrow('future_activity');
    risk.sharedOn = ''; risk.plannedOn = '2026-10-01';
    expect(readRiskAssessment(JSON.stringify(risk), today).plannedOn).toBe('2026-10-01');
    expect(riskAssessmentSchema.safeParse({ ...risk, hazards: [identified(), identified()] }).success).toBe(false);
    expect(riskAssessmentSchema.safeParse({ ...risk, hazards: [{ ...identified(), performedOn: today, verifiedOn: '2026-09-14' }] }).success).toBe(false);
    expect(() => readRiskAssessment('x'.repeat(20001), today)).toThrow('record_too_long');
    expect(riskAssessmentSchema.safeParse({ ...risk, scope: 'x'.repeat(1501) }).success).toBe(false);
  });
  it('다른 업무에 위험성평가 내용이 섞이지 않고 예전 자료도 읽힌다', () => {
    const legacy = { format: 'task-record-v1', definition: 'REVIEW-003', notes: '이전 메모', answers: ['직접 확인'], fields: {} };
    expect(parseTaskContent(JSON.stringify(legacy))?.notes).toBe('이전 메모');
    expect(parseTaskContent(JSON.stringify({ ...legacy, definition: 'FORM_PHOTO', risk: emptyRiskAssessment() }))).toBeNull();
  });
  it('교육·대표 참여·실시 기간·공유까지 갖춘 기록에서도 실제 법적 완료 상태를 만들지 않는다', () => {
    const risk = { ...emptyRiskAssessment(), kind: 'initial' as const, scope: '시험 작업', plannedOn: today, criteria: '참여자가 정한 기준', assessor: '평가 담당', startedOn: today, finishedOn: today,
      learningStatus: 'performed' as const, learningOn: today, learningPeople: '실제 참여자', learningNote: '위험 찾기·판단 기준 교육',
      announcedOn: today, announcementPeople: '작업 근로자', announcementNote: '일정 알림', participationMethod: 'walkthrough' as const, participationOn: today, participants: '작업 근로자', workerOpinion: '작업 의견', representativeRequested: 'yes' as const, representativePeople: '대표와 현장 순회',
      hazards: [{ ...identified(), measure: '배수 보수', owner: '조치 담당', dueOn: today, performedOn: today, performedNote: '보수 사실 확인', verifiedOn: today, verifier: '확인 담당', residualAcceptable: 'yes' as const, verificationNote: '보수 후 상태 확인' }],
      sharedOn: today, sharedPeople: '교대 근로자 포함', sharedNote: '요인·판단·대책·이행 결과 설명', reviewTrigger: '설비 변경 시', storageNote: '자료와 증빙 보관 위치',
    };
    expect(riskProgress(risk).readyCount).toBe(7);
    risk.representativePeople = '';
    expect(riskProgress(risk).steps[1].ready).toBe(false);
    expect(riskProgress(risk)).not.toHaveProperty('legalComplete');
    expect(riskProgress(risk)).not.toHaveProperty('review_status');
  });
});
