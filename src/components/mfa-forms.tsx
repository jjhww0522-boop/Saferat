'use client';
import { useActionState } from 'react';
import { enrollMfa, verifyMfa } from '@/server/workspace-actions';
import { WorkspaceForm } from '@/components/workspace-form';
import type { WorkspaceResult } from '@/domain/workspace';

export function MfaForms() {
  const [setup, enroll, pending] = useActionState<WorkspaceResult, FormData>(enrollMfa, { ok: false, message: '' });
  return <><section className="panel panel-padding"><h2>인증 코드 입력</h2><WorkspaceForm action={verifyMfa}><input type="hidden" name="factor" value={setup.factorId ?? ''}/><label>인증 앱의 6자리 코드<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required/></label><button className="button primary">추가 인증</button></WorkspaceForm></section><section className="panel panel-padding"><h2>인증 앱 처음 등록하기</h2><form action={enroll}><button className="button secondary" disabled={pending || !!setup.secret}>{pending ? '등록 준비 중…' : '등록 키 만들기'}</button></form>{setup.message ? <p role={setup.ok ? 'status' : 'alert'}>{setup.message}</p> : null}{setup.secret ? <div className="notice"><label>인증 앱 등록 키<input readOnly value={setup.secret} autoComplete="off"/></label><p>인증 앱에 이 키를 등록한 뒤 위에 6자리 코드를 입력해주세요.</p></div> : null}</section></>;
}
