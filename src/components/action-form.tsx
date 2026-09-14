'use client';
import { useActionState, useTransition, type ReactNode } from 'react';
import type { ActionResult } from '@/domain/types';

export function ActionForm({ action, children, className = '' }: { action: (previous: ActionResult, data: FormData) => Promise<ActionResult>; children: ReactNode; className?: string }) {
  const [state, dispatch, pending] = useActionState(async (previous: ActionResult, data: FormData) => {
    try { return await action(previous, data); }
    catch { return { ok: false, message: '연결이 끊어져 저장 결과를 확인하지 못했습니다. 입력은 유지됩니다. 연결 후 다시 시도해주세요.' }; }
  }, { ok: false, message: '' });
  const [, startTransition] = useTransition();
  return <form className={className} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name) data.set(submitter.name, submitter.value);
    startTransition(() => dispatch(data));
  }}>
    <fieldset disabled={pending}>{children}</fieldset>
    {pending ? <p role="status" className="form-message">저장 중…</p> : null}
    {state.message ? <p role={state.ok ? 'status' : 'alert'} className={`form-message ${state.ok ? 'success' : 'error'}`}>{state.message}</p> : null}
  </form>;
}
