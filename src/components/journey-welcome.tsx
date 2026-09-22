'use client';
import { useState } from 'react';
import { rememberJourney } from '@/server/journey-actions';
import { ArrowRight } from 'lucide-react';

export function JourneyWelcome({ demo, workplace, seen }: { demo: boolean; workplace: string; seen: boolean }) {
  const [open, setOpen] = useState(!seen), [failed, setFailed] = useState(false);
  async function dismiss() {
    try { const result = await rememberJourney(demo, workplace, 'welcome', 'welcome:seen'); setFailed(!result.ok); if (result.ok) setOpen(false); }
    catch { setFailed(true); }
  }
  if (!open) return <button type="button" className="journey-help-button" onClick={() => setOpen(true)}>처음 이용 안내 다시 보기</button>;
  return <section className="journey-welcome" aria-label="처음 이용 안내"><p className="eyebrow">안전관리가 처음이어도, 함께 시작해요</p><h2>사업장에 맞는 일을 찾고<br/>실행과 기록까지 이어가요.</h2><ol><li><span>01</span><strong>사업장 알기</strong><small>장소·작업·사람을 알려주세요</small></li><li><span>02</span><strong>하나씩 실행하기</strong><small>목적과 첫 행동을 안내해요</small></li><li><span>03</span><strong>자료와 보완 정리</strong><small>지도에서 남은 일을 확인해요</small></li></ol><div className="button-row"><button type="button" className="button primary" onClick={dismiss}>알겠어요 · 시작할게요<ArrowRight size={18}/></button><button type="button" className="text-link" onClick={() => setOpen(false)}>안내 건너뛰기</button></div>{failed ? <p role="status">안내 설정을 저장하지 못했어요. 건너뛰고 입력을 시작할 수 있어요.</p> : null}</section>;
}
