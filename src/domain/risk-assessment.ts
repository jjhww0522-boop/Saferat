import { z } from 'zod';

const text = z.string().trim().max(1500);
const date = z.union([z.literal(''), z.iso.date()]);
const decision = z.enum(['unknown', 'yes', 'no']);
export const riskHazardSchema = z.object({
  id: z.string().min(1).max(80), work: text, location: text, hazard: text, people: text,
  existingControls: text, level: z.enum(['unknown', 'low', 'medium', 'high']),
  acceptable: decision, decisionReason: text,
  measure: text, owner: z.string().trim().max(120), dueOn: date,
  performedOn: date, performedNote: text,
  verifiedOn: date, verifier: z.string().trim().max(120), residualAcceptable: decision, verificationNote: text,
});
export const riskAssessmentSchema = z.object({
  format: z.literal('risk-assessment-v1'),
  kind: z.enum(['unknown', 'initial', 'periodic', 'occasional']), reason: text,
  scope: text, plannedOn: date, criteria: text,
  assessor: text.default(''), startedOn: date.default(''), finishedOn: date.default(''),
  learningStatus: z.enum(['unknown', 'needed', 'performed', 'sufficient']).default('unknown'), learningBasis: text.default(''),
  learningOn: date, learningPeople: text, learningNote: text,
  announcedOn: date, announcementPeople: text, announcementNote: text,
  participationMethod: z.enum(['unknown', 'walkthrough', 'exception']),
  participationOn: date, participants: text, workerOpinion: text, participationException: text,
  representativeRequested: decision.default('unknown'), representativePeople: text.default(''),
  hazards: z.array(riskHazardSchema).max(30),
  sharedOn: date, sharedPeople: text, sharedNote: text,
  nextReviewOn: date, reviewTrigger: text, storageNote: text,
}).superRefine((value, ctx) => {
  const ids = new Set(value.hazards.map(h => h.id));
  if (ids.size !== value.hazards.length) ctx.addIssue({ code: 'custom', path: ['hazards'], message: '위험요인 번호가 중복됩니다.' });
  if (value.startedOn && value.finishedOn && value.finishedOn < value.startedOn) ctx.addIssue({ code: 'custom', path: ['finishedOn'], message: '평가 실시 기간을 확인해주세요.' });
  value.hazards.forEach((hazard, i) => {
    if (hazard.performedOn && hazard.verifiedOn && hazard.verifiedOn < hazard.performedOn) ctx.addIssue({ code: 'custom', path: ['hazards', i, 'verifiedOn'], message: '조치 후 확인일을 확인해주세요.' });
  });
});
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;
export type RiskHazard = z.infer<typeof riskHazardSchema>;
export interface RiskInputIssue { field: keyof RiskAssessment | keyof RiskHazard; hazardId?: string; message: string; }
export class RiskInputError extends Error {
  constructor(code: string, readonly issue: RiskInputIssue) { super(code); this.name = 'RiskInputError'; }
}
const actualDateFields = ['startedOn', 'finishedOn', 'learningOn', 'announcedOn', 'participationOn', 'sharedOn'] as const;
const assessmentDateFields = ['plannedOn', ...actualDateFields, 'nextReviewOn'] as const;
const hazardDateFields = ['dueOn', 'performedOn', 'verifiedOn'] as const;
export function emptyRiskHazard(id: string): RiskHazard {
  return { id, work: '', location: '', hazard: '', people: '', existingControls: '', level: 'unknown', acceptable: 'unknown', decisionReason: '', measure: '', owner: '', dueOn: '', performedOn: '', performedNote: '', verifiedOn: '', verifier: '', residualAcceptable: 'unknown', verificationNote: '' };
}
export function emptyRiskAssessment(): RiskAssessment {
  return { format: 'risk-assessment-v1', kind: 'unknown', reason: '', scope: '', plannedOn: '', criteria: '', assessor: '', startedOn: '', finishedOn: '', learningStatus: 'unknown', learningBasis: '', learningOn: '', learningPeople: '', learningNote: '', announcedOn: '', announcementPeople: '', announcementNote: '', participationMethod: 'unknown', participationOn: '', participants: '', workerOpinion: '', participationException: '', representativeRequested: 'unknown', representativePeople: '', hazards: [], sharedOn: '', sharedPeople: '', sharedNote: '', nextReviewOn: '', reviewTrigger: '', storageNote: '' };
}
export function readRiskAssessment(value: string, today: string): RiskAssessment {
  if (value.length > 20000) throw new Error('record_too_long');
  const input: unknown = JSON.parse(value);
  const parsed = riskAssessmentSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0], field = first.path.at(-1);
    if (first.path.length === 1 && assessmentDateFields.some(name => name === field)) {
      throw new RiskInputError('invalid_risk_input', { field: field as keyof RiskAssessment, message: first.code === 'custom' && field === 'finishedOn' ? '평가를 마친 날은 실제 시작한 날보다 빠를 수 없습니다.' : '날짜를 연-월-일 형식으로 확인해주세요. 모르는 날짜는 비워두세요.' });
    }
    if (first.path.length === 3 && first.path[0] === 'hazards' && typeof first.path[1] === 'number' && hazardDateFields.some(name => name === field) && input && typeof input === 'object' && 'hazards' in input && Array.isArray(input.hazards)) {
      const hazard = input.hazards[first.path[1]];
      const id = riskHazardSchema.shape.id.safeParse(hazard?.id);
      // An invalid or duplicate ID cannot identify the field safely in the editor.
      if (id.success && input.hazards.filter(item => item?.id === id.data).length === 1) {
        throw new RiskInputError('invalid_risk_input', { field: field as keyof RiskHazard, hazardId: id.data, message: first.code === 'custom' && field === 'verifiedOn' ? '조치 후 확인일은 실제 조치일보다 빠를 수 없습니다.' : '날짜를 연-월-일 형식으로 확인해주세요. 모르는 날짜는 비워두세요.' });
      }
    }
    throw parsed.error;
  }
  const risk = parsed.data;
  for (const field of actualDateFields) {
    if (risk[field] > today) throw new RiskInputError('future_activity', { field, message: '실제 수행일에는 미래 날짜를 입력할 수 없습니다. 예정일과 구분해 확인해주세요.' });
  }
  for (const hazard of risk.hazards) {
    for (const field of ['performedOn', 'verifiedOn'] as const) {
      if (hazard[field] > today) throw new RiskInputError('future_activity', { field, hazardId: hazard.id, message: field === 'performedOn' ? '실제 조치일에는 미래 날짜를 입력할 수 없습니다. 계획은 조치 목표일에 적어주세요.' : '조치 후 실제 확인일에는 미래 날짜를 입력할 수 없습니다. 아직 확인하지 않았다면 비워두세요.' });
    }
  }
  return risk;
}
export function hasRiskContent(value: RiskAssessment) {
  const empty = emptyRiskAssessment();
  return Object.keys(empty).some(key => JSON.stringify(value[key as keyof RiskAssessment]) !== JSON.stringify(empty[key as keyof RiskAssessment]));
}
export const riskSteps = [
  { id: 'prepare', title: '준비·방법 익히기', action: '이번에 살펴볼 작업과 일정을 정하고, 위험을 판단할 기준을 함께 이해하세요.' },
  { id: 'participate', title: '일정 알리기·함께 살펴보기', action: '일정을 먼저 알린 뒤 실제 작업하는 근로자와 현장을 둘러보고 의견을 들으세요.' },
  { id: 'identify', title: '위험요인 찾기', action: '어떤 작업에서 누가 어떻게 다칠 수 있는지, 위험요인을 하나씩 적으세요.' },
  { id: 'assess', title: '위험 판단하기', action: '미리 정한 기준에 따라 현재 조치로 위험을 허용할 수 있는지 판단하세요.' },
  { id: 'act', title: '개선조치 실행하기', action: '위험을 줄일 조치와 담당자·목표일을 정하고 실제 실행 내용을 남기세요.' },
  { id: 'verify', title: '조치 후 다시 확인하기', action: '현장에서 조치 효과를 확인하세요. 위험이 남았다면 대책을 보완하세요.' },
  { id: 'share', title: '결과 공유·기록 보관', action: '위험요인, 판단 결과, 대책과 이행 결과를 근로자에게 알리고 다음 확인을 준비하세요.' },
] as const;
export function riskProgress(value: RiskAssessment) {
  const hazards = value.hazards;
  const identified = hazards.length > 0 && hazards.every(h => h.work && h.location && h.hazard && h.people && h.existingControls);
  const assessed = identified && hazards.every(h => h.level !== 'unknown' && h.acceptable !== 'unknown' && h.decisionReason);
  const needsAction = (h: RiskHazard) => h.acceptable !== 'yes' || !!h.measure || h.residualAcceptable === 'no';
  const needingAction = hazards.filter(needsAction);
  const acted = assessed && needingAction.every(h => h.measure && h.owner && h.dueOn && h.performedOn && h.performedNote);
  const verified = acted && needingAction.every(h => h.verifiedOn && h.verifier && h.residualAcceptable === 'yes' && h.verificationNote);
  const ready = [
    !!(value.kind !== 'unknown' && value.scope && value.plannedOn && value.criteria && value.assessor && (value.kind !== 'occasional' || value.reason) && ((value.learningStatus === 'performed' && value.learningOn && value.learningPeople && value.learningNote) || (value.learningStatus === 'sufficient' && value.learningBasis))),
    !!(value.announcedOn && value.announcementPeople && value.announcementNote && value.participationOn && value.participants && value.workerOpinion && (value.representativeRequested === 'no' || (value.representativeRequested === 'yes' && value.representativePeople)) && (value.participationMethod === 'walkthrough' || (value.participationMethod === 'exception' && value.participationException))),
    !!identified, !!assessed, !!acted, !!verified,
    !!(verified && value.startedOn && value.finishedOn && value.sharedOn && value.sharedPeople && value.sharedNote && value.reviewTrigger && value.storageNote),
  ];
  return { steps: riskSteps.map((step, i) => ({ ...step, ready: ready[i] })),
    readyCount: ready.filter(Boolean).length,
    unresolvedCount: hazards.filter(h => h.acceptable === 'unknown' || (needsAction(h) && !(h.measure && h.owner && h.dueOn && h.performedOn && h.performedNote && h.verifiedOn && h.verifier && h.residualAcceptable === 'yes' && h.verificationNote))).length,
  };
}

export const riskManuals = [
  { title: '소규모 사업장을 위한 위험성평가 안내서', publisher: '고용노동부 · 2023.09', url: 'https://www.moel.go.kr/policy/policydata/view.do?bbs_seq=20230900922', use: '처음이라면 그림과 작업 사례부터 살펴보세요. 우리 현장의 위험을 찾는 데 활용합니다.' },
  { title: '2026년 위험성평가 개정 안내', publisher: '고용노동부 · 2026.08', url: 'https://www.moel.go.kr/local/yangsan/news/notice/noticeView.do?bbs_seq=20260800598', use: '2026년 6월 시행 개정사항을 함께 확인하세요. 이전 안내서의 법령 설명보다 최신 규정을 우선합니다.' },
] as const;
