import { catalogSources, reviewCandidates } from './review-catalog';

export interface LegalCitation {
  law: string;
  article: string;
  relation: 'activity' | 'record';
  explanation: string;
  url: string;
  effectiveOn: string;
  checkedOn: string;
  scope: string;
}

// Source excerpts are research evidence, not approved applicability rules.
const oshRisk = {
  law: '산업안전보건법',
  url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283449&efYd=20260801&chrClsCd=010202',
  effectiveOn: '2026-08-01', checkedOn: '2026-09-15',
  scope: '2026-08-01 시행본 제36조와 부칙을 확인했습니다. 위험성평가 개정은 2026-06-01 이후 실시하는 평가부터 적용됩니다. 개별 사업장 적용과 고시의 구 규정 정합성은 별도 검토가 필요합니다.',
};
const oshRiskRules = {
  law: '산업안전보건법 시행규칙',
  url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288431&efYd=20260801&chrClsCd=010202',
  effectiveOn: '2026-08-01', checkedOn: '2026-09-15',
  scope: '2026-06-01 시행 개정문과 2026-08-01 시행본 제37조부터 제37조의4까지를 대조했습니다. 조사 근거이며 승인된 사업장 적용 규칙은 아닙니다.',
};
const oshEducation = {
  law: '산업안전보건법',
  url: 'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1032635509',
  effectiveOn: '2026-08-01', checkedOn: '2026-09-15',
  scope: '열람한 원문의 시행일 기준입니다. 검색 발췌의 시행본 표기와 차이가 있어 현행본·하위 규정·제외·특례는 추가 대조가 필요합니다.',
};

const citations: Record<string, LegalCitation[]> = {
  'REVIEW-003': [
    { ...oshRisk, article: '제36조제1항', relation: 'activity', explanation: '사업주의 유해·위험요인 파악, 위험성 판단과 개선대책 수립·이행을 규정합니다.' },
    { ...oshRisk, article: '제36조제2항·제3항', relation: 'activity', explanation: '근로자를 위험성평가에 참여시켜야 하며, 근로자대표가 요구하면 대표도 참여시켜야 합니다.' },
    { ...oshRiskRules, article: '제37조의2', relation: 'activity', explanation: '근로자 참여는 사업장 순회점검이 원칙입니다. 설문·면담 등을 병행할 수 있고, 순회점검 참여가 불가능한 특별한 사정이 있으면 하나 이상의 대체 방법으로 참여시켜야 합니다.' },
    { ...oshRisk, article: '제36조제4항', relation: 'activity', explanation: '위험성평가 관련 사항을 교육·설명회·게시·서면·전자적 방법 등으로 알려야 합니다. 중대재해로 이어질 수 있는 위험은 작업 전 안전점검회의 등을 통한 상시 주지 노력 의무를 구분합니다.' },
    { ...oshRiskRules, article: '제37조의3', relation: 'activity', explanation: '실시 전에는 평가 일정을, 실시 후에는 유해·위험요인, 위험성 수준 결정 결과, 개선대책 수립 내용과 이행 결과를 근로자에게 공유해야 합니다.' },
    { ...oshRiskRules, article: '제37조제1항·제2항', relation: 'activity', explanation: '요인 파악 → 위험성 결정 → 허용 불가능한 위험의 개선대책 수립·이행 순서입니다. 최초 작업 시작 전 최초평가, 다음 연도부터 매년 1회 이상 정기평가, 추가 위험 발생 우려 또는 중대산업사고·산업재해 발생 시 관련 작업 시작 전 수시평가를 규정합니다.' },
    { ...oshRisk, article: '제36조제5항', relation: 'record', explanation: '위험성평가 결과의 기록·보존 의무를 규정하며, 구체적인 항목과 기간은 시행규칙 제37조의4에 정합니다.' },
    { ...oshRiskRules, article: '제37조의4제1항·제2항', relation: 'record', explanation: '실시 시기·담당자, 참여 근로자·근로자대표, 유해·위험요인, 위험성 수준 결정 결과, 개선대책 수립 내용·이행 결과를 기록하고 3년간 보존해야 합니다.' },
  ],
  'REVIEW-015': [{ ...oshEducation, article: '제29조제1항', relation: 'activity', explanation: '사업주가 소속 근로자에게 정기 안전보건교육을 실시하도록 규정합니다. 대상·시간·방법은 하위 규정과 적용 제외를 함께 확인해야 합니다.' }],
  'REVIEW-016': [{ ...oshEducation, article: '제29조제2항', relation: 'activity', explanation: '근로자 채용 또는 작업내용 변경 시 필요한 안전보건교육을 규정합니다. 건설 일용근로자 관련 단서와 교육 면제·특례를 함께 확인해야 합니다.' }],
  'REVIEW-017': [{ ...oshEducation, article: '제29조제3항', relation: 'activity', explanation: '유해·위험작업으로 채용하거나 작업내용을 변경하는 경우 추가 안전보건교육을 규정합니다. 대상 작업과 교육 요건은 하위 규정 확인이 필요합니다.' }],
  'REVIEW-078': [{
    law: '개인정보 보호법', article: '제28조제2항', relation: 'activity',
    explanation: '개인정보처리자가 개인정보취급자에게 정기적으로 필요한 교육을 실시하도록 규정합니다. 실제 개인정보 취급 업무와 교육 대상을 먼저 확인해야 합니다.',
    url: 'https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0028&lsiSeq=283839&urlMode=lsScJoRltInfoR',
    effectiveOn: '2026-09-11', checkedOn: '2026-09-15',
    scope: '해당 시행본의 제28조 본문을 확인했습니다. 개별 사업장의 대상·구체적인 이행 방법에 대한 판정은 별도입니다.',
  }],
};

