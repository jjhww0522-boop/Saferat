import Link from 'next/link';
import { ArrowRight, ShieldCheck, Check, Phone } from 'lucide-react';
import { startDemo } from '@/server/actions';
export default function Landing() {
  return <div className="landing"><header className="landing-nav"><Link className="brand" href="/"><span className="brand-symbol"><ShieldCheck size={23}/></span>사업장 안전관리</Link><Link className="emergency-link" href="/emergency"><Phone size={18}/>사고·긴급 연락</Link></header>
    <main className="landing-main"><p className="eyebrow">더 쉬운 안전관리의 시작</p><h1>해야 할 일은 분명하게.<br/><span>준비는 하나씩, 차근차근.</span></h1><p className="landing-lede">우리 사업장에 필요한 정보를 확인하고,<br/>자료 준비부터 검토·보완까지 한곳에서 이어가세요.</p><form action={startDemo}><button className="button primary">가상 사업장으로 체험하기 <ArrowRight size={19}/></button></form><p className="muted">회원가입·결제 없이 살펴보세요. 실제 고객 자료는 입력하지 않습니다.</p>
    <div className="landing-preview"><div className="preview-head"><span className="small-label">오늘의 업무</span><span className="status-dot"/> 가상 화면</div><h2>현장 사진 점검 기록</h2><p>사진과 직접 확인한 내용을 함께 남겨주세요.</p><div className="preview-flow">{['정보 확인', '자료 준비', '검토·보완'].map((s, i) => <span key={s}><i>{i === 0 ? <Check size={16}/> : i + 1}</i>{s}</span>)}</div><Link href="/demo" className="text-link">체험 범위 먼저 보기 <ArrowRight size={16}/></Link></div>
    <p className="scope-note">현재는 가상 자료와 DEMO 규칙을 사용하는 업무 흐름 체험입니다. 실제 법적 의무의 적용 판단이나 전체 법령 대응을 제공하지 않습니다.</p></main></div>;
}
