'use client';
import { useId, useRef, type ReactNode } from 'react';
import { CircleHelp, X } from 'lucide-react';

export function JourneyHelp({ title, children, label = '모르겠어요 · 예시 보기' }: { title: string; children: ReactNode; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null), button = useRef<HTMLButtonElement>(null), id = useId();
  function close() { dialog.current?.close(); }
  return <><button ref={button} type="button" className="journey-help-button" onClick={() => dialog.current?.showModal()}><CircleHelp size={18}/>{label}</button><dialog ref={dialog} className="journey-dialog" aria-labelledby={id} onClose={() => button.current?.focus()} onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="journey-dialog-inner"><div className="section-heading"><span className="eyebrow">함께 알아봐요</span><button type="button" className="icon-button" aria-label="도움말 닫기" onClick={close}><X size={22}/></button></div><h2 id={id}>{title}</h2>{children}<p className="helper">예시는 이해를 돕는 설명이며 입력 내용으로 저장되지 않아요.</p><div className="button-row"><button type="button" className="button primary" onClick={close}>알겠어요 · 돌아가기</button><a href="/emergency" target="_blank" rel="noopener noreferrer" className="text-link">사고·긴급 연락 ↗</a></div></div></dialog></>;
}
