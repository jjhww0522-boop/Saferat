import type { TaskActionSource } from './task-action-source';
import { taskUrgency, type TaskRecord } from './tasks';
import { currentTasks, taskCycleLabel } from './task-cycles';
import { profileQuestionDetails, type TaskProfile } from './workplace-profile';

export interface TaskActionSummary {
  id: string;
  taskId?: string;
  title: string;
  action: string;
  reason: string;
  href: string;
  priority: number;
  dueOn: string | null;
  version: number | null;
  confirmed: boolean;
  needsAttention: boolean;
}

// This is a service work order based on saved facts, not a legal applicability or safety judgment.
export function taskActionSummary(task: TaskRecord, source: TaskActionSource | undefined, base: string, today: string): TaskActionSummary {
  const href = `${base}/tasks/${encodeURIComponent(task.id)}`;
  const result: TaskActionSummary = {
    id: task.id, taskId: task.id, title: task.title, action: '첫 기록 작성', reason: '확인한 사실부터 임시 저장하세요.',
    href: `${href}#task-editor`, priority: 5, dueOn: null, version: source?.version ?? null,
    confirmed: !!source?.confirmed_at, needsAttention: true,
  };
  if (source?.risk?.improvement_count) {
    const due = source.risk.next_due_on;
    return { ...result, action: task.review_status === 'queued' ? '남은 조치 확인' : '조치 결과 기록',
      reason: `저장한 기록에 개선·재확인이 남은 위험요인 ${source.risk.improvement_count}건${due ? ` · 조치 목표 ${due}${due < today ? ' 경과' : ''}` : ' · 조치 목표일 확인 필요'}. 자료 검토 상태와 별개입니다.`,
      href: task.review_status === 'queued' ? `${href}#stored-record` : `${href}?step=improve#task-editor`,
      priority: 0, dueOn: due };
  }
  if (task.review_status === 'changes_requested') return { ...result, action: '보완 의견 확인', reason: '검토자가 남긴 위치와 의견을 확인한 뒤 새 버전으로 보완하세요.', href: `${href}#review-history`, priority: 1 };
  const urgency = taskUrgency(task.target_date, task.review_status, new Date(`${today}T03:00:00Z`));
  if (urgency !== 'normal') return { ...result, action: '준비 일정·내용 보완', reason: `직접 정한 자료 준비 목표일 ${task.target_date}${urgency === 'overdue' ? '이 지났습니다' : '이 다가옵니다'}. 준비 상황을 확인하세요.`, priority: urgency === 'overdue' ? 2 : 3, dueOn: task.target_date };
  if (source?.risk?.state === 'unreadable') return { ...result, action: '저장한 기록 확인', reason: '저장 형식을 확인하지 못해 남은 조치를 집계할 수 없습니다. 원문을 확인하세요.', href: `${href}#stored-record`, priority: 4 };
  if (source?.version && !source.confirmed_at && ['queued', 'reviewed'].includes(task.review_status)) return { ...result, action: '저장 상태 다시 확인', reason: '저장 버전과 검토 상태가 갱신 중입니다. 최신 기록을 열어 확인해주세요.', href: `${href}#stored-record`, priority: 4 };
  if (task.review_status === 'queued') return { ...result, action: '검토 현황 확인', reason: '자료 검토를 기다리고 있습니다. 실제 조치와 수행은 별도로 확인하세요.', href: `${href}#review-history`, needsAttention: false };
  if (task.review_status === 'reviewed') return { ...result, action: '저장한 기록 확인', reason: '자료 검토 결과와 실제 수행·접수 상태를 각각 확인하세요.', href: `${href}#stored-record`, needsAttention: false };
  if (source?.version) return { ...result, action: source.confirmed_at ? '증빙·내용 확인' : '초안 이어서 작성', reason: source.confirmed_at ? '확인한 버전의 증빙과 필요한 검토 요청을 살펴보세요.' : '저장한 초안에서 모르는 내용과 남은 입력을 보완하세요.', href: source.confirmed_at ? `${href}#stored-record` : `${href}#task-editor` };
  return result;
}

export function homeTaskActions(tasks: TaskRecord[], sources: TaskActionSource[], profile: TaskProfile, workplace: string, base: string, today: string) {
  const byTask = new Map(sources.map(source => [source.task_id, source]));
  const current = new Set(currentTasks(tasks).map(task => task.id));
  const actions = tasks.flatMap(task => {
    const action = taskActionSummary(task, byTask.get(task.id), base, today);
    if (current.has(task.id)) return [action];
    // Starting another assessment does not resolve old improvements or review feedback.
    const source = byTask.get(task.id);
    if (action.priority <= 1 || source?.risk?.state === 'unreadable' || source?.journey?.unknown_count) {
      const previousReason = action.priority <= 1 ? action.reason : source?.risk?.state === 'unreadable' ? '기록 형식을 확인하지 못해 남은 위험을 집계할 수 없어요.' : `위험 판단 미확인 ${source?.journey?.unknown_count}건이 남아 있어요. 자료 검토와 별도로 판단 내용을 확인하세요.`;
      return [{ ...action, title: `지난 ${taskCycleLabel(task)} · ${task.title}`, action: '지난 기록 확인', href: `${base}/tasks/${encodeURIComponent(task.id)}#stored-record`, reason: `이전 회차의 확인이 남아 있어요. ${previousReason}`, needsAttention: true, priority: action.priority <= 1 ? action.priority : 4, dueOn: action.priority <= 1 ? action.dueOn : null }];
    }
    return [];
  });
  const questions = profileQuestionDetails(profile);
  if (questions.length) actions.push({ id: 'workplace-information', title: '사업장 미확인 정보', action: '사업장 정보 확인', reason: `${questions.length}개 항목이 남았습니다. 먼저 ${questions[0].label}부터 확인하세요.`, href: `${base}?workplace=${encodeURIComponent(workplace)}&setup=1&focus=${encodeURIComponent(questions[0].id)}`, priority: 4, dueOn: null, version: null, confirmed: false, needsAttention: true });
  return actions.sort((a, b) => a.priority - b.priority || (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999') || a.id.localeCompare(b.id));
}
