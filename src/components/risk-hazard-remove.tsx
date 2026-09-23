'use client';
import { useId, useRef } from 'react';
import { emptyRiskHazard, type RiskHazard } from '@/domain/risk-assessment';

export function RiskHazardRemove({ hazard, onRemove }: { hazard: RiskHazard; onRemove: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), keep = useRef<HTMLButtonElement>(null);
  const titleId = useId(), descriptionId = useId();
  const empty = emptyRiskHazard(hazard.id);
  const hasInput = (Object.keys(empty) as (keyof RiskHazard)[]).some(key => hazard[key] !== empty[key]);
  function close() { dialog.current?.close(); }
  function requestRemove() {
    if (!hasInput) { onRemove(); return; }
    dialog.current?.showModal();
    keep.current?.focus();
  }
  return <>
    <button ref={trigger} type="button" className="text-link" onClick={requestRemove}>이 위험요인 입력 취소</button>
    <dialog ref={dialog} className="journey-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onClose={() => trigger.current?.focus()}>
      <div className="journey-dialog-inner">
        <h2 id={titleId}>이번 초안에서 이 위험요인을 제외할까요?</h2>
        <p className="preserve-lines"><strong>{hazard.hazard.trim() || hazard.work.trim() || '내용을 입력한 위험요인'}</strong></p>
        <div id={descriptionId}><p>이 위험요인의 작업·조치·확인 입력이 이번 초안에서 제외돼요.</p><p>이전에 저장한 버전은 남아 있어요. 제외해도 위험이 해결된 것은 아니에요.</p><p>제외한 결과를 보관하려면 임시 저장해주세요.</p></div>
        <div className="button-row"><button ref={keep} type="button" className="button primary" onClick={close}>계속 작성</button><button type="button" className="button secondary" onClick={() => { close(); onRemove(); }}>초안에서 제외</button></div>
      </div>
    </dialog>
  </>;
}
