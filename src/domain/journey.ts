import { riskProgress, riskSteps, type RiskAssessment } from './risk-assessment';
import { taskDefinitions, type TaskRecord } from './tasks';
import { isSetupDefinition, profileCandidates, type TaskProfile } from './workplace-profile';
import type { TaskActionSource } from './task-action-source';
import type { TaskActionSummary } from './task-actions';

export const journeyVersion = 1;
export const journeyGroups = [
  { id: 'management', title: '담당자와 관리체계', description: '누가 무엇을 맡고, 어떻게 함께 관리할지 정해요.', categories: ['management', 'appointment'] },
  { id: 'risk', title: '현장 위험 줄이기', description: '다칠 수 있는 상황을 찾고 실제로 줄여요.', categories: ['inspection'] },
  { id: 'training', title: '교육과 훈련', description: '작업에 필요한 내용을 함께 익히고 기록해요.', categories: ['training'] },
  { id: 'contract', title: '다른 업체와 함께 일하기', description: '함께 일하는 업체와 역할·작업을 확인해요.', categories: ['contract'] },
  { id: 'health', title: '시설과 건강 관리', description: '설비 상태와 일하는 사람의 건강을 살펴요.', categories: ['facility', 'health'] },
  { id: 'incident', title: '사고·비상 대비', description: '긴급 대응과 사고 이후 필요한 기록을 준비해요.', categories: ['incident'] },
] as const;
export function journeyGroup(definition: string) {
  if (definition === 'REVIEW-003') return journeyGroups[1];
  const category = taskDefinitions.find(d => d.id === definition)?.category;
  return journeyGroups.find(group => (group.categories as readonly string[]).includes(category ?? '')) ?? journeyGroups[0];
}
export function journeyCandidates(profile: TaskProfile, tasks: TaskRecord[]) {
  const ids = new Set([...profileCandidates(profile).map(d => d.id), ...tasks.map(t => t.definition_id)]);
  return taskDefinitions.filter(d => ids.has(d.id) && !isSetupDefinition(d.id));
}
export function journeyPrimary(actions: TaskActionSummary[], tasks: TaskRecord[], profile: TaskProfile, workplace: string, base: string): TaskActionSummary {
  const setup = `${base}?workplace=${encodeURIComponent(workplace)}&setup=1`;
  if (!profile.confirmed_at) return { id: 'start-profile', title: '우리 사업장부터 알아볼까요?', action: '사업장 정보 이어서 입력', reason: '어디에서 어떤 일을 하는지 알려주시면, 관련 업무와 준비 방법을 안내해요.', href: setup, priority: 0, version: null, confirmed: false, dueOn: null, needsAttention: true };
  const attention = actions.find(a => a.taskId && a.needsAttention);
  if (attention) return attention;
  if (!tasks.some(t => t.definition_id === 'REVIEW-003')) return { id: 'first-risk', title: '함께 살펴볼 작업을 정해볼까요?', action: '작업과 장소 정하기', reason: '다칠 수 있는 상황을 찾는 첫걸음이에요. 실제 작업을 바탕으로 위험성평가의 준비부터 안내해요.', href: `${base}/tasks/new?definition=REVIEW-003&workplace=${encodeURIComponent(workplace)}`, priority: 5, version: null, confirmed: false, dueOn: null, needsAttention: true };
  return actions.find(a => a.needsAttention) ?? actions[0] ?? { id: 'map', title: '다음으로 살펴볼 일을 찾아볼까요?', action: '전체 지도 살펴보기', reason: '관리 분야를 펼치면 목적과 첫 행동을 볼 수 있어요.', href: `${base}/map?workplace=${encodeURIComponent(workplace)}`, priority: 5, version: null, confirmed: false, dueOn: null, needsAttention: false };
}
export function riskJourneySummary(risk: RiskAssessment): { definition_version: typeof journeyVersion; ready_steps: boolean[]; unknown_count: number } {
  return { definition_version: journeyVersion, ready_steps: riskProgress(risk).steps.map(s => s.ready), unknown_count: risk.hazards.filter(h => h.acceptable === 'unknown' || h.level === 'unknown' || !h.decisionReason.trim()).length };
}
export function savedJourneyLabel(source?: TaskActionSource) {
  if (!source?.version) return '첫 기록을 기다리고 있어요';
  if (!source.journey?.ready_steps) return `v${source.version} 저장 · ${source.confirmed_at ? '작성자 확인됨' : '내용 확인 전'}`;
  return `기록 준비 ${source.journey.ready_steps.filter(Boolean).length}/7단계 · v${source.version}`;
}
export const riskChapters = [
  ['살펴볼 작업', '판단 기준', '방법 익히기'], ['일정 알리기', '함께 살펴보기'], ['위험요인 기록'], ['위험 판단'], ['조치 계획', '실제 조치'], ['효과 확인'], ['결과 공유', '보관·다음 확인'],
] as const;
export type RiskJourneyPosition = { step: number; chapter: number; hazardId: string | null };
export function parseRiskJourneyCursor(cursor?: string | null): RiskJourneyPosition | null {
  const match = cursor?.match(/^risk:([0-6]):([0-2])(?::([\s\S]{1,80}))?$/);
  if (!match || match[0] !== cursor) return null;
  const step = Number(match[1]), chapter = Number(match[2]);
  if (chapter >= riskChapters[step].length) return null;
  return { step, chapter, hazardId: match[3] ?? null };
}
export function riskJourneyCursor(position: RiskJourneyPosition) {
  const cursor = `risk:${position.step}:${position.chapter}${position.hazardId === null ? '' : `:${position.hazardId}`}`;
  if (!parseRiskJourneyCursor(cursor)) throw new Error('invalid_state');
  return cursor;
}
export function initialRiskJourneyPosition(stored?: RiskAssessment, cursor?: string | null, requestedStep?: string): RiskJourneyPosition {
  const saved = parseRiskJourneyCursor(cursor);
  const [requestedId, requestedChapter] = requestedStep?.split(':') ?? [];
  const requested = requestedId === 'improve' ? 4 : riskSteps.findIndex(item => item.id === requestedId);
  const step = requested >= 0 ? requested : saved?.step ?? Math.max(0, stored ? riskProgress(stored).steps.findIndex(item => !item.ready) : 0);
  const chapter = requested >= 0 ? Number(requestedChapter ?? 0) : saved?.chapter ?? 0;
  return { step, chapter: Number.isInteger(chapter) && chapter >= 0 && chapter < riskChapters[step].length ? chapter : 0, hazardId: saved?.hazardId ?? stored?.hazards[0]?.id ?? null };
}
export const riskHelp = [
  ['평소 작업뿐 아니라 청소·수리·운반도 함께 살펴보세요.', '설명용 예시: “1층 세척구역에서 물품 운반과 바닥 청소”. 실제 작업자에게 장소와 작업 순서를 확인해 적으세요.'],
  ['그 일을 실제로 하는 사람에게 물어보세요.', '설명용 질문: “최근 아찔했던 순간이 있었나요?”, “불편하거나 다칠까 걱정되는 작업은 무엇인가요?” 들은 사실과 아직 확인할 내용을 나눠 적으세요.'],
  ['작업 하나에서 다칠 수 있는 상황 하나를 적어보세요.', '설명용 예시: “젖은 바닥에서 운반 중 미끄러질 수 있음”. 사진만으로 원인을 확정하지 말고 위치·작업·현재 조치를 확인하세요.'],
  ['앞서 정한 기준으로 작업자와 함께 판단하세요.', '판단 근거가 부족하면 “아직 판단하지 못함”으로 두세요. 위험 수준이 낮아도 필요한 안전조치는 별도로 확인해야 해요.'],
  ['계획과 실제로 한 일을 나눠 기록해요.', '먼저 조치 내용·담당·목표일을 정하세요. 실행한 뒤 실제 날짜와 바뀐 내용을 적고, 저장 후 전후 사진이나 작업 기록을 연결하세요.'],
  ['현장에서 조치가 효과가 있는지 확인하세요.', '어떻게 확인했는지와 남은 문제를 기록하세요. 충분히 줄지 않았다면 개선조치 단계로 돌아가 대책을 보완하세요.'],
  ['필요한 사람에게 결과를 알리고 자료를 함께 보관해요.', '무엇을 누구에게 어떻게 알렸는지 적으세요. 작성한 기록·참여 자료·개선 전후 자료를 다시 찾을 수 있는 위치와 담당자를 남기세요.'],
] as const;
