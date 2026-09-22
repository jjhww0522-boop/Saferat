import { describe, expect, it } from 'vitest';
import { emptyRiskAssessment, emptyRiskHazard, riskAssessmentSchema, riskHazardSchema } from '@/domain/risk-assessment';
import { buildRiskExport, riskExportHtml, type RiskExportSource } from '@/domain/risk-export';
import { riskRecordFields } from '@/domain/risk-record-fields';

const version = 'cf3c8399-a60d-4e6c-8525-e6ef91c62b06';
function source(): RiskExportSource {
  const risk = { ...emptyRiskAssessment(), scope: '시험 세척장', hazards: [{ ...emptyRiskHazard('hazard-1'), hazard: '<script>alert("실행 금지")</script>', measure: '배수 보완\n바닥 확인' }, emptyRiskHazard('hazard-2')] };
  return {
    demo: true, document: { id: 'demo-doc-1', title: '위험성평가 <시험>' },
    version: { id: version, number: 1, content: JSON.stringify({ format: 'task-record-v1', definition: 'REVIEW-003', notes: '이전 메모', answers: ['기존 확인 답변'], fields: { legacy: '과거 입력' }, risk }), created_at: '2026-09-15T02:00:00Z', confirmed_at: null, sample: true },
    reviews: [{ id: 'r1', version_id: version, status: 'changes_requested', location: '위험요인', comment: '개선 결과 확인 필요' }, { id: 'r2', version_id: 'other', status: 'reviewed', location: '', comment: '다른 버전 의견' }],
    activities: [{ id: 'a1', performed_on: '2026-09-15', note: '처음 직접 기록', corrects_id: null }, { id: 'a2', performed_on: '2026-09-16', note: '직접 정정한 기록', corrects_id: 'a1' }],
    files: [{ id: 'f1', version_id: version, filename: '<img src=x>.pdf', mime_type: 'application/pdf', byte_size: 123, sha256: 'abc', state: 'quarantined' }, { id: 'f2', version_id: 'other', filename: '다른 버전.pdf', mime_type: 'application/pdf', byte_size: 456, sha256: 'def', state: 'clean' }],
  };
}
const time = '2026-09-17T00:00:00Z';
describe('위험성평가 보관 사본', () => {
  it('같은 v1도 회차가 다르면 인쇄 제목에서 구별한다', () => {
    const data = buildRiskExport({ ...source(), cycle: { taskId: 'second', number: 2 } }, time, 'sha');
    expect(riskExportHtml(data)).toContain('2회차 · v1');
    expect(data.cycle).toEqual({ taskId: 'second', number: 2 });
  });
  it('원문·미확인 값·기존 답변과 선택 버전의 증빙·공개 의견을 보존한다', () => {
    const input = source(), before = structuredClone(input);
    const result = buildRiskExport(input, time, 'content-sha');
    expect(result.version.originalContent).toBe(input.version.content);
    expect(result.version.contentSha256).toBe('content-sha');
    expect(result.record.risk?.hazards[1].acceptable).toBe('unknown');
    expect(result.record.answers).toEqual(['기존 확인 답변']);
    expect(result.record.notes).toBe('이전 메모');
    expect(result.reviews.map(r => r.id)).toEqual(['r1']);
    expect(result.evidence.map(f => f.id)).toEqual(['f1']);
    expect(result.activities[1].correctsId).toBe('a1');
    expect(result.activitiesScope).toContain('문서 전체');
    expect(result.submissionStatus).toBe('needs_confirmation');
    expect(result.retention.guaranteed).toBe(false);
    expect(result.demoSample).toBe(true);
    expect(input).toEqual(before);
  });
  it('운영자 내부 메모와 비공개 저장 경로를 사본에 유출하지 않는다', () => {
    const input = source();
    Object.assign(input.reviews[0], { internal_note: '내부 비밀' });
    Object.assign(input.files[0], { object_path: 'private-storage/secret' });
    Object.assign(input.document, { organization_id: 'private-organization' });
    const result = JSON.stringify(buildRiskExport(input, time, 'sha'));
    for (const secret of ['internal_note', '내부 비밀', 'object_path', 'private-storage', 'private-organization']) expect(result).not.toContain(secret);
  });
  it('인쇄 사본은 모든 위험요인·빈 항목·과거 답변을 펼치고 HTML 입력을 실행하지 않는다', () => {
    const html = riskExportHtml(buildRiskExport(source(), time, 'sha'));
    expect(html).toContain('위험요인 2');
    expect(html).toContain('미입력 · 확인 필요');
    expect(html).toContain('아직 확인하지 못함');
    expect(html).toContain('배수 보완\n바닥 확인');
    expect(html).toContain('과거 입력');
    expect(html).toContain('기존 확인 답변');
    expect(html).toContain('파일 검사 대기');
    expect(html).toContain('가상 체험 자료');
    expect(html).toContain('기록 1의 정정');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/<script|<img|<details|\sonclick=/i);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain('다른 버전 의견');
    expect(html).not.toContain('다른 버전.pdf');
  });
  it('평가와 위험요인의 모든 사용자 입력 항목에 표시 이름이 있다', () => {
    const risk = emptyRiskAssessment(), hazard = emptyRiskHazard('h');
    expect(riskRecordFields(risk)).toHaveLength(Object.keys(riskAssessmentSchema.shape).length - 2);
    expect(riskRecordFields(hazard)).toHaveLength(Object.keys(riskHazardSchema.shape).length - 1);
    expect(riskRecordFields({ representativeRequested: 'yes' })[0].value).toBe('요청 있음');
    expect(riskRecordFields({ representativeRequested: 'no' })[0].value).toBe('확인 결과 요청 없음');
  });
  it('구조화된 위험성평가가 없는 자료를 평가 보고서로 만들지 않는다', () => {
    const input = source(); input.version.content = '옛 메모';
    expect(() => buildRiskExport(input, time, 'sha')).toThrow('risk_record_required');
  });
});
