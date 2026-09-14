'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, FileScan, Save } from 'lucide-react';
import { ActionForm } from './action-form';
import { saveWorkplace } from '@/server/actions';
import type { Snapshot, Workplace } from '@/domain/types';
import { mockRegistrationProvider } from '@/adapters/registration';

const titles = ['기본 정보', '실제 일하는 현장', '확인하고 시작'];
const keys = ['name', 'industry', 'registrationItems', 'registeredAddress', 'address', 'openingDate', 'issueDate', 'headcount', 'temporary', 'contractors', 'countDate', 'work', 'role', 'photoCheck', 'training', 'contractor'];
const booleans = ['photoCheck', 'training', 'contractor'];
export function OnboardingForm({ workplace, snapshot, ocr }: { workplace: Workplace; snapshot: Snapshot; ocr: 'off' | 'mock' }) {
  const [step, setStep] = useState(0);
  const [candidate, setCandidate] = useState(false);
  const [ocrFields, setOcrFields] = useState<Record<string, string>>({});
  const [ocrError, setOcrError] = useState('');
  async function loadCandidate() {
    try {
      const result = await mockRegistrationProvider.extractRegistration('DEMO_REGISTRATION_001');
      setOcrFields(result.fields); setCandidate(true); setOcrError('');
    } catch { setOcrError('샘플을 읽지 못했습니다. 직접 입력할 수 있어요.'); }
  }
  const [confirmed, setConfirmed] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(keys.map(key => [key, snapshot.facts[key]?.value === null || snapshot.facts[key]?.value === undefined ? booleans.includes(key) ? 'unknown' : '' : String(snapshot.facts[key].value)])));
  function set(key: string, value: string) { setValues(v => ({ ...v, [key]: value })); setConfirmed(false); }
  function input(key: string, label: string, options: { type?: string; hint?: string } = {}) {
    return <label>{label}<input type={options.type ?? 'text'} value={values[key]} onChange={e => set(key, e.target.value)} min={options.type === 'number' ? 0 : undefined} step={options.type === 'number' ? 1 : undefined} maxLength={2000}/>{options.hint ? <small>{options.hint}</small> : null}</label>;
  }
  function question(key: string, label: string) { return <label>{label}<select value={values[key]} onChange={e => set(key, e.target.value)}><option value="unknown">모름 · 추가 확인 필요</option><option value="true">예</option><option value="false">아니요</option></select></label>; }
  return <div className="onboarding"><ol className="stepper">{titles.map((title, i) => <li key={title} aria-current={step === i ? 'step' : undefined} className={step === i ? 'active' : ''}><span>{i + 1}</span>{title}</li>)}</ol>
    <ActionForm action={saveWorkplace.bind(null, workplace.id)} className="panel panel-padding"><input type="hidden" name="revision" value={workplace.revision}/>{keys.map(key => <input key={key} type="hidden" name={key} value={values[key]}/>)}
      <p className="eyebrow">STEP 0{step + 1}</p><h2>{['기본 정보를 확인해주세요', '실제로 일하는 모습을 알려주세요', '확인한 정보만 반영할게요'][step]}</h2>
      {step === 0 ? <><p className="muted">직접 입력하거나 가상 등록증의 읽기 후보를 확인해보세요.</p><div className="ocr-box"><FileScan size={30} strokeWidth={1.3}/><div><strong>사업자등록증 읽기 체험</strong><p>실제 업로드 없이 가상 샘플 후보를 보여드려요.</p></div><button type="button" className="button secondary" disabled={ocr === 'off'} onClick={loadCandidate}>{ocr === 'off' ? 'OCR 미연결 · 직접 입력' : '가상 후보 보기'}</button></div>
        {ocrError ? <p role="alert">{ocrError}</p> : null}{candidate ? <div className="notice amber"><h3>읽기 후보 · 아직 확정되지 않았어요</h3><p>원문: 한결 시설관리 / 서비스업·시설관리·청소 / 가상 본점 주소</p><p>개업일: 2020-01-02 / 발급일: 2026-09-01 (모두 가상 값)</p><p>등록증 읽기와 사업자 상태 조회, 가입자 소속 확인은 서로 다릅니다. 이 체험에서는 실제 대조를 하지 않습니다.</p><button type="button" className="button secondary" onClick={() => { setValues(v => ({ ...v, ...ocrFields })); setConfirmed(false); setCandidate(false); }}>후보를 입력란으로 가져오기</button></div> : null}
        <div className="form-grid">{input('name', '가상 사업장 이름')}{input('industry', '등록 업태')}{input('registrationItems', '등록 종목 전체', { hint: '여러 종목을 그대로 보존합니다.' })}{input('registeredAddress', '등록 주소')}{input('openingDate', '개업일', { type: 'date' })}{input('issueDate', '등록증 발급일', { type: 'date' })}</div></> : null}
      {step === 1 ? <><p className="muted">모르는 항목은 비워두세요. 0명과 미응답은 다르게 저장합니다.</p><div className="form-grid">{input('address', '실제 작업 장소', { hint: '등록 주소와 다른 곳이면 구분해서 적어주세요.' })}{input('work', '실제로 하는 작업', { hint: '예: 청소, 설비 점검, 정비' })}{input('headcount', '직접고용 인원', { type: 'number', hint: '입력 사실이며 법령별 상시근로자 수 계산 결과가 아닙니다.' })}{input('temporary', '직접고용 중 기간제·단시간 인원', { type: 'number', hint: '직접고용 인원의 일부입니다. 중복 합산하지 않습니다.' })}{input('contractors', '다른 업체 소속 작업 인원', { type: 'number' })}{input('countDate', '인원을 확인한 기준일', { type: 'date', hint: '법령별 산정 기간과 정의는 추가 확인 대상입니다.' })}{input('role', '계약상·실제 업무 역할', { hint: '예: 유지보수 수급업체. 불명확하면 비워두세요.' })}</div><h3>체험할 업무 선택</h3><p className="helper">아래 선택은 가상 규칙용입니다. 실제 법적 의무를 확정하지 않습니다.</p><div className="form-grid">{question('photoCheck', '사진과 점검 내용을 기록하나요?')}{question('training', '교육 실시 내용을 기록하나요?')}{question('contractor', '다른 업체와 함께 작업하나요?')}</div></> : null}
      {step === 2 ? <><dl className="confirmation-list"><div><dt>사업장</dt><dd>{values.name}</dd></div><div><dt>업태·종목</dt><dd>{values.industry || '확인 필요'} / {values.registrationItems || '확인 필요'}</dd></div><div><dt>실제 작업 장소</dt><dd>{values.address || '확인 필요'}</dd></div><div><dt>직접고용 인원</dt><dd>{values.headcount === '' ? '확인 필요' : `${values.headcount}명`}</dd></div><div><dt>실제 작업</dt><dd>{values.work || '확인 필요'}</dd></div><div><dt>계약·실제 역할</dt><dd>{values.role || '확인 필요'}</dd></div></dl><label className="checkbox-label"><input type="checkbox" name="confirmed" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>위 가상 정보를 직접 확인했습니다. 비어 있는 값은 확인 필요로 남깁니다.</label><div className="notice">내용 확인은 사업자 소속 인증이나 법적 의무 확인 완료를 뜻하지 않습니다.</div></> : null}
      <div className="wizard-actions"><button type="button" className="button secondary" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft size={16}/>이전</button><button className="button secondary"><Save size={16}/>{step === 2 && confirmed ? '확인한 정보 저장' : '임시 저장'}</button>{step < 2 ? <button type="button" className="button primary" onClick={() => setStep(s => s + 1)}>다음<ArrowRight size={16}/></button> : <Link className="button primary" href="/app/obligations">저장 후 할 일 보기<ArrowRight size={16}/></Link>}</div><p className="helper">입력 내용은 ‘임시 저장’ 또는 ‘확인한 정보 저장’을 누르면 서버에 저장됩니다. 단계 이동만으로는 저장되지 않습니다.</p>
    </ActionForm></div>;
}
