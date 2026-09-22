import { emptyRiskAssessment, emptyRiskHazard } from '../../src/domain/risk-assessment';

export const completedHazard = { ...emptyRiskHazard('completed'), acceptable: 'no', measure: '실제로 정한 조치', owner: '실제 담당자', dueOn: '2026-09-10', performedOn: '2026-09-10', performedNote: '실행 기록', verifiedOn: '2026-09-11', verifier: '확인자', residualAcceptable: 'yes', verificationNote: '효과 확인 기록' };
export function riskContent(hazards: unknown[]) {
  return JSON.stringify({ format: 'task-record-v1', definition: 'REVIEW-003', notes: 'PRIVATE_BODY', answers: [], fields: {}, risk: { ...emptyRiskAssessment(), hazards } });
}
const available = (improvement_count: number, next_due_on: string | null = null) => ({ state: 'available', improvement_count, next_due_on });
const unreadable = { state: 'unreadable', improvement_count: 0, next_due_on: null };
export const sourceCases = [
  { name: '기존 공통 기록', content: JSON.stringify({ format: 'task-record-v1', definition: 'REVIEW-003', notes: '이전 기록', answers: [], fields: {} }), risk: null },
  { name: '빈 위험요인', content: riskContent([]), risk: available(0) },
  { name: '높은 위험도와 미확인만으로 개선을 단정하지 않음', content: riskContent([{ ...emptyRiskHazard('high'), level: 'high' }]), risk: available(0) },
  { name: '허용 불가와 잔여 위험을 각각 집계', content: riskContent([{ ...emptyRiskHazard('a'), acceptable: 'no', dueOn: '2026-09-20' }, { ...emptyRiskHazard('b'), acceptable: 'yes', residualAcceptable: 'no', dueOn: '2026-09-10' }]), risk: available(2, '2026-09-10') },
  { name: '조치 계획이 있는 미확인 기록', content: riskContent([{ ...emptyRiskHazard('a'), measure: '준비한 개선 계획', dueOn: '2026-09-17' }]), risk: available(1, '2026-09-17') },
  { name: '기록상 조치 확인 항목 갖춤', content: riskContent([completedHazard]), risk: available(0) },
  { name: '완료 기록의 목표일을 다음 기한에 섞지 않음', content: riskContent([completedHazard, { ...emptyRiskHazard('b'), acceptable: 'no', dueOn: '2026-10-01' }]), risk: available(1, '2026-10-01') },
  { name: '조치 후 잔여 위험', content: riskContent([{ ...completedHazard, residualAcceptable: 'no' }]), risk: available(1, '2026-09-10') },
  { name: '없는 날짜를 기한으로 반환하지 않음', content: riskContent([{ ...emptyRiskHazard('a'), acceptable: 'no', dueOn: '2026-02-30' }]), risk: available(1) },
  { name: '역전된 실제 확인일', content: riskContent([{ ...completedHazard, verifiedOn: '2026-09-09' }]), risk: available(1, '2026-09-10') },
  { name: '없는 실제 수행일은 완료로 취급하지 않음', content: riskContent([{ ...completedHazard, performedOn: '2026-02-30' }]), risk: available(1, '2026-09-10') },
  { name: '유니코드 공백을 조치로 취급하지 않음', content: riskContent([{ ...emptyRiskHazard('a'), measure: '\t\n\u00a0\u3000\ufeff' }]), risk: available(0) },
  { name: '공백 담당자는 확인 항목 부족', content: riskContent([{ ...completedHazard, owner: '\t\u00a0\ufeff' }]), risk: available(1, '2026-09-10') },
  { name: '잘못된 JSON', content: '이전 자유 기록', risk: unreadable },
  { name: 'JSON 기본값', content: 'null', risk: unreadable },
  { name: '지원하지 않는 위험 형식', content: JSON.stringify({ format: 'task-record-v1', definition: 'REVIEW-003', risk: { format: 'future', hazards: [] } }), risk: unreadable },
  { name: '잘못된 위험요인 타입', content: riskContent([null]), risk: unreadable },
  { name: '중복 위험요인', content: riskContent([emptyRiskHazard('a'), emptyRiskHazard('a')]), risk: unreadable },
  { name: '잘못된 판단값', content: riskContent([{ ...emptyRiskHazard('a'), acceptable: true }]), risk: unreadable },
  { name: '조치가 문자열이 아닌 기록', content: riskContent([{ ...emptyRiskHazard('a'), measure: 12 }]), risk: unreadable },
  { name: '다른 업무에 섞인 위험성평가', content: riskContent([completedHazard]).replace('REVIEW-003', 'FORM_PHOTO'), risk: unreadable },
];
