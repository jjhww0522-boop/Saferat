import Link from 'next/link';
import { operatorPageClient } from '@/server/supabase';
import { operatorLogout } from '@/server/operator-actions';
export async function OperatorShell({ children }: { children: React.ReactNode }) {
  const { access } = await operatorPageClient();
  return <div className="live-workspace operator-workspace"><a className="skip-link" href="#main">본문으로 건너뛰기</a><header className="landing-nav"><Link className="brand" href="/ops">중앙관제</Link><nav className="button-row" aria-label="중앙관제 메뉴"><Link href="/ops">검토 대기</Link><Link href="/ops/customers">배정 고객</Link>{access.rules ? <Link href="/ops/rules">법령 준비</Link> : null}<form action={operatorLogout}><button className="button secondary">로그아웃</button></form></nav></header><main id="main" className="live-main">{children}</main></div>;
}
