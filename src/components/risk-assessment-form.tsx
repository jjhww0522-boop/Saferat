'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { emptyRiskAssessment, emptyRiskHazard, riskManuals, riskProgress, riskSteps, type RiskAssessment, type RiskHazard, type RiskInputIssue } from '@/domain/risk-assessment';
import { initialRiskJourneyPosition, parseRiskJourneyCursor, riskChapters, riskHelp, riskJourneyCursor, type RiskJourneyPosition } from '@/domain/journey';
import { rememberJourney } from '@/server/journey-actions';
import { JourneyHelp } from './journey-help';
import { RiskScene, RiskStory } from './risk-story';
import { Check } from 'lucide-react';
import { RiskHazardRemove } from './risk-hazard-remove';

type RiskField = Exclude<keyof RiskAssessment, 'format' | 'hazards'>;
type HazardField = Exclude<keyof RiskHazard, 'id'>;
const datePositions: Record<string, [number, number]> = {
  plannedOn: [0, 0], learningOn: [0, 2], announcedOn: [1, 0], participationOn: [1, 1],
  dueOn: [4, 0], performedOn: [4, 1], verifiedOn: [5, 0],
  startedOn: [6, 0], finishedOn: [6, 0], sharedOn: [6, 0], nextReviewOn: [6, 1],
};
function issueInputId(issue: RiskInputIssue) { return issue.hazardId ? `risk-${issue.hazardId}-${issue.field}` : `risk-${issue.field}`; }
function focusIssue(issue: RiskInputIssue) {
  const input = document.getElementById(issueInputId(issue));
  for (let parent = input?.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
  input?.focus({ preventScroll: true });
  input?.scrollIntoView({ block: 'center' });
}
const yesNo = [['unknown', '아직 판단하지 못함'], ['yes', '허용할 수 있음'], ['no', '개선이 필요함']] as const;

export function RiskAssessmentFields({ stored, demo, requestedStep, cursor, workplace, resource, children }: { stored?: RiskAssessment; demo: boolean; requestedStep?: string; cursor?: string | null; workplace: string; resource: string; children?: ReactNode }) {
  const [risk, setRisk] = useState<RiskAssessment>(() => stored ?? emptyRiskAssessment());
  const [position, setPosition] = useState(() => initialRiskJourneyPosition(stored, cursor, requestedStep));
  const { step, chapter } = position;
  const [positionError, setPositionError] = useState(false);
  const [guided, setGuided] = useState(true);
  const [inputIssue, setInputIssue] = useState<RiskInputIssue | null>(null);
  const [removedNotice, setRemovedNotice] = useState(false);
  const [savedNotice, setSavedNotice] = useState<{ message: string; next: string | null } | null>(null);
  const positionSaves = useRef(Promise.resolve());
  const heading = useRef<HTMLHeadingElement>(null);
  const savedProgress = stored ? riskProgress(stored) : null;
  const missingHazard = position.hazardId !== null && !risk.hazards.some(hazard => hazard.id === position.hazardId);
  const remember = useCallback((next: RiskJourneyPosition) => {
    // Keep rapid selection and chapter changes in order without changing the business record.
    positionSaves.current = positionSaves.current.then(async () => {
      try { const result = await rememberJourney(demo, workplace, resource, riskJourneyCursor(next)); setPositionError(!result.ok); }
      catch { setPositionError(true); }
    });
  }, [demo, workplace, resource]);
  useEffect(() => {
    const form = heading.current?.closest('form');
    const next = (event: Event) => {
      const value = (event as CustomEvent<{ next: string | null }>).detail.next;
      const saved = parseRiskJourneyCursor(value);
      setInputIssue(null);
      setSavedNotice({
        message: step === 0 && chapter === 2 && risk.learningStatus === 'needed'
          ? '평가 방법은 확인이 필요한 상태로 저장했어요.'
          : step === 0 && chapter === 0 && risk.scope.trim()
            ? '입력한 작업·장소를 저장했어요.'
            : `‘${riskChapters[step][chapter]}’의 입력 내용을 저장했어요.`,
        next: saved ? riskChapters[saved.step][saved.chapter] : null,
      });
      if (!saved) return;
      setPosition(saved);
      positionSaves.current = positionSaves.current.then(async () => {
        try { const result = await rememberJourney(demo, workplace, resource, riskJourneyCursor(saved)); setPositionError(!result.ok); }
        catch { setPositionError(true); }
      });
      requestAnimationFrame(() => heading.current?.focus());
    };
    const clearNotice = () => { setSavedNotice(null); setRemovedNotice(false); };
    form?.addEventListener('workspace:saved', next);
    form?.addEventListener('submit', clearNotice);
    return () => { form?.removeEventListener('workspace:saved', next); form?.removeEventListener('submit', clearNotice); };
  }, [demo, workplace, resource, step, chapter, risk.learningStatus, risk.scope]);
  useEffect(() => {
    const form = heading.current?.closest('form');
    const failed = (event: Event) => {
      const issue = (event as CustomEvent<RiskInputIssue>).detail;
      const location = datePositions[issue.field];
      if (!location || (issue.hazardId && !risk.hazards.some(hazard => hazard.id === issue.hazardId))) return;
      const target = { step: location[0], chapter: location[1], hazardId: issue.hazardId ?? position.hazardId };
      setSavedNotice(null); setInputIssue(issue); setPosition(target); remember(target);
    };
    form?.addEventListener('workspace:risk-error', failed);
    return () => form?.removeEventListener('workspace:risk-error', failed);
  }, [position.hazardId, risk.hazards, remember]);
  useEffect(() => {
    if (!inputIssue) return;
    const frame = requestAnimationFrame(() => focusIssue(inputIssue));
    return () => cancelAnimationFrame(frame);
  }, [inputIssue]);
  function returnToIssue() {
    if (!inputIssue) return;
    const location = datePositions[inputIssue.field];
    const target = { step: location[0], chapter: location[1], hazardId: inputIssue.hazardId ?? position.hazardId };
    setPosition(target); remember(target);
    requestAnimationFrame(() => focusIssue(inputIssue));
  }
  const progress = riskProgress(risk);
  function field(key: RiskField, label: string, hint?: string, type: 'text' | 'date' | 'area' = 'area') {
    const id = `risk-${key}`;
    const error = inputIssue?.field === key && !inputIssue.hazardId ? inputIssue.message : null;
    const common = { id, value: risk[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setRisk(current => ({ ...current, [key]: e.target.value })); if (error) setInputIssue(null); }, 'aria-invalid': error ? true : undefined, 'aria-describedby': [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined };
    return <label htmlFor={id}>{label}{type === 'area' ? <textarea {...common} rows={2} maxLength={1500}/> : <input {...common} type={type} maxLength={1500}/>}{hint ? <span className="helper" id={`${id}-hint`}>{hint}</span> : null}{error ? <span className="risk-field-error" id={`${id}-error`}>{error}</span> : null}</label>;
  }
  function hazardField(hazard: RiskHazard, key: HazardField, label: string, hint?: string, type: 'text' | 'date' | 'area' = 'area') {
    const id = `risk-${hazard.id}-${key}`;
    const error = inputIssue?.field === key && inputIssue.hazardId === hazard.id ? inputIssue.message : null;
    const common = { id, value: hazard[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { updateHazard(hazard.id, key, e.target.value); if (error) setInputIssue(null); }, 'aria-invalid': error ? true : undefined, 'aria-describedby': [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined };
    return <label htmlFor={id}>{label}{type === 'area' ? <textarea {...common} rows={2} maxLength={1500}/> : <input {...common} type={type} maxLength={key === 'owner' || key === 'verifier' ? 120 : 1500}/>}{hint ? <span className="helper" id={`${id}-hint`}>{hint}</span> : null}{error ? <span className="risk-field-error" id={`${id}-error`}>{error}</span> : null}</label>;
  }
  function updateHazard(id: string, key: HazardField, value: string) {
    setRisk(current => ({ ...current, hazards: current.hazards.map(h => h.id === id ? { ...h, [key]: value } : h) }));
  }
  function hazardChoice(h: RiskHazard, key: 'acceptable' | 'residualAcceptable', label: string) {
    return <label>{label}<select value={h[key]} onChange={e => updateHazard(h.id, key, e.target.value)}>{yesNo.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  }
  function move(next: number, sub = 0) {
    setSavedNotice(null);
    const value = { ...position, step: next, chapter: sub };
    setPosition(value);
    remember(value);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function selectHazard(hazardId: string) {
    setSavedNotice(null);
    const value = { ...position, hazardId };
    setPosition(value);
    remember(value);
  }
  const next = chapter + 1 < riskChapters[step].length ? { step, chapter: chapter + 1 } : step < 6 ? { step: step + 1, chapter: 0 } : null;
  const needsLearningHelp = step === 0 && chapter === 2 && risk.learningStatus === 'needed';
  return <div className="risk-workflow" onChangeCapture={() => setSavedNotice(null)}>
    <input type="hidden" name="risk_assessment" value={JSON.stringify(risk)}/>
    {inputIssue ? <div className="risk-input-recovery"><strong>저장 전 날짜를 확인해주세요</strong><p>입력 내용은 그대로 있어요. 안내된 날짜를 고친 뒤 다시 저장하세요.</p><button type="button" className="text-link" onClick={returnToIssue}>문제 있는 날짜로 이동</button></div> : null}
    {removedNotice ? <p role="status" className="notice">위험요인을 이번 초안에서 제외했어요. 적용하려면 임시 저장해주세요. 이전 저장본은 남아요.</p> : null}
    <div className="risk-workflow-toolbar"><details className="journey-step-picker" open={!guided}><summary><span>{step + 1} / 7단계 · {riskChapters[step][chapter]}</span><span>전체 단계 보기</span></summary><nav className="risk-step-nav" aria-label="위험성평가 진행 단계">{progress.steps.map((item, i) => <button type="button" key={item.id} aria-current={step === i ? 'step' : undefined} onClick={() => move(i)}><span>{i + 1}</span><span>{item.title}<small>{item.ready ? '현재 입력 갖춤' : '작성·확인 필요'}</small></span></button>)}</nav><div className="journey-saved-progress"><span>저장된 기록 준비</span><strong>{savedProgress?.readyCount ?? 0}/7단계</strong><progress aria-label="저장된 기록 준비" max={7} value={savedProgress?.readyCount ?? 0}/><small>현재 입력은 저장한 뒤 지도에 반영돼요.</small></div><p className="helper">현재 입력 기준 {progress.readyCount}/7단계의 기록이 갖춰졌습니다. 법적 이행 완료나 현장 안전을 판정하는 표시가 아닙니다.</p></details></div>
    {progress.unresolvedCount ? <p className="risk-attention risk-status-summary" role="status">확인·개선이 남은 위험요인 {progress.unresolvedCount}건</p> : null}
    <section className="risk-step-panel" aria-label={`${step + 1}단계 ${riskSteps[step].title}`}>
      {savedNotice ? <div className="journey-save-feedback" role="status"><Check size={20} aria-hidden="true"/><p><strong>{savedNotice.message}</strong><span>{savedNotice.next ? `다음은 ‘${savedNotice.next}’이에요. ` : ''}빈 항목은 확인할 내용으로 남아요.</span></p></div> : null}
      <div className="section-heading risk-step-heading"><h3 key={`${step}:${chapter}`} className="question-arrive" ref={heading} tabIndex={-1}>{riskChapters[step][chapter]}</h3><span className="muted">{chapter + 1} / {riskChapters[step].length}</span></div><div className="risk-step-help"><JourneyHelp title={riskHelp[step][0]}><p>위험성평가는 일하다 다칠 수 있는 원인을 찾고, 실제로 줄이는 과정이에요.</p><p>{riskSteps[step].action}</p><p>{riskHelp[step][1]}</p>{step === 2 ? <RiskStory/> : <RiskScene step={step}/>}</JourneyHelp></div>
      {step === 0 ? <><div hidden={guided && chapter !== 0} className="journey-question-group">
        {field('scope', '함께 살펴볼 작업·장소', '평소 작업뿐 아니라 청소·수리·운반·비정상 작업과 함께 일하는 다른 업체도 살펴보세요.')}
        <details className="journey-optional" open={!guided}><summary>평가 구분·담당자·일정도 정할게요</summary>
        <label>이번 평가의 구분<select value={risk.kind} onChange={e => setRisk({ ...risk, kind: e.target.value as RiskAssessment['kind'] })}><option value="unknown">아직 모르겠어요</option><option value="initial">처음 실시하는 평가</option><option value="periodic">기존 결과를 정기적으로 다시 살펴보는 평가</option><option value="occasional">작업 변경·사고 등으로 다시 하는 평가</option></select></label>
        {field('reason', '평가를 시작한 이유', '예: 새 기계를 들여오기 전, 작업 방법이 바뀌어 다시 확인. 실제 상황만 적으세요.')}
        {field('assessor', '평가 담당자와 맡은 역할', '이번 평가를 실제로 진행하는 담당자를 적으세요.', 'text')}
        {field('plannedOn', '평가 예정일', '직접 정한 일정입니다. 법정 실시 시기와 적용 조건은 아래 근거에서 별도로 확인하세요.', 'date')}
        </details></div><div hidden={guided && chapter !== 1} className="journey-question-group">
        {field('criteria', '위험을 판단할 우리 사업장의 기준', '어떤 상태를 낮음·보통·높음으로 볼지, 어디까지 허용할지 적으세요. 낮음이라고 해서 필요한 법정 안전조치를 생략할 수는 없습니다.')}
        <details className="risk-help"><summary>언제 해야 하나요?</summary><p>현행 시행규칙은 최초 작업 시작 전 최초평가, 최초평가 다음 연도부터 매년 1회 이상 정기평가, 추가 위험 발생 우려나 산업재해 등이 있으면 관련 작업 시작 전 수시평가를 정합니다. 이미 운영 중인데 실시하지 않았다면 실제 상황을 기록하고 담당자와 후속 조치를 확인하세요. 과거 날짜로 완료 처리하지 마세요.</p><p className="helper">산업안전보건법 시행규칙 제37조제2항 · 2026.08.01 시행본 확인. 상시평가로 정기·수시를 갈음하는 판단은 이 도구에서 자동 처리하지 않습니다.</p></details>
        <details className="risk-help"><summary>처음이라면: 공식 안내서와 판단 방법</summary><p>이 기록 도구는 위험을 낮음·보통·높음으로 나누는 3단계 판단을 돕습니다. 각 단계의 기준과 허용할 수준은 현장의 작업자와 먼저 정하세요. 익숙한 다른 평가방법을 쓰고 있다면 그 평가표를 증빙으로 함께 보관하세요.</p>{riskManuals.map(manual => <p key={manual.url}><a href={manual.url} target="_blank" rel="noopener noreferrer">{manual.title} ↗</a><span className="helper">{manual.publisher} · {manual.use}</span></p>)}</details>
        </div><div hidden={guided && chapter !== 2} className="journey-question-group"><label>평가 방법을 익힐 준비는 되었나요?<select value={risk.learningStatus} onChange={e => setRisk({ ...risk, learningStatus: e.target.value as RiskAssessment['learningStatus'] })}><option value="unknown">필요한 교육부터 확인할게요</option><option value="needed">설명·교육이 더 필요해요</option><option value="performed">필요한 설명·교육을 실제로 했어요</option><option value="sufficient">관련 지식을 확인해 교육 범위를 조정했어요</option></select></label>
        {risk.learningStatus === 'needed' ? <div className="contextual-guidance learning-guidance"><p role="status"><strong>방법을 먼저 살펴볼까요?</strong></p><p>담당자와 함께 안내를 읽고, 더 필요한 설명·교육을 확인해보세요.</p><JourneyHelp label="평가 방법 안내 보기" title="무엇부터 하면 되는지 살펴봐요"><ol className="journey-tour"><li><strong>작업과 장소를 정해요</strong><p>실제로 하는 작업을 정하고, 그 일을 하는 사람과 살펴볼 범위를 확인해요.</p></li><li><strong>다칠 수 있는 상황을 함께 찾아요</strong><p>현장과 근로자의 의견을 살펴보고, 정한 기준으로 위험을 판단해요.</p></li><li><strong>조치한 뒤 효과를 확인해요</strong><p>계획과 실제 조치, 확인 결과를 구분해 기록하고 필요한 사람과 공유해요.</p></li></ol><p>실제 평가 방법과 담당자에게 필요한 교육은 아래 공식 자료와 함께 확인하세요.</p>{riskManuals.map(manual => <p key={manual.url}><a href={manual.url} target="_blank" rel="noopener noreferrer">{manual.title} ↗</a><span className="helper">{manual.publisher} · {manual.use}</span></p>)}<p>이 안내를 읽어도 교육 실시·참석 기록은 채워지지 않아요.</p></JourneyHelp><p className="helper">지금은 확인이 필요한 상태로 남겨도 돼요. {needsLearningHelp ? '‘확인 필요로 저장’을 누르면 다음 질문인 ‘일정 알리기’로 이동해요.' : '임시 저장하면 설명·교육이 필요한 상태로 보관돼요.'}</p></div> : null}
        <p className="helper">평가 담당자에게 필요한 교육을 준비하세요. 관련 지식이 충분한 경우 필요한 부분 교육이나 생략 여부를 확인하고 이유를 남깁니다. 일률적인 외부 수강·교육시간을 요구하는 칸은 아닙니다.</p>
        {risk.learningStatus === 'sufficient' ? field('learningBasis', '기존 지식·경험과 교육 범위를 정한 이유', '누구의 어떤 지식을 확인했는지, 필요한 부분을 따로 교육했다면 그 내용도 적으세요.') : null}
        <details className="risk-help" open={risk.learningStatus === 'performed'}><summary>사전 설명·교육의 실제 기록</summary><p className="helper">이 기록만으로 별도의 법정 안전보건교육을 대체하지 않습니다.</p>{field('learningOn', '실제 사전 설명일', undefined, 'date')}{field('learningPeople', '함께 배운 사람', '실제로 참석한 사람과 역할을 적으세요.')}{field('learningNote', '함께 익힌 내용·남은 질문')}</details></div>
      </> : null}
      {step === 1 ? <><div hidden={guided && chapter !== 0} className="journey-question-group">
        {field('announcedOn', '일정을 실제로 알린 날', undefined, 'date')}{field('announcementPeople', '일정을 알린 근로자·범위')}{field('announcementNote', '알린 일정과 전달 방법', '예: 게시판에 평가 일정을 안내하고 교대 근무자에게 따로 전달. 전달한 사실과 확인할 내용을 구분하세요.')}
        </div><div hidden={guided && chapter !== 1} className="journey-question-group"><label>근로자가 참여한 방법<select value={risk.participationMethod} onChange={e => setRisk({ ...risk, participationMethod: e.target.value as RiskAssessment['participationMethod'] })}><option value="unknown">아직 확인하지 못함</option><option value="walkthrough">근로자와 현장을 순회 점검함</option><option value="exception">특별한 사정으로 순회 점검 대신 의견 수렴함</option></select></label>
        {risk.participationMethod === 'exception' ? field('participationException', '순회 점검이 어려운 특별한 사정·대신 사용한 방법', '설문·면담 등 실제로 의견을 수렴한 방법과 순회 점검에 참여할 수 없었던 사정을 적으세요.') : null}
        {field('participationOn', '실제 참여·현장 확인일', undefined, 'date')}{field('participants', '실제 참여한 사람·맡은 작업', '사업주 혼자 작성하지 말고 실제 해당 작업을 하는 근로자의 의견을 들으세요.')}{field('workerOpinion', '근로자가 알려준 위험·의견과 반영 내용', '회의록 형식은 자유입니다. 아차사고, 불편한 작업, 개선 의견을 남기고 아직 답을 못한 질문도 적으세요.')}
        <label>근로자대표의 참여 요청이 있었나요?<select value={risk.representativeRequested} onChange={e => setRisk({ ...risk, representativeRequested: e.target.value as RiskAssessment['representativeRequested'] })}><option value="unknown">아직 확인하지 못함</option><option value="yes">참여 요청이 있었음</option><option value="no">확인 결과 요청이 없었음</option></select></label>
        {risk.representativeRequested === 'yes' ? field('representativePeople', '실제 참여한 근로자대표·참여 내용', '근로자대표가 요청하면 참여시켜야 합니다. 요청만 받은 상태와 실제 참여를 구분하세요.') : null}</div>
      </> : null}
      {step >= 2 && step <= 5 ? <>
        {step === 2 ? <p className="helper">예시: 물기가 있는 세척구역에서 운반 중 미끄러질 수 있음. 예시를 복사하기보다 우리 현장에서 확인한 위치·작업·사람을 적으세요.</p> : null}
        {missingHazard ? <p className="notice" role="status" id="risk-hazard-selection-note">이전에 보던 위험요인을 현재 기록에서 찾지 못했어요. 저장하지 않았거나 입력이 취소·변경되었을 수 있어요. {risk.hazards.length ? '아래에서 이어서 살펴볼 위험요인을 선택해주세요.' : '3단계에서 필요한 위험요인을 새로 추가해주세요.'}</p> : null}
        {!risk.hazards.length ? <p className="notice">3단계에서 위험요인을 먼저 추가하세요. 비어 있다고 ‘위험 없음’으로 처리하지 않습니다.</p> : null}
        {risk.hazards.length > 1 || (missingHazard && risk.hazards.length > 0) ? <label>살펴볼 위험요인<select value={missingHazard ? '' : position.hazardId ?? ''} aria-describedby={missingHazard ? 'risk-hazard-selection-note' : undefined} onChange={e => selectHazard(e.target.value)}>{missingHazard ? <option value="" disabled>이어서 살펴볼 위험요인을 선택해주세요</option> : null}{risk.hazards.map((h, i) => <option key={h.id} value={h.id}>위험요인 {i + 1} · {h.hazard || "내용 입력 전"}</option>)}</select></label> : null}
        {risk.hazards.map((h, i) => <fieldset hidden={missingHazard || (guided && h.id !== position.hazardId)} onFocusCapture={() => { if (!guided && h.id !== position.hazardId) selectHazard(h.id); }} className="risk-hazard" key={h.id}><legend>위험요인 {i + 1}{h.hazard ? ` · ${h.hazard.slice(0, 45)}` : ''}</legend>
          {step === 2 ? <>{hazardField(h, 'work', '어떤 작업인가요?')}{hazardField(h, 'location', '어디에서 하나요?', undefined, 'text')}{hazardField(h, 'hazard', '무엇 때문에 어떻게 다칠 수 있나요?')}{hazardField(h, 'people', '누가 영향을 받을 수 있나요?', '해당 작업자뿐 아니라 청소·정비·도급 작업자 등 노출될 수 있는 사람을 살펴보세요.')}{hazardField(h, 'existingControls', '현재 하고 있는 안전조치', '실제 조치를 적으세요. 없다면 없다고 적고, 확인하지 못했다면 아직 판단하지 마세요.')}<RiskHazardRemove hazard={h} onRemove={() => { setSavedNotice(null); setRemovedNotice(true); if (inputIssue?.hazardId === h.id) setInputIssue(null); setRisk(current => ({ ...current, hazards: current.hazards.filter(item => item.id !== h.id) })); requestAnimationFrame(() => heading.current?.focus()); }}/></> : null}
          {step === 3 ? <><p className="preserve-lines">{h.work || '작업 미입력'} · {h.location || '위치 미입력'}</p><label>위험 수준<select value={h.level} onChange={e => updateHazard(h.id, 'level', e.target.value)}><option value="unknown">아직 판단하지 못함</option><option value="low">낮음</option><option value="medium">보통</option><option value="high">높음 · 우선 살펴보기</option></select></label>{hazardChoice(h, 'acceptable', '현재 위험을 허용할 수 있나요?')}{hazardField(h, 'decisionReason', '그렇게 판단한 이유', '1단계의 기준과 현재 안전조치를 비교하고 근로자와 확인한 내용을 적으세요.')}</> : null}
          {step === 4 ? <><div hidden={guided && chapter !== 0} className="journey-question-group">{h.acceptable === 'yes' ? <p className="helper">현재 허용 가능으로 기록했습니다. 유지해야 할 조치와 추가 개선이 있다면 남기세요.</p> : <p className="risk-attention">{h.acceptable === 'unknown' ? '위험 판단이 아직 남아 있습니다.' : '위험을 줄이는 조치가 필요합니다.'}</p>}{hazardField(h, 'measure', '위험을 줄일 구체적인 조치', '위험한 작업 제거·대체를 먼저 검토하고, 설비 개선·작업 방법·보호구 등 가능한 대책을 살펴보세요. 급박한 위험은 서류 작성을 기다리지 말고 작업중지·대피 등 필요한 조치를 하세요.')}<div className="form-grid">{hazardField(h, 'owner', '조치 담당자', undefined, 'text')}{hazardField(h, 'dueOn', '조치 목표일', undefined, 'date')}</div></div><div hidden={guided && chapter !== 1} className="journey-question-group">{hazardField(h, 'performedOn', '실제 조치일', '계획한 날과 실제 실행한 날을 구분하세요.', 'date')}{hazardField(h, 'performedNote', '실제로 한 조치·관련 증빙', '전후 사진이나 작업 기록의 파일명·위치도 적으세요. 파일은 저장 후 아래 증빙 자료에 연결합니다.')}</div></> : null}
          {step === 5 ? <>{h.acceptable === 'yes' ? <p className="helper">처음부터 허용 가능으로 판단한 요인입니다. 유지 상태를 살펴보고 추가 확인 사실을 남길 수 있습니다.</p> : <p className="helper">조치를 했다는 사실과 위험이 충분히 줄었다는 판단을 구분합니다.</p>}<div className="form-grid">{hazardField(h, 'verifiedOn', '조치 후 실제 확인일', undefined, 'date')}{hazardField(h, 'verifier', '현장에서 확인한 사람', undefined, 'text')}</div>{hazardChoice(h, 'residualAcceptable', '조치 후 남은 위험을 허용할 수 있나요?')}{hazardField(h, 'verificationNote', '확인 방법·결과·추가로 할 조치', '개선이 필요하면 5단계의 대책을 보완하세요. 이전 저장 내용은 자료 버전으로 남습니다.')}</> : null}
        </fieldset>)}
        {step === 2 ? <button type="button" className="button secondary" disabled={risk.hazards.length >= 30} onClick={() => { const hazard = emptyRiskHazard(crypto.randomUUID()); setRisk({ ...risk, hazards: [...risk.hazards, hazard] }); selectHazard(hazard.id); }}>위험요인 추가</button> : null}
      </> : null}
      {step === 6 ? <><div hidden={guided && chapter !== 0} className="journey-question-group">
        {progress.unresolvedCount ? <p className="risk-attention">아직 {progress.unresolvedCount}건의 확인·개선이 남았습니다. 남은 위험과 임시 조치도 함께 알리고 후속 조치를 이어가세요.</p> : null}
        <div className="form-grid">{field('startedOn', '평가를 실제로 시작한 날', undefined, 'date')}{field('finishedOn', '평가를 실제로 마친 날', '아직 진행 중이면 비워두세요.', 'date')}</div>
        {field('sharedOn', '결과를 실제로 공유한 날', undefined, 'date')}{field('sharedPeople', '결과를 전달한 근로자·범위', '교대·외국인·도급 작업자 등 필요한 사람이 내용을 이해했는지도 살펴보세요.')}{field('sharedNote', '공유한 결과·방법·확인한 반응', '찾은 위험요인, 위험 판단, 개선대책과 실제 이행 결과를 알려주세요. 작업 전 짧은 안전회의(TBM), 게시, 설명 등에 활용할 수 있습니다.')}
        </div><div hidden={guided && chapter !== 1} className="journey-question-group">{field('nextReviewOn', '다음 확인 예정일', '직접 정한 일정입니다. 작업 변경·사고 등 재평가가 필요한 상황이 생기면 이 날짜까지 기다리지 마세요.', 'date')}{field('reviewTrigger', '어떤 변화가 생기면 다시 살펴볼까요?', '예: 새 설비·재료, 작업 방식 변경, 사고·아차사고, 조치 효과 미흡. 해당 작업의 실제 변화를 적으세요.')}{field('storageNote', '기록·증빙을 보관할 위치와 담당', '평가 내용, 참여·공유 사실, 개선 전후 자료를 함께 찾을 수 있게 정리하세요. 이 서비스에 실제 파일을 연결했는지도 확인하세요.')}
        <p className="helper">현행 시행규칙 제37조의4는 실시 시기·담당자, 참여 근로자·대표, 위험요인, 판단 결과, 개선대책·이행 결과의 기록과 3년 보존을 정합니다.{demo ? ' 이 체험 화면은 실제 보존 장소가 아니므로 실제 자료는 별도로 보관하세요.' : ' 첨부와 과거 버전이 실제로 보관되었는지 확인하고 보존 절차를 따르세요.'}</p>
        <p className="helper">임시 저장 → 증빙 연결 → 작성자 내용 확인 → 필요시 자료 검토를 이어갈 수 있습니다. 검토 결과와 현장의 이행 상태는 각각 관리합니다.</p></div>
      </> : null}
    </section>
    {children}
    <button type="button" className="journey-help-button" aria-pressed={!guided} onClick={() => { setSavedNotice(null); setGuided(value => !value); }}>{guided ? '익숙하다면 · 전체 항목 직접 입력' : '한 번에 하나씩 안내받기'}</button>
    <div className="risk-step-secondary"><button type="button" className="text-link" disabled={step === 0 && chapter === 0} onClick={() => chapter > 0 ? move(step, chapter - 1) : move(step - 1, riskChapters[step - 1].length - 1)}>이전 단계</button>{next ? <button type="button" className="text-link" onClick={() => move(next.step, next.chapter)}>다음 단계</button> : <a className="text-link" href="#evidence-records">저장 후 증빙 연결하기 →</a>}</div><span className="helper">모르는 내용은 비워두세요. 단계 이동만으로는 저장되지 않아요.</span><div className="risk-step-actions task-save-bar"><div className="risk-save-buttons"><button className={`button ${next ? 'secondary' : 'primary'}`}>임시 저장</button>{next ? <button className="button primary" name="journey_next" value={riskJourneyCursor({ ...position, ...next })}>{needsLearningHelp ? '확인 필요로 저장' : '저장하고 다음'}</button> : null}</div></div>{positionError ? <p role="status" className="helper">보던 위치를 저장하지 못했어요. 입력 내용은 임시 저장 버튼으로 보관해주세요.</p> : null}
  </div>;
}
