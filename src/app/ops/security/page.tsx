import { operatorPageClient } from '@/server/supabase';
import { MfaForms } from '@/components/mfa-forms';
export default async function OperatorSecurity() {
  await operatorPageClient(false);
  return <main className="standalone"><p className="eyebrow">중앙관제</p><h1>추가 인증</h1><p>배정 자료에 접근하기 전에 인증 앱의 코드를 확인합니다.</p><MfaForms/></main>;
}
