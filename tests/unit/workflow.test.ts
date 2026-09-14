import { describe, it, expect } from 'vitest';
import { createSeed, actorFor } from '@/demo/seed';
import { applyCommand, scopedObligation } from '@/domain/workflow';
const fields = { location: '가상 통로', observation: '', owner: '', schedule: '', budget: '' };
describe('자료 → 검토 → 보완 → 새 버전', () => {
  it('실제 수행·접수를 자동 확정하지 않고 각 버전의 의견을 보존', () => {
    const state = createSeed(), member = actorFor('member-a'), reviewer = actorFor('reviewer');
    const item = state.obligations[0];
    const id = item.id;
    applyCommand(state, member, id, item.revision, { type: 'document', kind: 'sample', fields });
    const v1 = state.versions[0];
    expect(v1.fields.budget).toBe(''); expect(item.activity.status).toBe('not_started');
    expect(() => applyCommand(state, member, id, item.revision, { type: 'submit', versionId: v1.id })).toThrow('먼저 확인');
    applyCommand(state, member, id, item.revision, { type: 'confirm', versionId: v1.id });
    applyCommand(state, member, id, item.revision, { type: 'submit', versionId: v1.id });
    const r1 = state.reviews[0];
    applyCommand(state, reviewer, id, item.revision, { type: 'review', reviewId: r1.id, decision: 'changes_requested', comment: '위치를 구체적으로 적어주세요', location: '확인 위치', internalNote: '비공개' });
    expect(item.reviewStatus).toBe('changes_requested');
    applyCommand(state, member, id, item.revision, { type: 'document', kind: 'draft', fields: { ...fields, location: '가상 1층 동쪽 통로' } });
    const v2 = state.versions[1];
    expect(v2.status).toBe('draft'); expect(r1.versionId).toBe(v1.id); expect(v1.fields.location).toBe('가상 통로');
    applyCommand(state, member, id, item.revision, { type: 'confirm', versionId: v2.id });
    applyCommand(state, member, id, item.revision, { type: 'submit', versionId: v2.id });
    applyCommand(state, reviewer, id, item.revision, { type: 'review', reviewId: state.reviews[1].id, decision: 'reviewed', comment: '자료의 위치 항목 확인', location: '확인 위치', internalNote: '' });
    expect(item.reviewStatus).toBe('reviewed'); expect(item.activity.status).toBe('not_started'); expect(item.submissionStatus).toBe('needs_confirmation');
    expect(state.reviews[0].status).toBe('changes_requested'); expect(state.reviews).toHaveLength(2);
  });
  it('낡은 revision과 중복 제출을 거부', () => {
    const state = createSeed(), actor = actorFor('member-a'), item = state.obligations[0];
    applyCommand(state, actor, item.id, 1, { type: 'document', kind: 'draft', fields });
    expect(() => applyCommand(state, actor, item.id, 1, { type: 'document', kind: 'draft', fields })).toThrow('다른 화면');
    expect(state.versions).toHaveLength(1);
    const versionId = state.versions[0].id;
    applyCommand(state, actor, item.id, item.revision, { type: 'confirm', versionId });
    applyCommand(state, actor, item.id, item.revision, { type: 'submit', versionId });
    expect(() => applyCommand(state, actor, item.id, item.revision, { type: 'submit', versionId })).toThrow('이미 검토 요청');
    expect(state.reviews).toHaveLength(1);
  });
  it('요청 후 새 자료 작성 시 이전 버전 검토 완료를 승계하지 않음', () => {
    const state = createSeed(), actor = actorFor('member-a'), item = state.obligations[0];
    applyCommand(state, actor, item.id, item.revision, { type: 'document', kind: 'draft', fields });
    const versionId = state.versions[0].id;
    applyCommand(state, actor, item.id, item.revision, { type: 'confirm', versionId });
    applyCommand(state, actor, item.id, item.revision, { type: 'submit', versionId });
    applyCommand(state, actor, item.id, item.revision, { type: 'document', kind: 'draft', fields });
    applyCommand(state, actorFor('reviewer'), item.id, item.revision, { type: 'review', reviewId: state.reviews[0].id, decision: 'reviewed', comment: '이전 버전만 확인', location: 'v1', internalNote: '' });
    expect(item.reviewStatus).toBe('reopened');
  });
  it.each(['member-b', 'unassigned'] as const)('%s의 A 고객 자원 읽기·변경 거부', persona => {
    const state = createSeed();
    expect(() => scopedObligation(state, actorFor(persona), 'facility-1')).toThrow('접근');
    expect(() => applyCommand(state, actorFor(persona), 'facility-1', 1, { type: 'document', kind: 'draft', fields })).toThrow('접근');
    expect(state.versions).toHaveLength(0);
  });
  it('다른 브라우저 체험 데이터는 공유하지 않음', () => {
    const a = createSeed(), b = createSeed();
    applyCommand(a, actorFor('member-a'), 'facility-1', 1, { type: 'document', kind: 'sample', fields });
    expect(b.versions).toHaveLength(0);
  });
});