const selfForms: Record<string, string> = {
  FORM_REGISTRATION: '등록 정보와 실제 작업 장소를 대조하기 위한 서비스 자체 확인표입니다. 이 양식의 작성만으로 법적 신고나 소속 확인을 대신하지 않습니다.',
  FORM_PHOTO: '사진에서 관찰한 내용과 현장에서 확인한 사실을 연결하는 서비스 자체 기록입니다. 작업 종류별 안전조치의 근거는 관련 업무 항목에서 따로 확인합니다.',
  FORM_PLAN: '확인한 목표·담당자·일정·예산을 정리하는 서비스 자체 초안입니다. 법령이 별도로 요구하는 계획서·대장과 동일한 서식으로 취급하지 않습니다.',
};

export function legalBasisFor(id: string) {
  if (Object.hasOwn(selfForms, id)) return {
    kind: 'self_form' as const, status: '자체 서식', summary: selfForms[id],
    citations: [] as LegalCitation[], sources: [], condition: null, research: null,
    documentNote: '이 자체 서식의 작성을 직접 요구하는 특정 조문은 연결되어 있지 않습니다. 관련 법정 활동이나 별도 서류가 필요 없는 것으로 판단하지 않습니다.',
  };
  const candidate = reviewCandidates.find(item => item.id === id);
  if (!candidate) return null;
  const checked = citations[id] ?? [];
  return {
    kind: 'candidate' as const, status: checked.length ? '조문 본문 확인 · 적용 검토 필요' : '조문 확인 중',
    summary: checked.length ? '확인한 조문과 이 업무의 관계입니다. 사업장 적용 여부는 별도로 확인해야 합니다.' : '관련 법령의 조사 위치는 확보했지만, 이 항목의 세부 활동·서류와 조문 연결은 아직 확인 중입니다.',
    citations: checked, condition: candidate.condition, research: candidate.reference,
    sources: candidate.sourceIds.map(sourceId => catalogSources.find(source => source.id === sourceId)!),
    documentNote: checked.some(c => c.relation === 'record')
      ? '결과의 기록·보존 의무와 특정 양식의 사용 의무를 구분합니다. 앱의 사진 기록이나 자체 양식만으로 법정 기록 요건을 모두 충족한다고 판단하지 않습니다.'
      : '교육자료·참석기록·점검표 등은 이행 사실을 확인하기 위한 증빙 예시입니다. 활동 의무만으로 특정 서식의 작성·보존 의무까지 확정하지 않습니다.',
  };
}

export function legalBasisSummary(id: string) {
  const basis = legalBasisFor(id);
  if (!basis) return '근거 미등록';
  if (basis.kind === 'self_form') return '서비스 자체 서식';
  const first = basis.citations[0];
  return first ? `${first.law} ${first.article}${basis.citations.length > 1 ? ' 외' : ''} · 적용 검토 필요` : '조문 확인 중';
}
