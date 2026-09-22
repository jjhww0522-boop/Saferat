import { parseTaskContent, storedAnswerLabel } from './tasks';
import { riskProgress } from './risk-assessment';
import { riskRecordFields } from './risk-record-fields';
import { fileStatusLabels, reviewStatusLabels } from './workspace';

export interface RiskExportSource {
  demo: boolean;
  document: { id: string; title: string };
  cycle?: { taskId: string; number: number } | null;
  version: { id: string; number: number; content: string; created_at: string; confirmed_at: string | null; sample?: boolean };
  reviews: { id: string; version_id: string; status: string; location: string; comment: string; requested_at?: string; reviewed_at?: string | null }[];
  activities: { id: string; performed_on: string; note: string; corrects_id: string | null; recorded_at?: string }[];
  files: { id: string; version_id: string; filename: string; mime_type: string; byte_size: number; sha256: string; state: keyof typeof fileStatusLabels }[];
}

export function buildRiskExport(source: RiskExportSource, exportedAt: string, contentSha256: string) {
  const { document, version } = source;
  const record = parseTaskContent(version.content);
  if (!record?.risk) throw new Error('risk_record_required');
  return {
    format: 'risk-assessment-export-v1' as const,
    exportedAt, source: source.demo ? 'demo' as const : 'live' as const,
    notice: '선택한 저장 버전의 사본입니다. 미저장 입력과 첨부파일 원본은 포함하지 않습니다. 다운로드는 실제 이행·승인·기관 제출·접수 또는 장기 보존 완료를 뜻하지 않습니다.',
    document: { id: document.id, title: document.title },
    cycle: source.cycle ? { taskId: source.cycle.taskId, number: source.cycle.number } : null,
    version: { id: version.id, number: version.number, createdAt: version.created_at, confirmedAt: version.confirmed_at, originalContent: version.content, contentSha256 },
    record, progress: riskProgress(record.risk),
    reviews: source.reviews.filter(r => r.version_id === version.id).map(r => ({ id: r.id, status: r.status, location: r.location, comment: r.comment, requestedAt: r.requested_at ?? null, reviewedAt: r.reviewed_at ?? null })),
    activitiesScope: '내보낸 시점의 문서 전체 수행 이력입니다. 선택한 버전의 작성 당시 상태나 해당 평가 회차의 수행만을 뜻하지 않습니다.',
    activities: source.activities.map(a => ({ id: a.id, performedOn: a.performed_on, note: a.note, correctsId: a.corrects_id, recordedAt: a.recorded_at ?? null })),
    evidence: source.files.filter(f => f.version_id === version.id).map(f => ({ id: f.id, filename: f.filename, mimeType: f.mime_type, byteSize: f.byte_size, sha256: f.sha256, state: f.state })),
    demoSample: source.demo && version.sample === true,
    submissionStatus: 'needs_confirmation' as const,
    retention: { guaranteed: false, note: '파일을 내려받은 뒤 열어서 내용을 확인하고, 증빙 원본과 함께 접근 권한이 관리되는 위치에 보관하세요. 실제 보관 위치는 평가 기록에 직접 남기세요. 적용 보존기간·기산과 장기 보존·복구는 별도 확인이 필요합니다.' },
  };
}
export type RiskExport = ReturnType<typeof buildRiskExport>;

function escape(value: string | number) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
function fields(items: { label: string; value: string }[]) {
  return `<dl>${items.map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value || '미입력 · 확인 필요')}</dd></div>`).join('')}</dl>`;
}
function timestamp(value: string | null) {
  return value ? `${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))} (한국시간)` : '기록 없음';
}
export function riskExportHtml(data: RiskExport) {
  const risk = data.record.risk!;
  const title = `${data.document.title}${data.cycle ? ` · ${data.cycle.number}회차` : ''} · v${data.version.number}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>
