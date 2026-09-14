import Link from 'next/link';
import { ShieldCheck, Phone, ChevronDown, ArrowUpRight } from 'lucide-react';
import { Navigation } from './navigation';
import { context } from '@/server/store';
import { changePersona, selectWorkplace } from '@/server/actions';

export async function Shell({ children, operator = false }: { children: React.ReactNode; operator?: boolean }) {
  const { actor, workplaces, workplace } = await context();
  return <div className="workspace-shell">
    <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
    <aside className="sidebar">
      <Link href={operator ? '/ops' : '/app'} className="brand"><span className="brand-symbol"><ShieldCheck size={23}/></span><span>사업장 안전관리<small>하나씩, 빠짐없이.</small></span></Link>
      <div className="sidebar-label">{operator ? 'JH 검토 공간' : '우리 사업장'}</div>
      <Navigation operator={operator} />
      <div className="sidebar-bottom"><div className="help-note"><span className="small-label">함께 확인해요</span><p>자료 준비부터 보완까지,<br/>다음 단계를 알려드려요.</p><Link href={operator ? '/ops' : '/app/reviews'}>검토 현황 보기 <ArrowUpRight size={16}/></Link></div>
      <Link className="emergency-link" href="/emergency"><Phone size={18}/> 사고·긴급 연락 <ArrowUpRight size={16}/></Link>
      <div className="sidebar-footer">차분하게 준비하는 안전한 일터</div></div>
    </aside>
    <div className="main-area">
      <div className="demo-strip"><span><strong>체험 공간</strong> 가상 자료만 사용합니다 · 실제 법적 판단에 사용 불가</span><Link href="/demo">체험 안내</Link></div>
      <header className="topbar"><div className="workplace-picker">
        {workplaces.length ? <form action={selectWorkplace}><label className="sr-only" htmlFor="workplace">현장 선택</label><select id="workplace" name="workplace" defaultValue={workplace?.id} key={workplace?.id}>{workplaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select><ChevronDown size={16} aria-hidden="true"/><button className="small-button">전환</button></form> : <strong>배정된 고객 없음</strong>}
        <span className="muted topbar-context">{operator ? '운영자 검토' : '가상 사업장'}</span></div>
        <details className="persona-menu"><summary><span className="avatar">{operator ? 'JH' : actor.persona === 'member-a' ? 'A' : 'B'}</span><span className="persona-text">{operator ? '검토자' : '현장 담당자'}</span><ChevronDown size={15}/></summary><div><p>체험 역할 전환 · 실제 인증 아님</p><form action={changePersona}>{[['member-a', 'A 고객 담당자'], ['member-b', 'B 고객 담당자'], ['reviewer', 'JH 배정 검토자'], ['unassigned', '미배정 검토자']].map(([value, label]) => <button key={value} name="persona" value={value}>{label}</button>)}</form></div></details>
        <Link className="mobile-emergency" href="/emergency" aria-label="사고·긴급 연락"><Phone size={21}/></Link>
      </header>
      <main id="main-content" className="page-content">{children}</main>
      <footer className="content-footer"><span>사업장 안전관리 · 업무 흐름 체험</span><Link href="/app/settings">제공 범위 확인</Link></footer>
    </div>
  </div>;
}
