import Link from 'next/link';
import { workspacePageClient } from '@/server/supabase';
import { logout } from '@/server/workspace-actions';
import { ShieldCheck, Phone, Settings } from 'lucide-react';
import { Navigation } from '@/components/navigation';

export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await workspacePageClient();
  return <div className="workspace-shell member-workspace live-workspace"><a className="skip-link" href="#main">본문으로 건너뛰기</a><aside className="sidebar"><Link className="brand" href="/workspace"><span className="brand-symbol"><ShieldCheck size={23}/></span><span>사업장 안전관리<small>내 일터의 안전 기록</small></span></Link><div className="sidebar-label">우리 사업장</div><Navigation base="/workspace"/><div className="sidebar-bottom"><Link className="emergency-link" href="/emergency" target="_blank" rel="noopener noreferrer">사고·긴급 연락 ↗</Link></div></aside><div className="main-area"><header className="topbar"><Link className="workspace-title" href="/workspace">우리 사업장</Link><nav className="workspace-account" aria-label="작업 공간 메뉴"><details><summary><Settings size={20}/><span>설정</span></summary><div className="workspace-account-menu"><Link href="/workspace/members">구성원</Link><Link href="/workspace/security">추가 인증</Link><form action={logout}><button type="submit">로그아웃</button></form></div></details><Link className="mobile-emergency workspace-emergency" href="/emergency" target="_blank" rel="noopener noreferrer" aria-label="사고·긴급 연락 (새 창)"><Phone size={21}/></Link></nav></header><main id="main" className="page-content live-main">{children}</main></div></div>;
}
