import { riskProgress, type RiskAssessment } from '@/domain/risk-assessment';
import { riskRecordFields } from '@/domain/risk-record-fields';

function entries(data: Record<string, unknown>) {
  return <dl className="risk-record-values">{riskRecordFields(data).filter(field => field.value).map(field => <div key={field.label}><dt>{field.label}</dt><dd className="preserve-lines">{field.value}</dd></div>)}</dl>;
}
export function RiskAssessmentSummary({ risk }: { risk: RiskAssessment }) {
  const progress = riskProgress(risk);
  return <div className="risk-stored"><h3>위험성평가 단계별 기록</h3><p>기록 갖춤 {progress.readyCount}/7 · 확인·개선이 남은 위험요인 {progress.unresolvedCount}건</p><p className="helper">작성자가 입력한 사실입니다. 자료 검토·법적 이행 판정·기관 제출 상태와 구분합니다.</p>{entries(risk)}{risk.hazards.map((hazard, i) => <details key={hazard.id}><summary>위험요인 {i + 1} · {hazard.hazard || '내용 확인 필요'}</summary>{entries(hazard)}</details>)}</div>;
}
