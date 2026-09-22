'use client';
import { useActionState, useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { FormBasis, WorkspaceResult } from '@/domain/workspace';

function formSnapshot(form: HTMLFormElement) {
  // Read controls directly: FormData drops every field while the saving fieldset is disabled.
  const values: [string, string][] = [];
  for (const control of Array.from(form.elements)) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) continue;
    if (!control.name || /(^|_)revision$/.test(control.name) || ['submit', 'button', 'reset'].includes(control.type)) continue;
    if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type) && !control.checked) continue;
    if (control instanceof HTMLInputElement && control.type === 'file') {
      for (const file of Array.from(control.files ?? [])) values.push([control.name, `${file.name}:${file.size}:${file.lastModified}`]);
    } else if (control instanceof HTMLSelectElement && control.multiple) {
      for (const option of Array.from(control.selectedOptions)) values.push([control.name, option.value]);
    } else values.push([control.name, control.value]);
  }
  return JSON.stringify(values);
}

function formRevisions(form: HTMLFormElement): [string, string][] {
  return Array.from(form.elements).flatMap(control => control instanceof HTMLInputElement && control.type === 'hidden' && /(^|_)revision$/.test(control.name) ? [[control.name, control.value] as [string, string]] : []);
}

type FormProps = {
  action: (previous: WorkspaceResult, form: FormData) => Promise<WorkspaceResult>;
  children: ReactNode;
  trackChanges?: boolean;
  /** Stable serialized input for multi-step forms; omit display state and server revision fields. */
  changeKey?: string;
  /** Persisted inputs corresponding to the revisions supplied by the server. */
  serverBasis?: FormBasis;
};