body{font-family:system-ui,sans-serif;line-height:1.65;color:#24211e;background:#fff;max-width:900px;margin:32px auto;padding:0 20px;overflow-wrap:anywhere}h1{font-size:1.8rem}h2{font-size:1.25rem;margin-top:2rem}h3{font-size:1.05rem}dl{margin:0}dl>div{padding:8px 0;border-bottom:1px solid #ddd;break-inside:avoid}dt{font-weight:650}dd{margin:2px 0 0;white-space:pre-wrap}p{white-space:pre-wrap}.notice{padding:16px;background:#f5f1e9;border:1px solid #b7afa3}.hazard{margin:24px 0;border-top:2px solid #605548}li{margin:8px 0}@page{size:A4;margin:18mm}@media print{body{max-width:none;margin:0;padding:0;font-size:10pt}h2,h3{break-after:avoid}.print-help{display:none}}
</style></head><body><main><h1>${escape(title)}</h1><p>${data.source === 'demo' ? '가상 체험 자료 · 실제 현장 자료가 아닙니다.' : '작성자가 저장한 위험성평가 기록 사본'}</p><p class="notice">${escape(data.notice)}</p><p class="print-help">인쇄하거나 PDF로 보관하려면 브라우저의 인쇄 메뉴(Ctrl+P / ⌘P)를 사용하세요.</p>
${fields([{ label: '저장 시각', value: timestamp(data.version.createdAt) }, { label: '내보낸 시각', value: timestamp(data.exportedAt) }, { label: '선택 버전의 현재 작성자 확인 상태', value: data.version.confirmedAt ? `내용 확인 · ${timestamp(data.version.confirmedAt)}` : '초안 · 내용 확인 전' }, { label: '기관 제출·접수', value: '미확인' }])}
<h2>남은 확인 사항</h2><p>기록 갖춤 ${data.progress.readyCount}/7 · 확인·개선이 남은 위험요인 ${data.progress.unresolvedCount}건</p><p>기록 갖춤은 법적 이행이나 현장 안전의 판정이 아닙니다.</p><ul>${data.progress.steps.map(step => `<li>${escape(step.title)}: ${step.ready ? '기록 갖춤' : '추가 확인 필요'}</li>`).join('')}</ul>
<h2>평가 준비·참여·공유·보관 기록</h2>${fields(riskRecordFields(risk))}
<h2>위험요인과 판단·개선·재확인</h2>${risk.hazards.length ? risk.hazards.map((hazard, index) => `<section class="hazard"><h3>위험요인 ${index + 1} · ${escape(hazard.hazard || '내용 확인 필요')}</h3>${fields(riskRecordFields(hazard))}</section>`).join('') : '<p>아직 위험요인을 기록하지 않았습니다. 위험이 없다는 뜻은 아닙니다.</p>'}
<h2>기존 확인 답변·메모</h2>${fields([...Object.entries(data.record.fields).map(([label, value]) => ({ label, value })), ...data.record.answers.map((value, i) => ({ label: storedAnswerLabel(data.record, i), value })), { label: '확인 메모', value: data.record.notes }])}
<h2>선택 버전의 현재 검토·보완 이력</h2>${data.reviews.length ? data.reviews.map(review => fields([{ label: '자료 검토 상태', value: reviewStatusLabels[review.status] ?? '상태 확인 필요' }, { label: '검토 위치', value: review.location }, { label: '공개 검토 의견', value: review.comment }, { label: '요청 시각', value: timestamp(review.requestedAt) }, { label: '검토 시각', value: timestamp(review.reviewedAt) }])).join('') : '<p>이 버전의 검토 요청 기록이 없습니다.</p>'}
<h2>문서 전체 수행 이력</h2><p>${escape(data.activitiesScope)}</p>${data.activities.length ? data.activities.map((activity, index) => fields([{ label: '수행 기록', value: `${index + 1}${activity.correctsId ? ` · 기록 ${data.activities.findIndex(a => a.id === activity.correctsId) + 1}의 정정` : ''}` }, { label: '실제 수행일', value: activity.performedOn }, { label: '직접 확인한 내용', value: activity.note }, { label: '기록 시각', value: timestamp(activity.recordedAt) }])).join('') : '<p>별도로 저장한 수행 기록이 없습니다.</p>'}
<h2>선택 버전의 증빙 목록</h2><p>첨부파일 원본은 포함하지 않습니다. 원본 파일은 서비스에서 별도로 내려받아 함께 보관하세요. 검사 대기·사용 제한 파일은 내려받을 수 없습니다.</p>${data.demoSample ? '<p>가상 사진 샘플 연결됨 · 실제 현장 증빙 아님</p>' : ''}${data.evidence.length ? data.evidence.map(file => fields([{ label: '파일 이름', value: file.filename }, { label: '파일 검사 상태', value: fileStatusLabels[file.state] }, { label: '크기', value: `${file.byteSize} bytes` }, { label: '원본 대조용 SHA-256', value: file.sha256 }])).join('') : '<p>실제 첨부파일 목록이 없습니다.</p>'}
<h2>보관할 때 확인하세요</h2><p class="notice">${escape(data.retention.note)}</p><p>JSON 사본에는 저장된 원문과 원문 대조용 SHA-256이 포함됩니다. 이 값은 전자서명이나 기관 접수 증명이 아닙니다. 선택한 자료의 사본이며 서비스 전체 복원 파일은 아닙니다.</p></main></body></html>`;
}
