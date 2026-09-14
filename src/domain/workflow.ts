import type { Actor, DemoState, DocumentVersion, HistoryEvent, Obligation } from './types';
import { demoRules, evaluate } from './rules';

export class WorkflowError extends Error {}
export function canAccess(actor: Actor, tenantId: string): boolean {
  return actor.tenantId === tenantId || actor.assignedTenantIds.includes(tenantId);
}
export function scopedObligation(state: DemoState, actor: Actor, id: string): Obligation {
  const item = state.obligations.find(o => o.id === id);
  if (!item || !canAccess(actor, item.tenantId)) throw new WorkflowError('이 자료에 접근할 수 없습니다. 현장과 체험 역할을 확인하세요.');
  return item;
}
export function evaluationFor(state: DemoState, item: Obligation) {
  const workplace = state.workplaces.find(w => w.id === item.workplaceId)!;
  const snapshot = state.snapshots.find(s => s.id === workplace.snapshotIds.at(-1))!;
  return evaluate(demoRules.find(r => r.id === item.ruleId)!, snapshot, snapshot.recordedAt);
}
type Command =
  | { type: 'document'; kind: DocumentVersion['kind']; fields: DocumentVersion['fields'] }
  | { type: 'confirm'; versionId: string }
  | { type: 'activity'; date: string; note: string }
  | { type: 'submit'; versionId: string }
  | { type: 'review'; reviewId: string; decision: 'changes_requested' | 'reviewed'; comment: string; internalNote: string; location: string };

export function applyCommand(state: DemoState, actor: Actor, id: string, revision: number, command: Command, now = new Date().toISOString()) {
  const item = scopedObligation(state, actor, id);
  if (item.revision !== revision) throw new WorkflowError('다른 화면에서 내용이 변경되었습니다. 새로고침 후 다시 확인해주세요.');
  const isReviewer = actor.persona === 'reviewer' && actor.assignedTenantIds.includes(item.tenantId);
  if ((command.type === 'review') !== isReviewer) throw new WorkflowError('현재 역할로 이 작업을 할 수 없습니다.');
  const event: HistoryEvent = { id: crypto.randomUUID(), obligationId: id, at: now, actor: isReviewer ? 'JH 검토자 (체험)' : '현장 담당자 (체험)', message: '' };
  if (command.type === 'document') {
    const version: DocumentVersion = { id: crypto.randomUUID(), obligationId: id, number: item.versionIds.length + 1, kind: command.kind,
      status: 'draft', createdAt: now, confirmedAt: null, fields: command.fields };
    state.versions.push(version); item.versionIds.push(version.id); event.versionId = version.id;
    if (item.reviewStatus === 'reviewed' || item.reviewStatus === 'queued') item.reviewStatus = 'reopened';
    event.message = `자료 v${version.number} ${command.kind === 'sample' ? '샘플 첨부' : '초안 작성'} · 내용 확인 필요`;
  } else if (command.type === 'confirm' || command.type === 'submit') {
    const version = state.versions.find(v => v.id === command.versionId && v.obligationId === id);
    if (!version || version.id !== item.versionIds.at(-1)) throw new WorkflowError('최신 자료 버전을 확인해주세요.');
    event.versionId = version.id;
    if (command.type === 'confirm') {
      if (version.status === 'user_confirmed') throw new WorkflowError('이미 확인한 자료입니다.');
      version.status = 'user_confirmed'; version.confirmedAt = now; event.message = `자료 v${version.number} 내용 확인 (체험)`;
    } else {
      if (version.status !== 'user_confirmed') throw new WorkflowError('자료 내용을 먼저 확인해주세요.');
      if (state.reviews.some(r => r.versionId === version.id)) throw new WorkflowError('이 버전은 이미 검토 요청했습니다. 보완 후 새 버전으로 제출해주세요.');
      const review = { id: crypto.randomUUID(), obligationId: id, versionId: version.id, status: 'queued' as const, requestedAt: now, reviewedAt: null, reviewer: null, comment: '', internalNote: '', location: '' };
      state.reviews.push(review); item.reviewIds.push(review.id); item.reviewStatus = 'queued';
      event.message = `자료 v${version.number} 검토 요청 · 운영자 검토 대기`;
    }
  } else if (command.type === 'activity') {
    item.activity = { status: 'reported_done', performedAt: command.date, note: command.note };
    event.activityRecord = { ...item.activity };
    event.message = '수행 내용 기록 · 사용자 기록이며 이행 검증 전';
  } else {
    const review = state.reviews.find(r => r.id === command.reviewId && r.obligationId === id);
    if (!review || review.status !== 'queued') throw new WorkflowError('이미 처리되었거나 검토할 수 없는 요청입니다.');
    if (!command.comment.trim()) throw new WorkflowError('검토 범위와 고객에게 전달할 의견을 입력해주세요.');
    review.status = command.decision; review.comment = command.comment; review.internalNote = command.internalNote;
    review.location = command.location; review.reviewedAt = now; review.reviewer = 'JH (데모 역할)';
    item.reviewStatus = review.versionId === item.versionIds.at(-1) ? command.decision : 'reopened';
    event.versionId = review.versionId;
    event.message = command.decision === 'reviewed' ? '자료 검토 완료 · 현장 이행·기관 접수는 별도 확인' : '보완 요청 · 새 버전 재제출 필요';
  }
  item.revision += 1; state.events.push(event);
}
