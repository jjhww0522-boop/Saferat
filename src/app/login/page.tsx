import Link from 'next/link';
import { WorkspaceForm } from '@/components/workspace-form';
import { login } from '@/server/workspace-actions';
import { readConfig } from '@/domain/config';

export const dynamic = 'force-dynamic';
export default function Login() {
  let available = false;
  try { available = readConfig(process.env).app === 'live'; } catch { /* Setup is reported without exposing credentials. */ }
  return <main className="standalone"><Link className="brand" href="/">사업장 안전관리</Link><p className="eyebrow">회원 작업 공간</p><h1>로그인</h1>
    {available ? <section className="panel panel-padding"><p>등록된 계정으로 로그인해주세요. 현장 자료는 배정받은 범위에서 확인할 수 있습니다.</p><WorkspaceForm action={login}><label>이메일<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required maxLength={1024}/></label><button className="button primary">로그인</button></WorkspaceForm></section> : <div className="notice"><h2>회원 작업 공간 연결을 준비하고 있습니다</h2><p>현재는 가상 사업장 체험을 이용할 수 있습니다.</p><Link className="button primary" href="/demo">가상 사업장 체험</Link></div>}
    <Link className="emergency-link" href="/emergency">사고·긴급 연락</Link></main>;
}
