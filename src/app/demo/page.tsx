import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { startDemo } from '@/server/actions';
import { readConfig } from '@/domain/config';
export const dynamic = 'force-dynamic';
export default function DemoPage() {
  let error = '';
  try { readConfig(process.env); } catch (e) { error = (e as Error).message; }
  return <main className="standalone"><Link className="brand" href="/"><ShieldCheck/> 사업장 안전관리</Link><p className="eyebrow">미리 경험하는 업무 흐름</p><h1>가상 사업장에서<br/>처음부터 끝까지 해보세요.</h1><p className="lede">체험을 새로 시작하거나 서버가 재시작되면 이전 체험 자료는 초기화됩니다.</p>
    <ol className="demo-steps"><li><strong>우리 현장 정보 확인</strong><span>시설관리·유지보수 사업장의 샘플 정보를 수정해요.</span></li><li><strong>자료와 수행 내용 준비</strong><span>가상 사진이나 자체 서식 초안을 확인하고 검토를 요청해요.</span></li><li><strong>JH 검토와 보완</strong><span>오른쪽 위에서 역할을 바꿔 의견을 남기고 새 버전을 제출해요.</span></li></ol>
    <div className="notice amber">실제 자료·개인정보를 입력하지 마세요. 가상 샘플만 첨부할 수 있습니다. 역할 전환은 실제 로그인·접근 권한 구현이 아닙니다.</div>
    {error ? <div role="alert" className="notice danger"><h2>실행 설정 확인이 필요합니다</h2><p>{error}</p></div> : <form action={startDemo}><button className="button primary">새 체험 시작 <ArrowRight size={18}/></button></form>}
    <Link className="text-link" href="/emergency">사고·긴급 연락은 바로 확인할 수 있어요</Link></main>;
}
