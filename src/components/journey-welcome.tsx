'use client';
import { useState } from 'react';
import { rememberJourney } from '@/server/journey-actions';

export function JourneyWelcome({ demo, workplace, seen }: { demo: boolean; workplace: string; seen: boolean }) {
  const [open, setOpen] = useState(!seen), [failed, setFailed] = useState(false);
  async function dismiss() {
    try { const result = await rememberJourney(demo, workplace, 'welcome', 'welcome:seen'); setFailed(!result.ok); if (result.ok) setOpen(false); }
    catch { setFailed(true); }
  }
  if (!open) return <button type="button" className="journey-help-button" onClick={() => setOpen(true)}>처음 이용 안내 다시 보기</button>;
  return <section className="welcome-inline" aria-label="처음 이용 안내"><p>아는 정보부터 입력하세요. 필요한 일을 이어서 안내해요.</p><div className="welcome-actions"><button type="button" className="text-link" onClick={dismiss}>알겠어요 · 시작할게요</button><button type="button" className="text-link" onClick={() => setOpen(false)}>안내 건너뛰기</button></div>{failed ? <p role="status">안내 설정을 저장하지 못했어요. 건너뛰고 입력을 시작할 수 있어요.</p> : null}</section>;
}
