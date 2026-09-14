import Link from 'next/link';
import { ArrowUpRight, ArrowRight, CircleCheck, CircleHelp, Clock3, FilePenLine } from 'lucide-react';
import type { Obligation } from '@/domain/types';

export const reviewLabels = { not_requested: '자료 준비 전', queued: '검토 대기', changes_requested: '보완 요청', reviewed: '자료 검토 완료', reopened: '새 자료 확인 필요' };
export function Badge({ status, children }: { status?: string; children: React.ReactNode }) {
  return <span className={`badge ${status ?? ''}`}>{children}</span>;
}
export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{description}</p></div>{children}</header>;
}
export function TaskRow({ item, applicability }: { item: Obligation; applicability: string }) {
  const missing = applicability === 'needs_review';
  const Icon = missing ? CircleHelp : item.reviewStatus === 'reviewed' ? CircleCheck : item.reviewStatus === 'queued' ? Clock3 : FilePenLine;
  return <Link className="task-row" href={`/app/obligations/${item.id}`}>
    <span className={`task-icon ${missing ? 'amber' : ''}`}><Icon size={23} strokeWidth={1.6} /></span>
    <span className="task-content"><span className="task-title">{item.title}</span><span className="muted">{missing ? '사업장 정보에 추가 답변이 필요해요' : item.description}</span><span className="task-meta">{item.owner} · {item.targetDate ?? '목표일 미정'}</span></span>
    <span className="task-trailing"><Badge status={missing ? 'needs_review' : item.reviewStatus}>{missing ? '확인 필요' : reviewLabels[item.reviewStatus]}</Badge><ArrowUpRight size={19} /></span>
  </Link>;
}
export function Empty({ title, detail, href, action }: { title: string; detail: string; href?: string; action?: string }) {
  return <div className="empty"><CircleCheck size={28} strokeWidth={1.4} /><h3>{title}</h3><p>{detail}</p>{href ? <Link className="text-link" href={href}>{action}<ArrowRight size={16}/></Link> : null}</div>;
}
export function dateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
