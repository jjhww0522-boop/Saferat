import Link from 'next/link';
import { readSupabaseConfig } from '@/domain/config';
import { WorkspaceForm } from '@/components/workspace-form';
import { operatorLogin } from '@/server/operator-actions';
export const dynamic = 'force-dynamic';
export default function OperatorLogin() {
  let connected = false;
  try { readSupabaseConfig(process.env); connected = true; } catch { /* Explicit unavailable state. */ }
  return <main className="standalone"><p className="eyebrow">중앙관제</p><h1>운영자 로그인</h1><p className="lede">등록된 운영 계정과 추가 인증이 필요합니다.</p>{connected ? <WorkspaceForm action={operatorLogin}><label>이메일<input name="email" type="email" autoComplete="username" maxLength={254} required/></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" maxLength={1024} required/></label><button className="button primary">운영자 로그인</button></WorkspaceForm> : <div className="notice"><h2>운영자 인증 연결 준비 중</h2><p>인증이 연결되면 등록된 운영 계정으로 이용할 수 있습니다.</p></div>}<Link className="emergency-link" href="/emergency">사고·긴급 연락</Link></main>;
}
