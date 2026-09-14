import type { DocumentVersion } from '@/domain/types';
import { Badge, dateTime } from './ui';
export function DocumentPreview({ version }: { version: DocumentVersion }) {
  return <article className="document-preview"><div className="document-heading"><span>자체 서식 · 현장 확인 기록</span><Badge status={version.status === 'draft' ? 'needs_review' : 'reviewed'}>{version.status === 'draft' ? '초안' : '사용자 내용 확인'}</Badge></div><h3>현장 확인 기록</h3><p className="muted">가상 자료 · v{version.number} · {dateTime(version.createdAt)}</p>
    {version.kind === 'sample' ? <div className="sample-scene" role="img" aria-label="실제 사진이 아닌 가상 샘플: 복도 통로에 놓인 물품을 표현한 도식"><div className="scene-wall"/><div className="scene-door"/><div className="scene-box"/><span>가상 사진 샘플 · 실제 현장 아님</span></div> : null}
    <dl className="document-fields">{([['location', '확인 위치'], ['observation', '직접 확인한 내용'], ['owner', '담당자'], ['schedule', '예정 일정'], ['budget', '예산']] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{version.fields[key] || <span className="unconfirmed">결정 필요 · 미입력</span>}</dd></div>)}</dl><p className="document-footnote">법정 서식이 아닌 자체 서식입니다. 문서 작성·내용 확인만으로 실제 수행이나 기관 접수가 확인되지 않습니다.</p></article>;
}
