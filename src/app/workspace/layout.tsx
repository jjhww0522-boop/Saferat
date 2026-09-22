import Link from 'next/link';
import { workspacePageClient } from '@/server/supabase';
import { logout } from '@/server/workspace-actions';

export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await workspacePageClient();
  return <div className="live-workspace"><header className="landing-nav"><Link className="brand" href="/workspace">사업장 안전관리</Link><nav className="button-row" aria-label="작업 공간 메뉴"><Link href="/workspace">오늘</Link><Link href="/workspace/map">전체 지도</Link><Link href="/workspace/reviews">검토·보완</Link><Link href="/workspace/documents">자료함</Link><Link href="/workspace/members">구성원</Link><Link href="/workspace/security">추가 인증</Link><Link className="emergency-link" href="/emergency" target="_blank" rel="noopener noreferrer">사고·긴급 연락</Link><form action={logout}><button className="button secondary">로그아웃</button></form></nav></header><main id="main" className="live-main">{children}</main></div>;
}