export function WorkspaceForm({ action, children, trackChanges = false, changeKey, serverBasis }: FormProps) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const blockedMessage = useRef<HTMLParagraphElement>(null);
  const revisionBasis = useRef<[string, string][] | null>(null);
  const boundBasis = useRef(serverBasis);
  const baseline = useRef<string | null>(null), submitted = useRef(''), saving = useRef(false), allowUnload = useRef(false);
  const [dirty, setDirty] = useState(false), [saved, setSaved] = useState(false), [blocked, setBlocked] = useState(false);
  const snapshot = useCallback(() => changeKey ?? (form.current ? formSnapshot(form.current) : ''), [changeKey]);
  const [state, dispatch, pending] = useActionState(async (previous: WorkspaceResult, data: FormData) => {
    let result: WorkspaceResult;
    try { result = await action(previous, data); }
    catch { result = { ok: false, message: '연결을 확인하지 못했습니다. 입력을 유지한 채 다시 시도해주세요.' }; }
    saving.current = false;
    if (trackChanges && result.ok) {
      baseline.current = submitted.current;
      if (result.savedBasis) boundBasis.current = result.savedBasis;
      revisionBasis.current = null;
      setDirty(false); setSaved(true); setBlocked(false);
      if (result.redirectTo) allowUnload.current = true;
    }
    if (result.ok) form.current?.dispatchEvent(new CustomEvent('workspace:saved', { detail: { next: data.get('journey_next') } }));
    return result;
  }, { ok: false, message: '' });
  const [, startTransition] = useTransition();
  useEffect(() => { if (state.ok && state.redirectTo) router.push(state.redirectTo); }, [state.ok, state.redirectTo, router]);

  useEffect(() => {
    const current = boundBasis.current;
    // A refresh can replace hidden revisions without replacing local input state.
    // Only the same persisted inputs may advance their metadata revisions. A save
    // response carries its exact basis; an older RSC payload cannot roll it back.
    if (!saving.current && current && serverBasis?.key === current.key && Object.entries(serverBasis.revisions).every(([name, value]) => name in current.revisions && Number(value) >= Number(current.revisions[name]))) boundBasis.current = serverBasis;
  }, [serverBasis, pending]);

  useEffect(() => {
    const element = form.current;
    if (!trackChanges || !element) return;
    if (baseline.current === null) baseline.current = snapshot();
    let active = true;
    const changed = () => snapshot() !== baseline.current;
    const check = () => {
      if (!active) return;
      const unsaved = changed();
      // An unrelated action can refresh hidden revisions while the user's draft remains unchanged.
      // Pin the revision of the displayed inputs, even if they were clean at refresh.
      if (unsaved && revisionBasis.current === null) revisionBasis.current = boundBasis.current ? Object.entries(boundBasis.current.revisions) : formRevisions(element);
      setDirty(unsaved);
      if (!unsaved && !saving.current) { revisionBasis.current = null; setBlocked(false); }
    };
    const afterInput = () => queueMicrotask(check);
    const confirmLeave = () => window.confirm(saving.current
      ? '저장 중입니다. 이동하면 저장 결과를 확인하지 못할 수 있습니다. 이동할까요?'
      : '저장하지 않은 변경사항이 있습니다. 저장하지 않고 이동할까요?');
    const needsConfirmation = () => !allowUnload.current && (saving.current || changed());
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!needsConfirmation()) return;
      event.preventDefault(); event.returnValue = '';
    };
    const samePage = (url: URL) => url.origin === location.origin && url.pathname === location.pathname && url.search === location.search;
    const leaveOnce = () => {
      allowUnload.current = true;
      // A cancelled/failed navigation must not disable the guard for the remaining form.
      window.setTimeout(() => { allowUnload.current = false; }, 0);
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, location.href);
      if (!['http:', 'https:'].includes(url.protocol) || samePage(url) || !needsConfirmation()) return;
      if (!confirmLeave()) { event.preventDefault(); event.stopImmediatePropagation(); }
      else leaveOnce();
    };
    const otherSubmit = (event: SubmitEvent) => {
      if (event.target === element || (!saving.current && !changed())) return;
      event.preventDefault(); event.stopImmediatePropagation();
      setBlocked(true);
      requestAnimationFrame(() => { if (active) blockedMessage.current?.focus(); });
    };
    // Navigation API can cancel browser Back/Forward before Next.js replaces the page.
    // Older browsers retain link and beforeunload protection without rewriting their history.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const navigate = (event: Event) => {
      const destination = event as Event & { navigationType: string; destination: { url: string } };
      if (destination.navigationType !== 'traverse' || !event.cancelable || samePage(new URL(destination.destination.url)) || !needsConfirmation()) return;
      if (!confirmLeave()) event.preventDefault();
      else leaveOnce();
    };
    const observer = new MutationObserver(check);
    observer.observe(element.querySelector('fieldset')!, { subtree: true, childList: true, attributes: true, attributeFilter: ['value', 'checked', 'selected'] });
    element.addEventListener('input', afterInput); element.addEventListener('change', afterInput);
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true); document.addEventListener('submit', otherSubmit, true);
    navigation?.addEventListener('navigate', navigate);
    queueMicrotask(check);
    return () => {
      active = false; observer.disconnect();
      element.removeEventListener('input', afterInput); element.removeEventListener('change', afterInput);
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', click, true); document.removeEventListener('submit', otherSubmit, true);
      navigation?.removeEventListener('navigate', navigate);
    };
  }, [trackChanges, snapshot]);

  const saveState = pending ? 'saving' : state.message && !state.ok ? 'error' : dirty ? 'dirty' : saved ? 'saved' : 'ready';
  return <form ref={form} className="action-form" data-save-state={trackChanges ? saveState : undefined} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (button?.name) data.set(button.name, button.value);
    if (trackChanges) {
      revisionBasis.current ??= boundBasis.current ? Object.entries(boundBasis.current.revisions) : formRevisions(event.currentTarget);
      for (const [name, value] of revisionBasis.current) data.set(name, value);
      submitted.current = snapshot(); saving.current = true; setBlocked(false);
    }
    startTransition(() => dispatch(data));
  }}>
    {trackChanges ? <p className="form-save-state helper" role="status">{saveState === 'saving' ? '저장 중…' : saveState === 'error' ? '저장하지 못했습니다. 입력 내용은 유지됩니다.' : saveState === 'dirty' ? '저장하지 않은 변경사항이 있습니다.' : saveState === 'saved' ? '저장되었습니다.' : '입력한 내용은 임시 저장을 눌러 보관하세요.'}</p> : null}
    {trackChanges && blocked ? <p ref={blockedMessage} className="form-message error" role="alert" tabIndex={-1}>작성 중인 내용을 먼저 임시 저장해주세요. 저장하지 않은 내용은 다른 동작에 포함되지 않습니다.</p> : null}
    <fieldset disabled={pending}>{children}</fieldset>
    {pending && !trackChanges ? <p role="status">처리 중…</p> : null}
    {state.message && !(trackChanges && dirty && state.ok) ? <p className={`form-message ${state.ok ? 'success' : 'error'}`} role={state.ok ? 'status' : 'alert'}>{state.message}</p> : null}
    {state.token ? <div className="notice"><label>초대 코드<input readOnly value={state.token} autoComplete="off"/></label><p className="helper">대상자에게 직접 전달해주세요. 작업 공간의 초대 수락 화면에 입력합니다.</p></div> : null}
  </form>;
}
