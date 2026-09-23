'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { WorkspaceForm } from './workspace-form';
import { saveProfile } from '@/server/task-actions';
import { industries, workConditions } from '@/domain/review-catalog';
import { canConfirmProfile, profileQuestionDetails, type ProfileQuestionField, type TaskProfile } from '@/domain/workplace-profile';
import { rememberJourney } from '@/server/journey-actions';
import { JourneyHelp } from './journey-help';

const steps = ['등록정보', '업종·실제 작업', '인원·고용관계', '입력 확인'];
const roles = { unknown: '모름 · 추가 확인 필요', none: '도급 관계 없음', client: '다른 업체에 작업을 맡김', contractor: '다른 업체에서 맡긴 작업을 수행', both: '두 역할 모두 있음' };
const contractGuidance = {
  client: '맡긴 작업에 참여하는 다른 업체 소속 인원을 확인해주세요.',
  contractor: '우리 회사가 직접 고용한 직원은 위에 적어요. 함께 일하는 다른 업체 소속 인원이 있는지 확인해주세요.',
  both: '맡기는 작업과 맡아 하는 작업에 참여하는 다른 업체 소속 인원을 확인해주세요. 같은 사람은 중복 집계하지 않아요.',
};
function focusProfileField(field: ProfileQuestionField) {
  const target = document.getElementById(`profile-${field}`);
  if (!target) return;
  let details = target.closest('details');
  while (details) { details.open = true; details = details.parentElement?.closest('details') ?? null; }
  if (field === 'work') target.querySelector<HTMLInputElement>('input')?.focus();
  else target.focus();
}
export function BusinessProfile({ demo, workplace, profile, back, focus, initialStep = 0 }: { demo: boolean; workplace: string; profile: TaskProfile; back: string; focus?: string; initialStep?: number }) {
  const focusQuestion = profileQuestionDetails(profile).find(question => question.id === focus);
  const [navigation, setNavigation] = useState<{ focus?: string; step: number }>({ focus, step: focusQuestion?.step ?? (focus ? 0 : initialStep) }), [value, setValue] = useState(profile), [confirmed, setConfirmed] = useState(false);
  const [positionError, setPositionError] = useState(false);
  const step = navigation.focus === focus ? navigation.step : focusQuestion?.step ?? 0;
  const heading = useRef<HTMLHeadingElement>(null);
  const stepPicker = useRef<HTMLDetailsElement>(null);
  const focusField = focusQuestion?.field;
  const contractRole = value.facts.contractRole;
  const roleGuidance = contractRole === 'client' || contractRole === 'contractor' || contractRole === 'both' ? contractGuidance[contractRole] : undefined;
  useEffect(() => {
    if (!focusField) return;
    focusProfileField(focusField);
  }, [focus, focusField]);
  function move(next: number, field?: ProfileQuestionField) { setNavigation({ focus, step: next }); if (stepPicker.current) stepPicker.current.open = false; requestAnimationFrame(() => field ? focusProfileField(field) : heading.current?.focus()); void rememberJourney(demo, workplace, 'profile', `profile:${next}`).then(result => setPositionError(!result.ok)).catch(() => setPositionError(true)); }
  useEffect(() => {
    const form = heading.current?.closest('form');
    const next = (event: Event) => { const value = (event as CustomEvent<{ next: string | null }>).detail.next; if (value?.startsWith('profile:')) { const index = Number(value.split(':')[1]); setNavigation({ focus, step: index }); void rememberJourney(demo, workplace, 'profile', value).then(result => setPositionError(!result.ok)).catch(() => setPositionError(true)); requestAnimationFrame(() => heading.current?.focus()); } };
    form?.addEventListener('workspace:saved', next);
    return () => form?.removeEventListener('workspace:saved', next);
  }, [demo, workplace, focus]);
  function description(key: ProfileQuestionField) { return [focusField === key ? 'profile-question-reason' : undefined, roleGuidance && (key === 'contractRole' || key === 'contractors') ? 'profile-contract-role-guidance' : undefined].filter(Boolean).join(' ') || undefined; }
  function fact(key: keyof TaskProfile['facts'], next: string | number | boolean | null) { setValue(p => ({ ...p, facts: { ...p.facts, [key]: next } })); setConfirmed(false); }
  function field(key: keyof TaskProfile['facts'], label: string, type = 'text', hint?: string) {
    return <label>{label}<input id={`profile-${key}`} aria-describedby={description(key)} type={type} inputMode={type === 'number' ? 'numeric' : undefined} value={String(value.facts[key] ?? '')} min={type === 'number' ? 0 : undefined} max={type === 'number' ? 1000000 : undefined} step={type === 'number' ? 1 : undefined} maxLength={2000} onChange={e => fact(key, type === 'number' ? e.target.value === '' ? null : Number(e.target.value) : type === 'date' ? e.target.value || null : e.target.value)}/>{hint ? <small>{hint}</small> : null}</label>;
  }
  const questions = profileQuestionDetails(value);
  return <div className="business-profile">
    <div className="profile-progress"><p><span className="profile-step-count">{step + 1} / {steps.length}</span><strong>{steps[step]}</strong></p><details ref={stepPicker} className="profile-step-picker"><summary>단계 이동</summary><ol className="profile-steps" aria-label="사업장 정보 입력 순서">{steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}><span>{index + 1}</span><button type="button" onClick={() => move(index)}>{label}</button></li>)}</ol></details></div>
    <WorkspaceForm key={workplace} trackChanges serverBasis={{ key: JSON.stringify({ industry: profile.industry, headcount: profile.headcount, work: [...profile.work].sort(), facts: profile.facts }), revisions: { profile_revision: String(profile.revision) } }} changeKey={JSON.stringify({ industry: value.industry, headcount: value.headcount, work: [...value.work].sort(), facts: value.facts })} action={saveProfile.bind(null, demo)}>
      <input type="hidden" name="workplace" value={workplace}/><input type="hidden" name="profile_revision" value={profile.revision}/>
      <input type="hidden" name="profile" value={JSON.stringify({ ...value, revision: profile.revision })}/>
      <div className="profile-section">
        <h2 className="profile-question-heading" ref={heading} tabIndex={-1}>{['어디에서 일하고 계신가요?', '현장에서 어떤 일을 하나요?', '함께 일하는 사람을 알려주세요', '입력한 내용을 함께 확인해요'][step]}</h2>
        {focusQuestion && step === focusQuestion.step ? <div className="profile-questions"><h3>{focusQuestion.label}</h3><p id="profile-question-reason">{focusQuestion.reason}</p></div> : null}
        {step === 0 ? <><div className="profile-essential-fields form-grid">
          {field('businessName', '사업장명')}{field('actualAddress', '실제 작업 장소')}
        </div><details className="journey-optional" open={focusQuestion?.step === 0}><summary>등록증 정보도 입력할게요 · 나중에 보완 가능</summary><div className="form-grid">{field('registeredAddress', '등록 주소')}{field('registrationIndustry', '등록 업태')}{field('registrationItems', '등록 종목')}</div><p className="helper">등록된 주소·업종을 그대로 적어요. 실제 장소·작업과 달라도 괜찮아요.</p></details></> : null}
        {step === 1 ? <><div className="profile-essential-fields form-grid"><label>실제로 하는 작업<textarea id="profile-actualWork" rows={3} maxLength={2000} value={value.facts.actualWork} onChange={e => fact('actualWork', e.target.value)}/></label><label>실제 업무에 가까운 업종<select id="profile-industry" aria-describedby={description('industry')} value={value.industry} onChange={e => { setValue(p => ({ ...p, industry: e.target.value as TaskProfile['industry'] })); setConfirmed(false); }}><option value="all">모름 · 분류 확인 필요</option>{industries.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}</select></label></div><details className="journey-optional" open={focusField === "work"}><summary>작업·설비도 함께 확인할게요</summary><fieldset id="profile-work" aria-describedby={description('work')}><legend>해당하는 작업·설비</legend><div className="profile-work-options">{workConditions.map(w => <label className="checkbox-label" key={w.id}><input type="checkbox" aria-describedby={description('work')} checked={value.work.includes(w.id)} onChange={e => { setValue(p => ({ ...p, work: e.target.checked ? [...p.work, w.id] : p.work.filter(id => id !== w.id) })); setConfirmed(false); }}/>{w.label}</label>)}</div></fieldset><label className="checkbox-label"><input type="checkbox" checked={value.facts.workReviewed} onChange={e => fact('workReviewed', e.target.checked)}/>작업·설비 선택을 확인했습니다. 해당하는 항목이 없으면 선택 없이 확인합니다.</label><p className="helper">아직 확인하지 못했다면 체크하지 마세요. 추가 확인할 정보로 남습니다.</p></details></> : null}
        {step === 2 ? <><div className="profile-essential-fields form-grid"><label>현재 직접고용 인원<input id="profile-headcount" aria-describedby={[description('headcount'), 'profile-count-meaning'].filter(Boolean).join(' ')} type="number" inputMode="numeric" min={0} max={1000000} step={1} value={value.headcount ?? ''} onChange={e => { setValue(p => ({ ...p, headcount: e.target.value === '' ? null : Number(e.target.value) })); setConfirmed(false); }}/></label><label>도급 계약과 실제 역할<select id="profile-contractRole" aria-describedby={description('contractRole')} value={value.facts.contractRole} onChange={e => fact('contractRole', e.target.value)}>{Object.entries(roles).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          {roleGuidance ? <div className="contextual-guidance"><p key={contractRole} className="question-arrive" id="profile-contract-role-guidance">{roleGuidance}</p>{field('contractors', '다른 업체 소속 작업 인원', 'number', '직접고용·파견 인원과 구분해요. 모르면 빈칸, 확인한 결과 없으면 0명을 입력해요.')}</div> : null}</div>
          <p className="helper" id="profile-count-meaning">모르면 빈칸으로 두세요. 0명은 확인한 결과 없다는 뜻이에요.</p>
          <details className="journey-optional" open={!!focusQuestion && focusQuestion.step === 2 && focusField !== 'headcount' && focusField !== 'contractRole'}><summary>고용관계·인원 집계 자세히 입력</summary><div className="form-grid">{field('temporary', '직접고용 중 기간제·단시간 인원', 'number', '직접고용 인원에 포함되는 인원입니다. 다시 합산하지 않습니다.')}{field('dispatched', '파견받아 일하는 인원', 'number')}{!roleGuidance ? field('contractors', '다른 업체 소속 작업 인원', 'number', '위 파견 인원과 구분해 입력해주세요.') : null}{field('countDate', '인원 확인 기준일', 'date')}{field('countBasis', '인원 집계 범위·확인 자료', 'text', '예: 이 현장의 근무자 명부, 집계 기간 등')}</div><p className="helper">이 숫자를 모든 법령의 상시근로자 수로 합산하지 않습니다. 법령별 산정 기간·범위와 고용관계는 별도 확인합니다.</p></details></> : null}
        {step === 3 ? <><dl className="profile-confirmation">
          <div><dt>사업장명</dt><dd>{value.facts.businessName.trim() ? value.facts.businessName : <button type="button" className="text-link" onClick={() => move(0, 'businessName')}>사업장명 입력하기</button>}</dd></div><div><dt>실제 작업 장소</dt><dd>{value.facts.actualAddress.trim() ? value.facts.actualAddress : <button type="button" className="text-link" onClick={() => move(0, 'actualAddress')}>실제 작업 장소 입력하기</button>}</dd></div><div><dt>실제 작업</dt><dd>{value.facts.actualWork.trim() ? value.facts.actualWork : <button type="button" className="text-link" onClick={() => move(1, 'actualWork')}>실제 작업 입력하기</button>}</dd></div><div><dt>업종 분류</dt><dd>{industries.find(i => i.id === value.industry)?.label ?? '분류 확인 필요'}</dd></div><div><dt>직접고용 / 기간제·단시간</dt><dd>{value.headcount === null ? '미확인' : `${value.headcount}명`} / {value.facts.temporary === null ? '미확인' : `${value.facts.temporary}명 (직접고용에 포함)`}</dd></div>
        </dl><details className="profile-review-details"><summary>등록정보·고용관계까지 확인하기</summary><dl className="profile-confirmation"><div><dt>등록 업태·종목</dt><dd>{value.facts.registrationIndustry || '미확인'} / {value.facts.registrationItems || '미확인'}</dd></div><div><dt>등록 주소</dt><dd>{value.facts.registeredAddress || '미확인'}</dd></div><div><dt>작업·설비</dt><dd>{value.work.map(id => workConditions.find(w => w.id === id)!.label).join(' · ') || (value.facts.workReviewed ? '선택한 항목 없음' : '미확인')}</dd></div><div><dt>파견 / 다른 업체</dt><dd>{value.facts.dispatched === null ? '미확인' : `${value.facts.dispatched}명`} / {value.facts.contractors === null ? '미확인' : `${value.facts.contractors}명`}</dd></div><div><dt>인원 기준일·집계 범위</dt><dd>{value.facts.countDate || '미확인'} · {value.facts.countBasis || '미확인'}</dd></div><div><dt>도급 역할</dt><dd>{roles[value.facts.contractRole]}</dd></div></dl></details>{questions.length ? <div className="profile-questions"><h3>추가로 확인할 정보 · {questions.length}개</h3><p>항목을 누르면 해당 입력으로 이동해요. 모르는 내용은 그대로 남겨두고 업무를 시작할 수 있어요.</p><ul>{questions.map(q => <li key={q.id}><button type="button" className="text-link" onClick={() => move(q.step, q.field)}>{q.label}</button></li>)}</ul></div> : null}
          {!canConfirmProfile(value) ? <p className="notice">사업장명, 실제 작업 장소, 실제로 하는 작업을 입력해주세요.</p> : null}
          <label className="checkbox-label"><input type="checkbox" name="confirmed" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>입력 내용을 확인했습니다. 미확인 정보는 추가 확인 대상으로 남깁니다.</label>
        </> : null}
        <div className="profile-context-help"><JourneyHelp title={steps[step]}><p>{['사업장 이름과 실제 일하는 장소부터 적어요. 등록증의 주소·업태·종목은 나중에 보완해도 돼요. 이 입력은 사업장 소속 인증이나 사업자 상태 조회가 아닙니다.', '실제 작업을 직접 적어요. 설명용 예시: 시설 점검과 청소, 물품 운반. 등록된 업종과 다를 수 있어요. 분류를 모르겠다면 모름으로 두세요.', '명부와 계약관계를 아는 담당자에게 확인해보세요. 빈칸은 미확인, 0명은 확인한 결과 없음이에요. 직접고용·파견·다른 업체 소속 인원을 구분하고 집계 기준을 함께 남겨요.', '틀린 내용은 단계 이동에서 돌아가 고쳐요. 확인 체크는 입력을 확인했다는 뜻이며, 미확인 정보를 확정하거나 법적 의무 이행을 완료하는 동작은 아니에요.'][step]}</p></JourneyHelp></div>
      </div>
      <div className="profile-actions-secondary"><button type="button" className="text-link" disabled={step === 0} onClick={() => move(step - 1)}>이전</button><button className="button secondary" name="intent" value="draft">임시 저장</button>{step < 3 ? <button type="button" className="text-link" onClick={() => move(step + 1)}>다음</button> : null}</div><div className="profile-actions"><div className="profile-actions-main">{step < 3 ? <button className="button primary" name="journey_next" value={`profile:${step + 1}`}>저장하고 다음</button> : <button className="button primary" name="intent" value="confirm" disabled={!confirmed || !canConfirmProfile(value)}>확인하고 업무 목록 보기</button>}</div></div>
      <p className="helper">임시 저장하거나 ‘저장하고 다음’을 눌러 보관하세요. 단계 이동과 ‘다음’은 저장하지 않아요.</p>{positionError ? <p role="status" className="helper">보던 위치를 저장하지 못했어요. 입력 내용은 임시 저장 버튼으로 보관해주세요.</p> : null}
    </WorkspaceForm>
    {profile.confirmed_at ? <Link className="back-link" href={back}>← 저장된 정보로 업무 목록 보기</Link> : null}
  </div>;
}
