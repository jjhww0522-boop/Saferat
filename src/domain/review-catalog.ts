// Research candidates only. This catalog is deliberately not an executable Rule[].
export const catalogVersion = '2026-09-15.1';
export const catalogStatus = '적용 여부·전문 검토 대기';
export const catalogNotice = '검토 후보 목록입니다. 법적 의무 전체 목록이나 사업장별 적용 판정이 아닙니다. 인원 선택만으로 항목을 제외하지 않습니다.';

export const industries = [
  { id: 'facility', label: '시설관리·유지보수·청소·경비', focus: '도급 관계, 설비 소유·관리주체, 정비·고소·밀폐 작업을 구분합니다.' },
  { id: 'manufacturing', label: '제조·가공', focus: '제품명보다 공정, 기계, 화학물질과 실제 노출을 확인합니다.' },
  { id: 'construction', label: '건설·철거·설치', focus: '공사금액·공종·발주자·도급인·수급인·착공 시점을 별도로 확인합니다.' },
  { id: 'retail', label: '도소매·편의점', focus: '진열·상하차·냉장설비·고객응대·배달·조리 여부를 확인합니다.' },
  { id: 'food', label: '음식점·급식', focus: '조리·가스·열원·후드·식품위생·다중이용업소 해당 여부를 확인합니다.' },
  { id: 'hospitality', label: '숙박·목욕', focus: '객실 정비·세탁·보일러·피난·공중위생 관련 범위를 확인합니다.' },
  { id: 'logistics', label: '운수·창고·배달', focus: '차량·하역·보행 동선·적재·운송수단별 별도 법령을 확인합니다.' },
  { id: 'healthcare', label: '보건·돌봄·사회복지', focus: '감염 노출·환자 이동·야간근무·이용자 피난과 민감자료 권한을 확인합니다.' },
  { id: 'office', label: '사무·IT·금융·전문서비스', focus: '사무실이라는 장소만으로 제외하지 않고 고객응대·현장 작업·연구실을 확인합니다.' },
  { id: 'education', label: '교육·연구', focus: '교직원·급식·시설 작업과 연구활동종사자를 구분합니다.' },
  { id: 'culture', label: '문화·체육·여가', focus: '공연·체육·유원시설·수영장별 운영·관객·설비 안전을 별도 조사합니다.' },
  { id: 'agriculture', label: '농업·임업·어업', focus: '사업 형태·근로자·벌목·농기계·선박 작업을 구분하고 적용 제외와 별도 법령을 확인합니다.' },
  { id: 'waste', label: '수도·하수·폐기물·재생', focus: '수집·선별·파쇄·수조·맨홀·화학물질·환경 인허가를 확인합니다.' },
  { id: 'energy', label: '전기·가스·열 공급', focus: '설비 종류·용량·압력·물질과 공급·사용·정비의 책임을 구분합니다.' },
  { id: 'mining', label: '광업·채석', focus: '광산 해당 여부와 광산안전 관련 별도 법령·감독체계를 확인합니다.' },
  { id: 'personal', label: '수리·세탁·개인서비스', focus: '회전체·세척제·열원·고객응대·공중위생 관련 범위를 확인합니다.' },
  { id: 'public', label: '공공행정·공공서비스', focus: '행정업무와 현업업무, 직종·고용관계·위탁 작업을 구분합니다.' },
  { id: 'other', label: '기타·복합·분류 미정', focus: '가사·국제기관 등 별도 적용 쟁점을 포함해 업종을 확정하지 않고 전체 후보와 작업 조건부터 검토합니다.' },
] as const;
export type IndustryId = typeof industries[number]['id'];

export const categories = [
  { id: 'management', label: '기본·관리체계' }, { id: 'appointment', label: '선임·조직' },
  { id: 'training', label: '교육·훈련' }, { id: 'inspection', label: '작업·점검' },
  { id: 'health', label: '보건·건강' }, { id: 'contract', label: '도급·건설' },
  { id: 'facility', label: '시설·인허가' }, { id: 'incident', label: '사고·기록' },
] as const;
export type CategoryId = typeof categories[number]['id'];

export const workConditions = [
  { id: 'height', label: '고소·추락' }, { id: 'confined', label: '밀폐공간' },
  { id: 'machine', label: '기계·정비' }, { id: 'vehicle', label: '차량·하역' },
  { id: 'chemical', label: '화학물질' }, { id: 'electric', label: '전기' },
  { id: 'fire', label: '화기·가스' }, { id: 'contractor', label: '도급·혼재작업' },
  { id: 'customer', label: '고객응대' }, { id: 'night', label: '야간근무' },
  { id: 'heat', label: '폭염·한파' }, { id: 'lifting', label: '중량물·반복작업' },
  { id: 'infection', label: '감염·생물요인' }, { id: 'publicFacility', label: '이용자·공중시설' },
] as const;
export type WorkId = typeof workConditions[number]['id'];

export const headcountBands = [
  { id: 'unknown', label: '미확인', note: '미응답은 0명이 아닙니다. 고용형태·산정 기간·사업/사업장 단위·수급인 포함 여부부터 확인합니다.' },
  { id: 'zero', label: '0명', note: '직접고용 0명이어도 다른 업체 작업자·노무제공자·시설 이용자와 설비 관련 검토는 남습니다.' },
  { id: '1-4', label: '1~4명', note: '중대산업재해 규정의 5명 미만 제외 검토와 다른 안전·시설 의무를 구분합니다. 입력 인원이 법령별 상시근로자 수와 같은지 먼저 확인합니다.' },
  { id: '5-9', label: '5~9명', note: '중대산업재해 적용범위·책임 주체를 우선 확인합니다. 안전보건교육은 업종·직무·작업별 제외·특례를 따로 검토합니다.' },
  { id: '10-19', label: '10~19명', note: '휴게시설 설치 의무와 설치·관리기준 준수 대상 구분, 특정 직종 인원 조건을 확인합니다. 10명이라는 숫자만으로 적용을 정하지 않습니다.' },
  { id: '20-49', label: '20~49명', note: '제조업·임업·일부 환경업 등 안전보건관리담당자 대상 업종과 휴게시설 기준을 우선 대조합니다. 모든 업종에 같은 선임 기준을 적용하지 않습니다.' },
  { id: '50-99', label: '50~99명', note: '관리책임자·안전관리자·보건관리자·위원회·관리규정의 업종별 표를 각각 검토합니다. 모두 50명부터라는 뜻은 아닙니다.' },
  { id: '100-299', label: '100~299명', note: '업종별 선임·위원회·관리규정 조건, 자격·인원수·위탁 가능 범위를 대조합니다. 공사는 공사금액 등 별도 기준도 확인합니다.' },
  { id: '300-499', label: '300~499명', note: '안전·보건관리자 전담 및 위탁 조건을 확인합니다. 업종·공사 기준과 다른 법령의 전담조직을 구분합니다.' },
  { id: '500+', label: '500명 이상', note: '회사 단위의 이사회 보고와 전담조직 조건을 우선 검토합니다. 주식회사 여부·사업장별 조직·건설회사 별도 요건도 확인합니다.' },
] as const;
export type HeadcountBand = typeof headcountBands[number]['id'];

export interface CatalogSource {
  id: string;
  title: string;
  url: string;
  inspectedUrl: string;
  checkedOn: string | null;
  level: '발췌 확인' | '서지 확인' | '조사 경로';
  scope: string;
}
export const catalogSources: CatalogSource[] = [
  { id: 'osh', title: '산업안전보건법', url: 'https://www.law.go.kr/법령/산업안전보건법', inspectedUrl: 'https://law.go.kr/LSW/lsInfoP.do?ancYnChk=0&lsId=001766', checkedOn: '2026-09-15', level: '발췌 확인', scope: '교육·위험성평가·안전보건조치·고객응대 관련 검색 발췌 확인. 조문 전체·부칙·적용 예외 대조는 미완료.' },
  { id: 'osh-decree', title: '산업안전보건법 시행령', url: 'https://www.law.go.kr/법령/산업안전보건법시행령', inspectedUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288347&efYd=20260801', checkedOn: '2026-09-15', level: '서지 확인', scope: '2026-08-01 시행본 서지 확인. 선임·교육 적용 제외·별표 전체는 본문 대조 대기.' },
  { id: 'osh-rule', title: '산업안전보건법 시행규칙', url: 'https://www.law.go.kr/법령/산업안전보건법시행규칙', inspectedUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288431&efYd=20260801', checkedOn: '2026-09-15', level: '서지 확인', scope: '2026-08-01 시행본 서지 확인. 별표 4·5의 현행 교육시간·내용과 예외는 대조 대기.' },
  { id: 'osh-standard', title: '산업안전보건기준에 관한 규칙', url: 'https://www.law.go.kr/법령/산업안전보건기준에관한규칙', inspectedUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=273603&efYd=20260302', checkedOn: '2026-09-15', level: '서지 확인', scope: '2026-03-02 시행본 서지 확인. 작업별 질문은 조사 제안이며 개별 조문·기술 수치 매핑 대기.' },
  { id: 'risk', title: '사업장 위험성평가에 관한 지침', url: 'https://www.law.go.kr/행정규칙/사업장위험성평가에관한지침', inspectedUrl: 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000251014&chrClsCd=010202&lsId=2052906', checkedOn: '2026-09-15', level: '발췌 확인', scope: '평가 방법·기록 관련 발췌 확인. 현행 시행본·최초/정기/수시/상시평가 조건 대조 대기.' },
  { id: 'serious', title: '중대재해 처벌 등에 관한 법률', url: 'https://www.law.go.kr/법령/중대재해처벌등에관한법률', inspectedUrl: 'https://moel.go.kr/news/enews/explain/enewsView.do?news_seq=16128', checkedOn: '2026-09-15', level: '발췌 확인', scope: '고용노동부의 5~50명 미만 확대 적용 설명 확인. 법령별 산정·책임·중대시민재해와 시행령 대조 대기.' },
  { id: 'manager', title: '안전보건관리담당자 선임·업무 조사', url: 'https://www.law.go.kr/법령/산업안전보건법시행령/제24조', inspectedUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?lspttninfSeq=75384&chrClsCd=010202', checkedOn: '2026-09-15', level: '발췌 확인', scope: '2026-03-24 시행본 제24조의 20~50명 미만 및 열거 업종 발췌 확인. 2026-08-01 시행본과 최종 대조 대기.' },
  { id: 'rest', title: '휴게시설 설치·관리 기준 안내', url: 'https://www.law.go.kr/법령/산업안전보건법시행령/제96조의2', inspectedUrl: 'https://www.kosha.or.kr/ebook/fcatalog/access/ecatalogt.jsp?Dir=528&callmode=normal&catimage=&eclang=ko&start=20&um=s', checkedOn: '2026-09-15', level: '발췌 확인', scope: '공단 자료의 인원·특정 직종·관계수급인 포함 안내 발췌 확인. 설치 의무와 제재 대상의 구별 및 현행 원문 대조 대기.' },
  { id: 'board', title: '이사회 보고 대상·회사 단위 해석', url: 'https://www.law.go.kr/법령/산업안전보건법/제14조', inspectedUrl: 'https://www.law.go.kr/LSW/cgmExpcInfoP.do?cgmExpcDatSeq=30216&mode=2&ofiClsCd=350101', checkedOn: '2026-09-15', level: '발췌 확인', scope: '고용노동부 1차 해석의 주식회사·회사 전체 인원 구별 확인. 개별 회사 적용과 현행 시행령 요건은 재검토 필요.' },
  { id: 'fire', title: '화재의 예방 및 안전관리에 관한 법률', url: 'https://www.law.go.kr/법령/화재의예방및안전관리에관한법률', inspectedUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?chrClsCd=010202&lsId=014189&lsiSeq=253511&urlMode=lsInfoP', checkedOn: '2026-09-15', level: '발췌 확인', scope: '법령명·안전관리 관련 발췌 확인. 대상물 등급·선임·교육·훈련의 현행 조건 대조 대기.' },
  { id: 'fire-equipment', title: '소방시설 설치 및 관리에 관한 법률', url: 'https://www.law.go.kr/법령/소방시설설치및관리에관한법률', inspectedUrl: '', checkedOn: null, level: '조사 경로', scope: '자체점검·결과보고·보완 관련 원문 조사 대기.' },
  { id: 'electric', title: '전기안전관리법', url: 'https://www.law.go.kr/법령/전기안전관리법', inspectedUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=272917', checkedOn: '2026-09-15', level: '발췌 확인', scope: '제22조 선임과 검사 관련 발췌 확인. 설비 분류·용량·예외·교육·주기의 현행 원문 대조 대기.' },
  { id: 'elevator', title: '승강기 안전관리법', url: 'https://www.law.go.kr/법령/승강기안전관리법', inspectedUrl: 'https://law.go.kr/LSW/lsInfoP.do?lsiSeq=259475&viewCls=lsRvsDocInfoR', checkedOn: '2026-09-15', level: '발췌 확인', scope: '선임·자체점검·안전검사 조사 위치 확인. 검색에 구 시행본도 포함되어 통보 기한·교육·점검 주기는 확정하지 않음.' },
  { id: 'structure', title: '시설물의 안전 및 유지관리에 관한 특별법', url: 'https://www.law.go.kr/법령/시설물의안전및유지관리에관한특별법', inspectedUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=279977', checkedOn: '2026-09-15', level: '발췌 확인', scope: '시행령의 시설 분류·점검·보수 경과조치 발췌 확인. 개별 시설 지정·등급·현행 주기 대조 대기.' },
  { id: 'food', title: '식품위생법', url: 'https://www.law.go.kr/법령/식품위생법', inspectedUrl: 'https://law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1017622531', checkedOn: '2026-09-15', level: '발췌 확인', scope: '제41조 교육 관련 발췌 확인. 영업종류·교육 대상·건강진단·주기의 현행 원문 대조 대기.' },
  { id: 'multiuse', title: '다중이용업소의 안전관리에 관한 특별법', url: 'https://www.law.go.kr/법령/다중이용업소의안전관리에관한특별법', inspectedUrl: 'https://www.law.go.kr/법령/다중이용업소의안전관리에관한특별법', checkedOn: '2026-09-15', level: '발췌 확인', scope: '목적·안전시설·보험 관련 검색 발췌 확인. 면적·층·영업 형태·교육 대상과 현행 조문 매핑 대기.' },
  { id: 'laboratory', title: '연구실 안전환경 조성에 관한 법률', url: 'https://www.law.go.kr/법령/연구실안전환경조성에관한법률', inspectedUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?efYd=20260520&lsiSeq=283355&urlMode=lsInfoP', checkedOn: '2026-09-15', level: '발췌 확인', scope: '적용 기관 정의 관련 발췌 확인. 연구실별 점검·교육·조직·예외 대조 대기.' },
  { id: 'chemical', title: '화학물질관리법', url: 'https://www.law.go.kr/법령/화학물질관리법', inspectedUrl: 'https://www.law.go.kr/lsInfoP.do?lsiSeq=279031', checkedOn: '2026-09-15', level: '발췌 확인', scope: '시행규칙의 취급시설·예방관리계획 관련 발췌 확인. 물질 분류 개정·수량·취급 구분·교육 조건 대조 대기.' },
  { id: 'gas', title: '가스 3법 조사 출발점', url: 'https://www.law.go.kr/법령/고압가스안전관리법', inspectedUrl: '', checkedOn: null, level: '조사 경로', scope: '고압가스·액화석유가스·도시가스를 분리하여 조사. 종류·압력·용량·설치 형태 미확인.' },
  { id: 'dangerous', title: '위험물안전관리법', url: 'https://www.law.go.kr/법령/위험물안전관리법', inspectedUrl: '', checkedOn: null, level: '조사 경로', scope: '위험물 종류·지정수량 배수·시설·예방규정·선임·교육 원문 조사 대기.' },
  { id: 'mechanical', title: '기계설비법', url: 'https://www.law.go.kr/법령/기계설비법', inspectedUrl: '', checkedOn: null, level: '조사 경로', scope: '건축물 규모·기계설비·유지관리자·성능점검·교육 원문 조사 대기.' },
  { id: 'construction', title: '건설기술 진흥법', url: 'https://www.law.go.kr/법령/건설기술진흥법', inspectedUrl: '', checkedOn: null, level: '조사 경로', scope: '공사별 안전관리계획·점검·관리비의 대상과 주체 원문 조사 대기.' },
  { id: 'building', title: '건축물관리법', url: 'https://www.law.go.kr/법령/건축물관리법', inspectedUrl: '', checkedOn: null, level: '조사 경로', scope: '건축물 점검·해체 관련 범위와 시설물안전법 중복·제외 원문 조사 대기.' },
  { id: 'public-health', title: '공중위생관리법', url: 'https://www.law.go.kr/법령/공중위생관리법', inspectedUrl: '', checkedOn: null, level: '조사 경로', scope: '숙박·목욕·세탁·미용 등 영업별 위생관리·교육 조사 대기.' },
  { id: 'mining', title: '광산안전법', url: 'https://www.law.go.kr/법령/광산안전법', inspectedUrl: '', checkedOn: null, level: '조사 경로', scope: '광산의 정의·관리체계·검사·교육과 산안법 관계 조사 대기.' },
  { id: 'seafarer', title: '선원법', url: 'https://www.law.go.kr/법령/선원법', inspectedUrl: '', checkedOn: null, level: '조사 경로', scope: '선박 종류·승무관계·선내안전과 산안법 관계 조사 대기.' },
  { id: 'equality', title: '남녀고용평등과 일·가정 양립 지원에 관한 법률', url: 'https://www.law.go.kr/법령/남녀고용평등과일ㆍ가정양립지원에관한법률', inspectedUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1029335959', checkedOn: '2026-09-15', level: '발췌 확인', scope: '제13조 성희롱 예방 교육 발췌 확인. 규모·구성별 방법·특례·현행 조건 대조 대기.' },
  { id: 'disability', title: '장애인고용촉진 및 직업재활법', url: 'https://www.law.go.kr/법령/장애인고용촉진및직업재활법', inspectedUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1033122843', checkedOn: '2026-09-15', level: '발췌 확인', scope: '제5조의2 교육 관련 발췌 확인. 규모별 교육방법·내용·강사 요건·다른 인식개선교육과의 관계 대조 대기.' },
  { id: 'pension', title: '근로자퇴직급여 보장법', url: 'https://www.law.go.kr/법령/근로자퇴직급여보장법', inspectedUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=222701', checkedOn: '2026-09-15', level: '발췌 확인', scope: '구 시행령의 퇴직연금 가입자 교육 방법 발췌 확인. 현행 법·시행령과 제도별 대상·방법은 대조 대기.' },
  { id: 'privacy', title: '개인정보 보호법', url: 'https://www.law.go.kr/법령/개인정보보호법', inspectedUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?efYd=20250313&lsiSeq=248613&urlMode=lsInfoP', checkedOn: '2026-09-15', level: '발췌 확인', scope: '개인정보취급자 교육 관련 발췌 확인. 모든 근로자 대상 일률 교육시간으로 확정하지 않음. 현행 원문 대조 대기.' },
];

export interface ReviewCandidate {
  id: string;
  title: string;
  category: CategoryId;
  industries: IndustryId[];
  work: WorkId[];
  focus: HeadcountBand[];
  condition: string;
  checks: string[];
  evidence: string[];
  sourceIds: string[];
  reference: string;
}

export const reviewCandidates: ReviewCandidate[] = [
  { id: 'REVIEW-001', title: '업종·사업장·실제 작업 분류', category: 'management', industries: [], work: [], focus: ['unknown', 'zero'], condition: '모든 후보 검토의 출발점. 등록 업태와 실제 활동, 사업/사업장 단위가 다를 수 있음.', checks: ['주업·부업·현장 작업과 한국표준산업분류를 대조했는가?', '본사·지점·현장이 독립된 사업장인지 확인했는가?'], evidence: ['등록정보 확인표', '공정·조직·현장 목록'], sourceIds: ['osh', 'osh-decree'], reference: '법 제3조·시행령 적용범위 및 별표 조사' },
  { id: 'REVIEW-002', title: '법령별 인원 산정과 고용관계', category: 'management', industries: [], work: ['contractor'], focus: ['unknown', 'zero', '1-4', '5-9'], condition: '입력 인원은 법령별 상시근로자 수의 확정값이 아님.', checks: ['직접고용·기간제·단시간·일용·파견·수급인·노무제공자를 구분했는가?', '산정 기간·포함 범위·합산 단위와 기준일을 남겼는가?'], evidence: ['개인정보를 최소화한 인원 산정표', '고용·계약 관계표'], sourceIds: ['osh-decree', 'serious', 'rest'], reference: '각 의무별 정의·산정 단위 대조 필요' },
  { id: 'REVIEW-003', title: '위험성평가와 개선 추적', category: 'management', industries: [], work: [], focus: [], condition: '실제 작업 위험과 적용범위·평가 방법을 확인.', checks: ['작업자 의견과 사고·변경 사항에서 위험을 찾았는가?', '개선 담당·기한·결과를 연결하고 작업자에게 알렸는가?'], evidence: ['위험성평가 기록', '개선 전후 증빙'], sourceIds: ['osh', 'risk'], reference: '법 제36조·위험성평가 지침 조사' },
  { id: 'REVIEW-004', title: '중대산업재해 안전보건관리체계', category: 'management', industries: [], work: ['contractor'], focus: ['1-4', '5-9', '10-19', '20-49', '50-99', '100-299', '300-499', '500+'], condition: '상시근로자 산정·사업 단위·경영책임자·실질적 지배 관계 확인. 중대시민재해는 별도.', checks: ['목표·인력·예산·위험 개선 절차의 실제 운영을 확인했는가?', '종사자 의견·도급 평가·비상 대응·이행점검을 연결했는가?'], evidence: ['관리체계 운영 기록', '예산 집행·이행점검 자료'], sourceIds: ['serious'], reference: '법 제3~5조 및 시행령 의무별 조사' },
  { id: 'REVIEW-005', title: '안전보건관리규정', category: 'management', industries: [], work: [], focus: ['50-99', '100-299', '300-499', '500+'], condition: '사업 종류·인원별 작성 대상과 적용 제외를 별도로 대조.', checks: ['작성 대상과 포함할 내용을 확인했는가?', '근로자 참여·심의 또는 동의 절차와 변경 이력이 있는가?'], evidence: ['관리규정 버전', '제정·변경 절차 기록'], sourceIds: ['osh', 'osh-rule'], reference: '법 제25~28조·시행규칙 관련 별표 조사' },
  { id: 'REVIEW-006', title: '대표이사 안전보건계획·이사회 보고', category: 'management', industries: [], work: [], focus: ['500+'], condition: '회사 형태·회사 전체 인원·건설회사 별도 조건을 확인. 사업장 인원만으로 판단하지 않음.', checks: ['보고·승인 대상 회사인지 확인했는가?', '실제 예산·인력·시설 계획과 승인·이행 기록이 있는가?'], evidence: ['안전보건계획', '이사회 의사록·이행 기록'], sourceIds: ['board', 'osh-decree'], reference: '법 제14조·시행령 제13조 조사' },
  { id: 'REVIEW-007', title: '법령 게시·안전보건표지·변경관리', category: 'management', industries: [], work: [], focus: [], condition: '현장 언어·위험·적용 법령과 변경 시점을 확인.', checks: ['작업자가 필요한 내용과 표지를 이해할 수 있는가?', '설비·물질·도급·인원 변경 시 검토 항목을 갱신하는가?'], evidence: ['게시·표지 확인 사진', '변경 검토 기록'], sourceIds: ['osh', 'osh-rule'], reference: '법령 요지 게시·표지 관련 조문 및 적용범위 대조 대기' },
  { id: 'REVIEW-008', title: '안전보건관리책임자', category: 'appointment', industries: [], work: [], focus: ['50-99', '100-299', '300-499', '500+'], condition: '업종·사업장 규모 또는 공사 기준·실질 총괄권한 확인.', checks: ['관련 대상 표와 실제 총괄 책임자를 대조했는가?', '선임 사실·직무·권한·교육 이력을 확인했는가?'], evidence: ['선임·직무 문서', '교육 이력'], sourceIds: ['osh', 'osh-decree'], reference: '법 제15조·시행령 대상 사업 별표 조사' },
  { id: 'REVIEW-009', title: '관리감독자 지정·현장 업무', category: 'appointment', industries: [], work: [], focus: [], condition: '직책명보다 작업을 직접 지휘·감독하는 실제 역할 및 적용 제외 확인.', checks: ['작업별 지휘·감독자를 확인했는가?', '작업 전 확인·문제 보고·교육의 실제 기록이 있는가?'], evidence: ['역할 배정표', '업무·교육 기록'], sourceIds: ['osh', 'osh-decree'], reference: '법 제16조·시행령 업무 범위 조사' },
  { id: 'REVIEW-010', title: '안전관리자 선임·자격·전담', category: 'appointment', industries: [], work: [], focus: ['50-99', '100-299', '300-499', '500+'], condition: '업종별 인원·공사금액·선임 수·자격·전담·위탁 조건을 각각 확인.', checks: ['대상 표·자격·필요 인원을 대조했는가?', '전담·위탁·선임 보고와 업무 수행 근거가 있는가?'], evidence: ['선임·자격·위탁 자료', '업무·보고 기록'], sourceIds: ['osh', 'osh-decree'], reference: '법 제17조·시행령 안전관리자 관련 별표 조사' },
  { id: 'REVIEW-011', title: '보건관리자·산업보건의', category: 'appointment', industries: [], work: [], focus: ['50-99', '100-299', '300-499', '500+'], condition: '각 역할의 업종·인원·자격·예외·위탁 조건을 구분.', checks: ['보건관리자와 산업보건의의 대상 조건을 각각 확인했는가?', '건강자료 접근 범위와 실제 보건 업무를 확인했는가?'], evidence: ['선임·위탁 자료', '개인정보를 제외한 보건활동 기록'], sourceIds: ['osh', 'osh-decree'], reference: '법 제18조·제22조 및 시행령 관련 조항 조사' },
  { id: 'REVIEW-012', title: '안전보건관리담당자', category: 'appointment', industries: ['manufacturing', 'agriculture', 'waste'], work: [], focus: ['20-49'], condition: '20~50명 미만 구간과 제조업·임업·열거 환경업의 실제 해당 여부를 현행 원문으로 대조.', checks: ['열거 업종과 사업장 단위 인원을 확인했는가?', '자격·교육·선임과 실제 업무 증빙이 있는가?'], evidence: ['선임·교육 자료', '업무 수행 기록'], sourceIds: ['manager', 'osh-decree'], reference: '시행령 제24~26조·현행본 대조 대기' },
  { id: 'REVIEW-013', title: '산업안전보건위원회', category: 'appointment', industries: [], work: [], focus: ['50-99', '100-299', '300-499', '500+'], condition: '업종·규모·공사별 대상 및 노사 구성 조건 확인.', checks: ['사업장별 설치 대상과 노사 위원을 확인했는가?', '안건·회의·의결·이행 결과가 연결되어 있는가?'], evidence: ['위원 구성 자료', '회의록·이행 기록'], sourceIds: ['osh', 'osh-decree'], reference: '법 제24조·시행령 위원회 대상 별표 조사' },
  { id: 'REVIEW-014', title: '안전보건 전담조직·권한·인력', category: 'appointment', industries: [], work: ['contractor'], focus: ['500+'], condition: '중대재해처벌법 시행령의 사업 단위·기존 선임 인력·규모·건설회사 조건 확인.', checks: ['전담조직 설치 요건을 개별 안전관리자 전담 요건과 구분했는가?', '조직의 실제 인력·권한·업무·예산이 확인되는가?'], evidence: ['조직도·업무분장', '권한·예산 근거'], sourceIds: ['serious'], reference: '중대재해처벌법 시행령의 전담조직 요건 조사 대기' },
  { id: 'REVIEW-015', title: '근로자 정기 안전보건교육', category: 'training', industries: [], work: [], focus: ['1-4', '5-9'], condition: '업종·적용 제외·사무직/판매직/그 외 직무·교육 특례 확인.', checks: ['교육 대상자와 직무별 과정·시간·주기를 현행 별표에서 확인했는가?', '실제 실시·참석·내용·강사 요건을 증빙하는가?'], evidence: ['대상·교육계획', '실시·참석·교재 기록'], sourceIds: ['osh', 'osh-decree', 'osh-rule'], reference: '법 제29조·시행규칙 별표 4·5와 제외·특례 조사. 시간 미확정.' },
  { id: 'REVIEW-016', title: '채용 시·작업내용 변경 시 교육', category: 'training', industries: [], work: [], focus: [], condition: '고용형태·근로계약기간·작업 변경·교육 면제 및 대체 인정 조건 확인.', checks: ['신규 배치와 변경 작업자를 빠뜨리지 않았는가?', '해당 작업의 교육을 실제 실시했는가?'], evidence: ['채용·배치변경 기록', '과정·참석 증빙'], sourceIds: ['osh', 'osh-rule'], reference: '법 제29조·시행규칙 별표 4·5 조사. 시간·면제 확정 전.' },
  { id: 'REVIEW-017', title: '유해·위험작업 특별교육', category: 'training', industries: [], work: ['height', 'confined', 'machine', 'vehicle', 'chemical', 'electric', 'fire'], focus: [], condition: '실제 작업이 특별교육 대상 작업에 해당하는지 확인. 업종명·장비명만으로 확정하지 않음.', checks: ['작업별 대상표와 단기·간헐 작업 등의 특례를 확인했는가?', '정기·채용교육과 별도 요건 또는 대체 조건을 대조했는가?'], evidence: ['대상 작업·작업자 목록', '실시내용·시간·참석 기록'], sourceIds: ['osh', 'osh-rule'], reference: '법 제29조제3항·시행규칙 별표 4·5 조사. 대상별 시간 미확정.' },
  { id: 'REVIEW-018', title: '관리감독자 교육', category: 'training', industries: [], work: [], focus: [], condition: '실제 지휘·감독 역할·적용 제외·교육 방법·감면 조건 확인.', checks: ['대상 관리감독자와 교육과정·주기를 확인했는가?', '실제 이수와 교육 방법별 인정 범위가 확인되는가?'], evidence: ['대상자 목록', '이수·교육내용 증빙'], sourceIds: ['osh', 'osh-rule'], reference: '법 제29조 및 시행규칙 교육 별표·특례 조사' },
  { id: 'REVIEW-019', title: '안전보건 관계자 직무교육', category: 'training', industries: [], work: [], focus: ['20-49', '50-99', '100-299', '300-499', '500+'], condition: '관리책임자·안전/보건관리자·담당자 등 직무별 신규·보수·면제 구분.', checks: ['역할별 교육 대상과 선임·변경 시점을 확인했는가?', '교육기관·이수·다음 교육 기준을 대조했는가?'], evidence: ['선임 이력', '직무교육 이수자료'], sourceIds: ['osh', 'osh-rule'], reference: '법 제32조 및 관련 직무교육 규정 조사' },
  { id: 'REVIEW-020', title: '건설업 기초안전보건교육', category: 'training', industries: ['construction'], work: ['contractor'], focus: [], condition: '건설 일용근로자 해당 여부·기이수 확인·다른 교육과의 관계 조사.', checks: ['투입 전 대상·이수 사실을 확인했는가?', '특별교육·현장 위험 안내를 기초교육으로 모두 대체하지 않았는가?'], evidence: ['대상·이수 확인자료', '현장 위험 안내 기록'], sourceIds: ['osh', 'osh-rule'], reference: '법 제31조·시행규칙 관련 교육표 조사' },
  { id: 'REVIEW-021', title: '물질안전보건자료(MSDS) 교육', category: 'training', industries: [], work: ['chemical'], focus: [], condition: '대상 물질·취급자·신규 물질·작업 변경 등 교육 사유 확인.', checks: ['현장 물질과 최신 자료를 연결했는가?', '노출·보호·응급 대응에 필요한 내용을 실제 교육했는가?'], evidence: ['물질·자료 목록', '교육 실시 기록'], sourceIds: ['osh', 'osh-rule'], reference: 'MSDS 교육 조항·교육내용 원문 매핑 대기' },
  { id: 'REVIEW-022', title: '소방안전관리자 교육·훈련', category: 'training', industries: [], work: ['fire', 'publicFacility'], focus: [], condition: '소방안전관리 대상물·관리자 자격·교육 종류와 소방훈련 대상을 구분.', checks: ['관리자 실무교육과 관계인·종사자 훈련을 구분했는가?', '피난 계획과 실제 훈련 결과를 확인했는가?'], evidence: ['선임·교육자료', '훈련·개선 기록'], sourceIds: ['fire'], reference: '소방안전관리·교육·훈련 조항 현행 대조 대기' },
  { id: 'REVIEW-023', title: '다중이용업소 소방안전교육', category: 'training', industries: ['food', 'hospitality', 'culture', 'retail', 'personal'], work: ['publicFacility'], focus: [], condition: '다중이용업소 업종·면적·층·구조와 업주/종업원별 교육 대상 확인.', checks: ['영업 형태와 교육 대상자를 대조했는가?', '신규·보수·수시 등 교육 사유를 구분했는가?'], evidence: ['영업·시설 기본정보', '교육 이수자료'], sourceIds: ['multiuse'], reference: '대상 정의·교육 조항과 하위 규정 매핑 대기' },
  { id: 'REVIEW-024', title: '식품위생교육·영업자 확인', category: 'training', industries: ['food', 'retail', 'hospitality', 'education', 'healthcare'], work: [], focus: [], condition: '식품 영업종류·집단급식소 여부·교육 책임자 확인. 산안법 교육과 구분.', checks: ['영업자·책임자·대상자의 교육 요건을 확인했는가?', '교육 이수와 조리 종사자의 위생관리를 연결했는가?'], evidence: ['영업·급식소 정보', '위생교육 이수자료'], sourceIds: ['food'], reference: '식품위생법 제41조 및 하위 규정 조사' },
  { id: 'REVIEW-025', title: '연구활동종사자 안전교육', category: 'training', industries: ['education', 'manufacturing', 'healthcare', 'office'], work: ['chemical', 'infection'], focus: [], condition: '연구실안전법 적용 기관·연구활동·위험 등급·종사자 구분.', checks: ['연구실별 교육 대상·과정·특례를 확인했는가?', '실험 변경과 사고 대응 교육 이력을 연결했는가?'], evidence: ['연구실·종사자 목록', '교육 이수자료'], sourceIds: ['laboratory'], reference: '연구실안전법 교육·훈련 및 하위 규정 조사' },
  { id: 'REVIEW-026', title: '통로·바닥·계단·피난 동선', category: 'inspection', industries: [], work: [], focus: [], condition: '이동·작업·이용자 동선과 실제 장애물을 확인.', checks: ['젖은 바닥·적치물·단차·조명 문제를 기록했는가?', '비상구·피난 통로의 사용 가능 상태를 확인했는가?'], evidence: ['위치가 있는 점검 기록', '개선 전후 사진'], sourceIds: ['osh-standard', 'fire'], reference: '작업장·통로·피난 관련 조문 매핑 대기. 자체 점검 질문.' },
  { id: 'REVIEW-027', title: '고소작업·개구부·사다리·작업발판', category: 'inspection', industries: ['facility', 'construction', 'manufacturing', 'logistics', 'agriculture', 'energy'], work: ['height'], focus: [], condition: '작업 높이뿐 아니라 작업 방법·추락 경로·설비 종류 확인.', checks: ['안전한 작업 방법·발판·난간·개구부 방호를 확인했는가?', '보호구·고정점·작업자 배치와 구조 계획을 검토했는가?'], evidence: ['작업 방법·설비 확인표', '방호·개선 사진'], sourceIds: ['osh-standard'], reference: '추락·비계·작업발판 규정 매핑 대기. 수치 기준 미확정.' },
  { id: 'REVIEW-028', title: '밀폐공간 출입·측정·환기·구조', category: 'inspection', industries: ['facility', 'construction', 'waste', 'manufacturing', 'energy', 'agriculture'], work: ['confined'], focus: [], condition: '공간의 명칭이 아닌 구조·공기 상태·작업과 밀폐공간 대상 정의 확인.', checks: ['공간 목록·출입 절차·측정·환기·감시를 검토했는가?', '비상 연락과 구조 장비·훈련을 확인했는가?'], evidence: ['작업 프로그램·출입 기록', '실측·장비·훈련 기록'], sourceIds: ['osh-standard'], reference: '밀폐공간 관련 정의·보건작업 프로그램 조사. 측정값 생성 금지.' },
  { id: 'REVIEW-029', title: '기계 방호·비상정지·회전체', category: 'inspection', industries: ['manufacturing', 'food', 'waste', 'agriculture', 'personal', 'mining'], work: ['machine'], focus: [], condition: '기계 종류·위험부·사용·청소·막힘 제거 작업 확인.', checks: ['방호장치·덮개·인터록의 상태와 임의 해체를 확인했는가?', '비상정지와 안전한 접근·작업 방법을 확인했는가?'], evidence: ['기계별 확인표', '결함·보수 기록'], sourceIds: ['osh-standard'], reference: '기계 종류별 방호·작업 규정 조사. 자체 점검 질문.' },
  { id: 'REVIEW-030', title: '정비·청소 시 에너지 차단', category: 'inspection', industries: ['facility', 'manufacturing', 'waste', 'energy', 'personal'], work: ['machine', 'electric'], focus: [], condition: '전기·압력·열·중력·잔류 에너지와 재기동 가능성 확인.', checks: ['정지·차단·잠금·표지 및 잔류 에너지 처리를 검토했는가?', '작업자 확인 후 복구하는 절차가 있는가?'], evidence: ['정비 작업 절차', '차단·복구 확인 기록'], sourceIds: ['osh-standard'], reference: '정비 중 운전정지 등 작업별 조항 매핑 대기' },
  { id: 'REVIEW-031', title: '지게차·차량·하역·보행자 분리', category: 'inspection', industries: ['logistics', 'manufacturing', 'retail', 'construction', 'waste', 'agriculture'], work: ['vehicle'], focus: [], condition: '장비 종류·운행 장소·하역 방법·운전자 자격 확인.', checks: ['차량과 보행자 동선·접촉 위험·유도 방법을 확인했는가?', '적재·시야·장비 상태·작업계획을 검토했는가?'], evidence: ['운행·작업계획', '장비·자격 확인자료'], sourceIds: ['osh-standard'], reference: '차량계 하역운반기계·작업계획 관련 규정 조사' },
  { id: 'REVIEW-032', title: '크레인·호이스트·줄걸이', category: 'inspection', industries: ['manufacturing', 'construction', 'logistics', 'energy', 'mining'], work: ['machine', 'lifting'], focus: [], condition: '양중기 종류·능력·매다는 물체·검사·작업자 요건 확인.', checks: ['인양 경로·출입 통제·신호 체계를 확인했는가?', '줄걸이 용구·하중·장비 결함을 확인했는가?'], evidence: ['인양 작업계획', '용구·장비 점검자료'], sourceIds: ['osh-standard'], reference: '양중기·달기구 작업 규정 조사. 허용하중 미확정.' },
  { id: 'REVIEW-033', title: '용접·절단·화기작업', category: 'inspection', industries: ['facility', 'construction', 'manufacturing', 'energy', 'personal'], work: ['fire'], focus: [], condition: '가연물·가스·분진·밀폐공간·인접 작업 여부 확인.', checks: ['화재·폭발 위험과 불티 비산 범위를 확인했는가?', '감시·소화·환기·작업 전후 확인을 검토했는가?'], evidence: ['화기작업 확인 기록', '주변 정리·방호 사진'], sourceIds: ['osh-standard', 'fire'], reference: '화재·폭발·용접 작업 규정 조사. 허가서 보편 의무로 단정 금지.' },
  { id: 'REVIEW-034', title: '전기작업·누전·임시전원', category: 'inspection', industries: ['facility', 'construction', 'manufacturing', 'energy', 'personal'], work: ['electric'], focus: [], condition: '전압·충전 여부·작업자 자격·습윤 장소·이동형 설비 확인.', checks: ['충전부 접근·차단·검전·감전 방지 방법을 확인했는가?', '전선·접지·누전 보호·임시 배선 상태를 확인했는가?'], evidence: ['전기작업 확인표', '설비 검사·보수 기록'], sourceIds: ['osh-standard', 'electric'], reference: '전기작업 안전조치·설비 법령 구분 조사' },
  { id: 'REVIEW-035', title: '조리·튀김·절단·후드·세척', category: 'inspection', industries: ['food', 'hospitality', 'education', 'healthcare', 'retail'], work: ['fire', 'chemical'], focus: [], condition: '조리 작업·열원·칼/절단기·후드·세척제 사용 확인.', checks: ['화상·베임·미끄러짐·가스·후드 화재 위험을 확인했는가?', '세척제 혼합·환기·보호구와 조리 동선을 검토했는가?'], evidence: ['조리실 점검 기록', '세척·보수·개선 기록'], sourceIds: ['osh-standard', 'food'], reference: '현장 위험성평가용 자체 점검 질문. 개별 법정 기준 매핑 대기.' },
  { id: 'REVIEW-036', title: '진열·적재·상하차·냉장고', category: 'inspection', industries: ['retail', 'logistics', 'food', 'hospitality'], work: ['lifting', 'vehicle'], focus: [], condition: '적재 높이·선반·상하차·저온창고·작업자 이동 확인.', checks: ['낙하·붕괴·끼임·무리한 들기 위험을 확인했는가?', '냉장·냉동 공간 갇힘과 내부 연락 수단을 검토했는가?'], evidence: ['위치별 확인 사진', '적재·설비 개선 기록'], sourceIds: ['osh-standard'], reference: '작업장·적재·저온 작업 관련 규정 매핑 대기' },
  { id: 'REVIEW-037', title: '위험기계 안전인증·안전검사', category: 'inspection', industries: [], work: ['machine', 'vehicle'], focus: [], condition: '대상 기계 종류·규격·설치일·이전·변경·면제 조건 확인.', checks: ['인증·자율안전확인·안전검사의 대상을 구분했는가?', '검사 결과·사용중지·결함 개선과 다음 기준일을 확인했는가?'], evidence: ['기계대장·인증자료', '검사 결과·보수 기록'], sourceIds: ['osh', 'osh-decree', 'osh-rule'], reference: '안전인증·안전검사 조항·대상표 조사. 주기 미확정.' },
  { id: 'REVIEW-038', title: '폭염·한파·옥외작업', category: 'health', industries: ['construction', 'facility', 'logistics', 'agriculture', 'waste', 'energy', 'mining'], work: ['heat'], focus: [], condition: '작업 장소·열원·날씨·노출시간·취약 작업자 확인.', checks: ['휴식·물·냉난방·작업시간 조정과 건강 상태를 확인했는가?', '증상 발생 시 작업중지·연락·대응 절차가 있는가?'], evidence: ['현장 환경·조치 기록', '작업자 안내·확인 기록'], sourceIds: ['osh', 'osh-standard'], reference: '현행 폭염·한파 조항 조사. 온도·휴식시간 법정 수치 미확정.' },
  { id: 'REVIEW-039', title: 'MSDS·경고표지·보관·환기', category: 'health', industries: [], work: ['chemical'], focus: [], condition: '현장 물질·용기·노출 경로·보관 방식 확인.', checks: ['물질별 자료와 소분 용기의 표시를 확인했는가?', '혼합 금지·보관·환기·보호구를 위험에 맞게 검토했는가?'], evidence: ['물질·자료 목록', '보관·표지·환기 확인 기록'], sourceIds: ['osh', 'osh-standard'], reference: 'MSDS·표시·유해물질 관련 조문 대조 대기' },
  { id: 'REVIEW-040', title: '작업환경측정·노출 개선', category: 'health', industries: [], work: ['chemical', 'machine'], focus: [], condition: '대상 유해인자·공정·노출·측정 제외·변경 사항 확인.', checks: ['측정 대상과 대표 작업·대상자를 확인했는가?', '결과 알림·초과 조치·후속 측정을 검토했는가?'], evidence: ['공정·유해인자 목록', '측정·개선 자료'], sourceIds: ['osh', 'osh-rule'], reference: '법 제125조·대상 유해인자·주기 관련 별표 조사' },
  { id: 'REVIEW-041', title: '일반·특수·배치전 건강진단', category: 'health', industries: [], work: ['chemical', 'night', 'machine'], focus: [], condition: '사무/비사무·유해인자·야간작업·배치와 진단별 대상 확인.', checks: ['대상·시점·대체 인정 조건을 진단 종류별로 확인했는가?', '사후조치와 건강자료 열람권한을 분리했는가?'], evidence: ['최소정보 대상·수검 관리표', '권한을 제한한 사후조치 기록'], sourceIds: ['osh', 'osh-rule'], reference: '법 제129~132조·야간작업 등 대상·주기 조사. 민감 원문 공개 금지.' },
  { id: 'REVIEW-042', title: '근골격계부담·중량물·반복작업', category: 'health', industries: [], work: ['lifting'], focus: [], condition: '작업 자세·빈도·하중·지속시간과 고시상 부담작업 해당 여부 확인.', checks: ['현장 관찰과 작업자 의견으로 부담을 확인했는가?', '보조기구·작업방법·개선 효과를 확인했는가?'], evidence: ['유해요인 조사 자료', '개선·작업자 의견 기록'], sourceIds: ['osh-standard', 'risk'], reference: '근골격계부담작업·유해요인조사 관련 조항·고시 조사' },
  { id: 'REVIEW-043', title: '소음·분진·진동·보호구', category: 'health', industries: ['manufacturing', 'construction', 'mining', 'waste', 'agriculture', 'energy'], work: ['machine', 'chemical'], focus: [], condition: '발생원·노출·측정·보호구 적합성 확인.', checks: ['발생 억제·밀폐·환기·격리 방법을 검토했는가?', '보호구 선정·착용·교체·교육을 확인했는가?'], evidence: ['유해요인·설비 점검 기록', '보호구 지급·교육자료'], sourceIds: ['osh-standard'], reference: '소음·분진·진동 및 보호구 관련 조항 매핑 대기' },
  { id: 'REVIEW-044', title: '고객응대·폭언·폭력 보호', category: 'health', industries: ['retail', 'food', 'hospitality', 'office', 'healthcare', 'public', 'personal'], work: ['customer'], focus: [], condition: '대면·전화·온라인 고객응대와 피해 상황을 확인.', checks: ['안내·대응 절차·보호 조치를 작업자가 알고 있는가?', '피해 발생 시 업무중단·지원·불이익 방지 절차를 확인했는가?'], evidence: ['응대 절차·교육자료', '개인정보를 줄인 조치 기록'], sourceIds: ['osh'], reference: '법 제41조 및 관련 하위 규정 조사' },
  { id: 'REVIEW-045', title: '휴게시설·위생·휴식 접근', category: 'health', industries: [], work: ['night', 'heat', 'contractor'], focus: ['10-19', '20-49'], condition: '설치 의무와 설치·관리기준 준수 대상 구분. 직종·인원·수급인·공사 기준 확인.', checks: ['실제로 이용 가능한 위치·시설·관리 상태를 확인했는가?', '청소·경비·돌봄 등 직종과 다른 업체 인원을 구분했는가?'], evidence: ['시설 확인표·사진', '인원·직종·관리 기록'], sourceIds: ['rest', 'osh', 'osh-decree'], reference: '법 제128조의2·시행령 제96조의2·시행규칙 기준 조사' },
  { id: 'REVIEW-046', title: '감염 노출·찔림·돌봄 작업', category: 'health', industries: ['healthcare', 'education', 'waste', 'personal'], work: ['infection', 'lifting'], focus: [], condition: '환자·검체·폐기물·오염 세탁물과 이동보조 작업 확인.', checks: ['찔림·접촉·감염 경로와 예방·노출 후 절차를 확인했는가?', '이동보조·보호구·손위생·폐기 방법을 검토했는가?'], evidence: ['노출 예방·작업 절차', '교육·개선 기록'], sourceIds: ['osh-standard'], reference: '병원체 관련 보건조치 조사. 의료·감염·폐기물 법령은 추가 조사 필요.' },
  { id: 'REVIEW-047', title: '도급·수급·파견·관리주체 구분', category: 'contract', industries: [], work: ['contractor'], focus: ['zero', 'unknown'], condition: '계약 명칭과 실제 지휘·관리·장소 지배를 함께 확인.', checks: ['발주자·도급인·수급인·시설 관리주체의 책임을 구분했는가?', '관계업체 작업·인원·작업구역·연락망을 확인했는가?'], evidence: ['계약·역할 관계표', '업체·작업 범위 목록'], sourceIds: ['osh', 'serious'], reference: '도급 관련 정의·적용·책임 조항 조사' },
  { id: 'REVIEW-048', title: '혼재작업 협의·순회점검·합동점검', category: 'contract', industries: ['facility', 'construction', 'manufacturing', 'logistics', 'energy'], work: ['contractor'], focus: [], condition: '도급 관계·장소·작업 겹침과 적용 의무별 조건 확인.', checks: ['같은 장소의 동시 작업·일정·위험정보를 공유했는가?', '협의·점검·교육 지원·시정 조치의 실제 이력이 있는가?'], evidence: ['협의·점검 기록', '작업 조정·조치 자료'], sourceIds: ['osh', 'osh-rule'], reference: '법 제63~65조 등 의무별 대상·주기 조사' },
  { id: 'REVIEW-049', title: '안전보건총괄책임자·협의체', category: 'contract', industries: [], work: ['contractor'], focus: ['50-99', '100-299', '300-499', '500+'], condition: '관계수급인 합산 여부·업종·공사금액과 협의체 대체 요건 확인.', checks: ['총괄책임자 선임 대상과 기존 관리책임자를 구분했는가?', '협의체 구성·회의·업무 수행 증빙이 있는가?'], evidence: ['선임·구성 자료', '회의·업무 기록'], sourceIds: ['osh', 'osh-decree'], reference: '법 제62조·건설업 협의체 관련 조항 조사' },
  { id: 'REVIEW-050', title: '건설 안전관리계획·대장·유해위험방지계획', category: 'contract', industries: ['construction'], work: ['contractor', 'height'], focus: [], condition: '공사금액·공종·규모·시설·발주 역할별로 서로 다른 계획·대장 대상을 조사.', checks: ['법령별 문서의 작성 주체·제출·검토 대상을 구분했는가?', '설계·착공·공법 변경 시 재검토 조건을 확인했는가?'], evidence: ['공사 기본정보', '대상 검토표·제출/검토 기록'], sourceIds: ['osh', 'construction'], reference: '산안법과 건설기술진흥법의 계획·대장 별도 조사. 일반 계획 초안과 구분.' },
  { id: 'REVIEW-051', title: '굴착·흙막이·거푸집·해체', category: 'contract', industries: ['construction', 'facility'], work: ['height', 'machine'], focus: [], condition: '지반·구조·작업 순서·붕괴·매설물·해체 허가/신고 대상 확인.', checks: ['조사·구조·작업계획·출입 통제를 확인했는가?', '변경·이상징후·기상에 따른 중지와 보강 절차를 검토했는가?'], evidence: ['사전조사·작업계획', '점검·보강·중지 기록'], sourceIds: ['osh-standard', 'building'], reference: '굴착·해체 등 규정과 건축물관리법 절차 매핑 대기' },
  { id: 'REVIEW-052', title: '건설 안전보건관리비·기술지도', category: 'contract', industries: ['construction'], work: ['contractor'], focus: [], condition: '공사종류·금액·기간·도급구조·제외 조건별 조사.', checks: ['산안법 관리비와 다른 법령의 안전관리비를 구분했는가?', '계상·사용·기술지도 대상과 계약·이행자료를 확인했는가?'], evidence: ['공사·비용 산정자료', '사용 증빙·지도 기록'], sourceIds: ['osh', 'construction'], reference: '관련 조항·고시 조사 대기. 요율·금액 기준 미확정.' },
  { id: 'REVIEW-053', title: '소방안전관리자·소방계획', category: 'facility', industries: [], work: ['fire', 'publicFacility'], focus: [], condition: '소방대상물 용도·등급·규모·관계인·위탁·보조자 조건 확인.', checks: ['선임·자격·신고·업무대행 조건을 확인했는가?', '시설과 이용자에 맞는 계획·업무 수행 기록이 있는가?'], evidence: ['대상물·선임 자료', '소방계획·업무 기록'], sourceIds: ['fire'], reference: '선임·계획·업무 조항과 하위 규정 조사' },
  { id: 'REVIEW-054', title: '소방시설 자체점검·보수·보고', category: 'facility', industries: [], work: ['fire', 'publicFacility'], focus: [], condition: '설비 종류·대상물 규모·점검 종류·시점·자격 확인.', checks: ['작동·종합 등 대상 점검을 구분했는가?', '불량 조치·결과 보고·제출 증거를 연결했는가?'], evidence: ['설비·점검 결과', '보수·보고·접수 자료'], sourceIds: ['fire-equipment'], reference: '조사 대기. 점검 종류·주기·기한 미확정.' },
  { id: 'REVIEW-055', title: '전기안전관리자·검사·교육', category: 'facility', industries: [], work: ['electric'], focus: [], condition: '전기사업/자가용/일반용 설비·소유/점유·용량·휴지·위탁 여부 확인.', checks: ['선임·대행·교육 대상과 자격을 확인했는가?', '사용 전·정기 등 검사 종류와 결함 조치를 구분했는가?'], evidence: ['설비·선임·교육자료', '검사·보수 기록'], sourceIds: ['electric'], reference: '전기안전관리법 검사·선임 및 하위 규정 조사' },
  { id: 'REVIEW-056', title: '승강기 관리자·교육·자체점검·검사', category: 'facility', industries: [], work: ['publicFacility', 'machine'], focus: [], condition: '승강기 종류·관리주체·설치·변경·운행 상태 확인.', checks: ['관리자 선임·통보·교육·자체점검을 구분했는가?', '법정 검사·결함·운행중지·사고 대응을 확인했는가?'], evidence: ['승강기·선임·교육자료', '점검·검사·보수 기록'], sourceIds: ['elevator'], reference: '제29조·제31~32조 등 현행 대조 대기. 주기·기한 미확정.' },
  { id: 'REVIEW-057', title: '시설물·건축물 점검·진단·보수', category: 'facility', industries: ['facility', 'public', 'education', 'healthcare', 'culture', 'hospitality', 'logistics'], work: ['publicFacility'], focus: [], condition: '법정 시설 종류·지정 여부·규모·안전등급·관리주체 확인.', checks: ['시설물안전법·건축물관리법의 대상·중복·제외를 구분했는가?', '점검·진단·보수·보고 및 경과조치를 연결했는가?'], evidence: ['시설물 관리대장', '점검·진단·보수 자료'], sourceIds: ['structure', 'building'], reference: '시설별 대상·등급·주기·경과조치 조사' },
  { id: 'REVIEW-058', title: '기계설비 유지관리·성능점검', category: 'facility', industries: ['facility', 'hospitality', 'healthcare', 'education', 'public', 'manufacturing'], work: ['machine'], focus: [], condition: '건축물 용도·규모·기계설비·관리주체·적용 시점 확인.', checks: ['유지관리자·교육·점검 대상과 위탁 조건을 확인했는가?', '점검 결과·보수·관리대장에 근거가 있는가?'], evidence: ['건축물·설비 목록', '선임·교육·점검 기록'], sourceIds: ['mechanical'], reference: '조사 대기. 면적·세대·주기·등급 기준 미확정.' },
  { id: 'REVIEW-059', title: '가스·압력·보일러 안전관리', category: 'facility', industries: ['food', 'facility', 'manufacturing', 'hospitality', 'energy', 'personal'], work: ['fire'], focus: [], condition: '고압가스·LPG·도시가스·검사대상기기 등 해당 제도를 분리.', checks: ['가스 종류·압력·용량·공급/사용·소유관계를 확인했는가?', '선임·교육·검사·누출·차단·보수 기록을 검토했는가?'], evidence: ['설비·허가·신고 자료', '교육·검사·보수 기록'], sourceIds: ['gas'], reference: '조사 대기. 가스별 법령·에너지이용 합리화법 등 추가 연결 필요.' },
  { id: 'REVIEW-060', title: '위험물 시설·선임·예방규정', category: 'facility', industries: ['manufacturing', 'energy', 'logistics', 'retail', 'personal'], work: ['chemical', 'fire'], focus: [], condition: '위험물 종류·최대 수량·시설·취급 방식·지정수량 배수 확인.', checks: ['허가·저장·취급 기준과 관리자·교육 대상을 확인했는가?', '예방규정·점검·변경 신고의 적용 조건을 검토했는가?'], evidence: ['물질·수량·시설 자료', '허가·선임·교육·점검 기록'], sourceIds: ['dangerous'], reference: '조사 대기. 지정수량·배수·주기 미확정.' },
  { id: 'REVIEW-061', title: '유해화학물질 시설·관리자·교육', category: 'facility', industries: ['manufacturing', 'waste', 'energy', 'logistics', 'education', 'personal'], work: ['chemical'], focus: [], condition: '물질 분류·취급량·영업 구분·시설·개정 경과조치 확인.', checks: ['영업·시설검사·예방관리계획 대상을 각각 확인했는가?', '관리자·취급자 교육과 사고 대응 자료가 있는가?'], evidence: ['물질·취급·시설 목록', '허가·검사·교육·계획 자료'], sourceIds: ['chemical'], reference: '화학물질관리법과 하위 규정 조사. MSDS 교육과 별도.' },
  { id: 'REVIEW-062', title: '연구실 점검·진단·관리체계', category: 'facility', industries: ['education', 'manufacturing', 'office', 'healthcare'], work: ['chemical', 'infection'], focus: [], condition: '연구실안전법 적용 기관·연구실·활동·유해인자 확인.', checks: ['책임자·관리조직·점검·진단 대상과 제외를 확인했는가?', '실험 전 위험·장비·시약·폐기·사고 대비를 확인했는가?'], evidence: ['연구실·관리조직 자료', '점검·진단·개선 기록'], sourceIds: ['laboratory'], reference: '연구실안전법 적용·조직·점검 조항 매핑 대기' },
  { id: 'REVIEW-063', title: '영업시설 위생·피난·이용자 안전', category: 'facility', industries: ['food', 'retail', 'hospitality', 'personal', 'culture'], work: ['publicFacility'], focus: ['zero'], condition: '영업종류·신고/허가·면적·층·이용자·법정 시설 분류 확인.', checks: ['식품·공중위생·다중이용업소의 별도 관리 항목을 확인했는가?', '안전시설·보험·교육·검사와 종사자 안전을 구분했는가?'], evidence: ['영업·시설 정보', '시설·교육·보험 확인자료'], sourceIds: ['food', 'public-health', 'multiuse'], reference: '적용별 추가 세분화 대기. 법정 영업 체크리스트 확정본 아님.' },
  { id: 'REVIEW-064', title: '중대시민재해·공중이용시설 범위', category: 'facility', industries: [], work: ['publicFacility'], focus: ['zero', '1-4'], condition: '원료·제조물·공중이용시설·공중교통수단·소유/운영/관리 책임 확인.', checks: ['중대산업재해와 다른 대상 정의·예외를 확인했는가?', '시설·제품별 인력·점검·개선·대응 의무를 조사했는가?'], evidence: ['시설·제품·책임 관계표', '점검·안전관리 자료'], sourceIds: ['serious'], reference: '제3장 및 시행령 별도 조사 대기. 5명 미만 조건을 일괄 적용하지 않음.' },
  { id: 'REVIEW-065', title: '광산·선박 등 별도 안전체계', category: 'facility', industries: ['mining', 'agriculture', 'logistics', 'other'], work: [], focus: [], condition: '광산·선박·선원 등 특별한 적용관계와 주무 기관 확인.', checks: ['일반 산안법과 별도 법령의 적용관계를 확인했는가?', '직무·작업·검사·교육의 별도 조사 담당을 정했는가?'], evidence: ['시설·선박·업무 정보', '적용범위 검토 기록'], sourceIds: ['mining', 'seafarer', 'osh-decree'], reference: '범위 조사 대기. 업종별 의무 조사 미완료.' },
  { id: 'REVIEW-066', title: '공연·체육·복지·공공 현업 추가 범위', category: 'facility', industries: ['culture', 'healthcare', 'education', 'public', 'other'], work: ['publicFacility'], focus: [], condition: '시설 종류·인허가·이용자·현업 직종별 별도 법령 연결 필요.', checks: ['공연장·체육시설·사회복지시설·학교 등의 대상 법령을 특정했는가?', '근로자 안전과 관객·환자·학생 안전의 책임을 구분했는가?'], evidence: ['시설·인허가·직종 정보', '추가 조사 목록'], sourceIds: ['osh-decree', 'serious'], reference: '관련 개별 법령·공공 현업 고시 원문 조사 대기. 포괄 대응 아님.' },
  { id: 'REVIEW-067', title: '사고 초기대응·작업중지·대피', category: 'incident', industries: [], work: [], focus: [], condition: '급박한 위험·현장 위치·구조 접근·2차 피해를 확인.', checks: ['즉시 연락·대피·작업중지와 현장 지휘 절차가 있는가?', '사고별 세부 대응은 검토된 매뉴얼과 교육에 연결되는가?'], evidence: ['비상 연락·대피 계획', '훈련·대응 기록'], sourceIds: ['osh', 'serious'], reference: '작업중지·중대재해 조치 조항 조사. 공개 긴급 연락은 별도 상시 제공.' },
  { id: 'REVIEW-068', title: '산업재해 보고·조사·재발방지', category: 'incident', industries: [], work: [], focus: [], condition: '발생·인지 시각·피해·고용관계·실제 장소·법령별 보고 요건 확인.', checks: ['산안법 보고·중대재해 보고와 다른 기관 절차를 구분했는가?', '제출본·접수증·조사·재발방지 이력을 별도로 남겼는가?'], evidence: ['확인된 사고 사실 기록', '법령별 제출·접수·개선 자료'], sourceIds: ['osh', 'osh-rule', 'serious'], reference: '법 제54조·제57조 및 시행규칙 조사. 보고 기한·서식 미확정.' },
  { id: 'REVIEW-069', title: '선임·교육·점검 증빙과 보존', category: 'incident', industries: [], work: [], focus: [], condition: '문서 종류·법적 근거·기산점·개인정보·분쟁 보존을 구분.', checks: ['원본·정정·새 버전과 실제 수행자를 확인할 수 있는가?', '초안·수행·검토·승인·제출·기관 접수가 분리되어 있는가?'], evidence: ['문서·버전·행위 이력', '자료별 보존 근거표'], sourceIds: ['osh', 'osh-rule'], reference: '자료 종류별 보존 조항 조사 대기. 일괄 보존연수 없음.' },
  { id: 'REVIEW-070', title: '반복 점검·교육과 미완료 후속조치', category: 'incident', industries: [], work: [], focus: [], condition: '법정 주기·계약 검토 주기·자체 관리 주기를 구분.', checks: ['다음 회차를 새 업무로 만들고 지난 실적을 자동 승계하지 않는가?', '미확인·미조치·검토대기 항목의 담당과 다음 행동이 있는가?'], evidence: ['일정·회차별 수행 기록', '보완·재검토 이력'], sourceIds: ['osh-rule', 'risk'], reference: '주기별 원문 검토 대기. 자체 관리 절차 제안.' },
  { id: 'REVIEW-071', title: '공정안전보고서·변경·자체감사', category: 'management', industries: ['manufacturing', 'energy', 'waste'], work: ['chemical', 'fire'], focus: [], condition: '업종·유해위험물질 종류·규정량·설비·적용 예외를 확인.', checks: ['대상 공정·제출·심사·확인 조건을 검토했는가?', '변경관리·교육·자체감사·비상조치의 실제 이력이 있는가?'], evidence: ['물질·수량·공정 자료', '보고서·심사·이행 기록'], sourceIds: ['osh', 'osh-decree'], reference: '공정안전보고서 관련 조문·하위 규정 조사 대기. 규정량 미확정.' },
  { id: 'REVIEW-072', title: '석면조사·해체·제거', category: 'inspection', industries: ['construction', 'facility', 'manufacturing', 'public', 'education'], work: ['chemical'], focus: [], condition: '철거·해체·보수 대상의 건축물·설비·자재·규모 확인.', checks: ['사전 조사와 기관 조사·해체제거 업체 대상 여부를 구분했는가?', '노출 방지·작업자 교육·신고·측정·처리 절차를 검토했는가?'], evidence: ['조사 결과·작업계획', '작업·신고·측정 자료'], sourceIds: ['osh', 'osh-standard'], reference: '석면 관련 조항 및 석면안전관리법·폐기물 관련 법령 추가 조사 대기' },
  { id: 'REVIEW-073', title: '유해·위험작업 자격·취업 제한', category: 'training', industries: [], work: ['machine', 'vehicle', 'electric', 'height'], focus: [], condition: '작업 종류·장비 규격·자격·경험·기능습득 과정 등의 조건 확인.', checks: ['교육 이수와 해당 작업의 자격·면허 요건을 구분했는가?', '작업자별 허용 업무·유효기간·증빙을 확인했는가?'], evidence: ['작업·자격 대조표', '면허·교육·배치 자료'], sourceIds: ['osh', 'osh-decree'], reference: '유해·위험작업의 취업 제한에 관한 규칙 및 개별 장비법 조사 대기' },
  { id: 'REVIEW-074', title: '특수형태근로종사자·배달 등 안전교육', category: 'training', industries: ['logistics', 'construction', 'office', 'retail', 'food'], work: ['vehicle', 'contractor'], focus: ['zero'], condition: '직종·노무제공 관계·산안법상 대상 정의·별도 안전교육 범위 확인.', checks: ['근로자 교육과 별도 보호·교육 대상을 구분했는가?', '노무를 제공받는 자의 역할과 작업 위험 안내를 확인했는가?'], evidence: ['계약·직종·역할 자료', '교육·안전조치 기록'], sourceIds: ['osh', 'osh-decree', 'osh-rule'], reference: '법 제77~78조 및 하위 규정의 직종·교육 범위 조사' },
  { id: 'REVIEW-075', title: '직장 내 성희롱 예방교육', category: 'training', industries: [], work: [], focus: ['1-4', '5-9'], condition: '안전보건교육 외 연관 교육. 사업장 규모·구성·교육 방법 특례 확인.', checks: ['사업주·근로자 대상과 교육내용·방법을 확인했는가?', '실제 교육·자료 열람·신고 및 보호 절차를 확인했는가?'], evidence: ['교육 내용·실시 자료', '게시·신고 절차'], sourceIds: ['equality'], reference: '제13조 및 시행령 조사. 소규모 교육방법 특례를 의무 면제로 처리하지 않음.' },
  { id: 'REVIEW-076', title: '직장 내 장애인 인식개선 교육', category: 'training', industries: [], work: [], focus: ['1-4', '5-9', '20-49', '50-99'], condition: '안전보건교육 외 연관 교육. 대상·규모별 방법·강사 요건을 확인.', checks: ['근로자 수·사업 특성에 따른 교육 방법을 대조했는가?', '다른 법령의 장애 인식개선교육과 대상·인정 범위를 구분했는가?'], evidence: ['교육 대상·자료', '실시·참석 근거'], sourceIds: ['disability'], reference: '제5조의2 및 하위 규정 조사. 교육시간·방법 확정 전.' },
  { id: 'REVIEW-077', title: '퇴직연금 가입자 교육', category: 'training', industries: [], work: [], focus: [], condition: '안전보건교육 외 연관 교육. 퇴직연금 도입 여부·제도 유형·가입자를 확인.', checks: ['퇴직금만 운영하는 경우와 퇴직연금 가입자를 구분했는가?', '가입자 교육 내용·방법·위탁 실시 근거를 확인했는가?'], evidence: ['제도·가입 대상 정보', '교육·위탁 실시 자료'], sourceIds: ['pension'], reference: '법 제32조 및 시행령 교육 관련 규정의 현행본 대조 대기' },
  { id: 'REVIEW-078', title: '개인정보취급자 보호 교육', category: 'training', industries: [], work: [], focus: [], condition: '안전보건교육 외 연관 교육. 실제 개인정보취급자·취급 업무·권한을 확인.', checks: ['취급자·관리책임·자료별 접근권한을 확인했는가?', '유출 예방·권한 회수·민감자료 처리 교육을 확인했는가?'], evidence: ['취급 업무·권한 목록', '교육·점검 기록'], sourceIds: ['privacy'], reference: '제28조 및 안전성 확보조치 관련 규정 조사. 전 직원 일률 시간으로 단정하지 않음.' },
];

export function headcountBandFor(value: number | null): HeadcountBand {
  if (value === null || !Number.isSafeInteger(value) || value < 0) return 'unknown';
  if (value === 0) return 'zero';
  if (value < 5) return '1-4';
  if (value < 10) return '5-9';
  if (value < 20) return '10-19';
  if (value < 50) return '20-49';
  if (value < 100) return '50-99';
  if (value < 300) return '100-299';
  if (value < 500) return '300-499';
  return '500+';
}

export interface CatalogFilter {
  industry: IndustryId | 'all';
  category: CategoryId | 'all';
  headcount: HeadcountBand;
  work: WorkId[];
  query: string;
}
export function filterCandidates(filter: CatalogFilter): ReviewCandidate[] {
  const query = filter.query.trim().toLocaleLowerCase('ko-KR');
  return reviewCandidates.filter(item => {
    const related = filter.industry === 'all' || filter.industry === 'other' || item.industries.length === 0 || item.industries.includes(filter.industry) || item.work.some(work => filter.work.includes(work));
    const matchesCategory = filter.category === 'all' || item.category === filter.category;
    const searchable = [item.id, item.title, item.condition, ...item.checks, ...item.evidence, item.reference].join(' ').toLocaleLowerCase('ko-KR');
    return related && matchesCategory && (!query || searchable.includes(query));
  }).sort((a, b) => Number(b.focus.includes(filter.headcount)) - Number(a.focus.includes(filter.headcount)) || a.id.localeCompare(b.id));
}

export function catalogCsv(items: ReviewCandidate[], filter?: CatalogFilter): string {
  const industryLabel = (id: string) => industries.find(item => item.id === id)?.label ?? '전체 업종';
  const rows = [
    ['목록 버전', '목록 성격', '탐색 조건', 'ID', '분류', '검토 항목', '관련 업종 예시', '작업 조건', '인원별 우선 검토 구간', '적용 확인 조건', '확인 질문', '증빙 예시', '조사 위치', '공식 원문', '확인한 출처 경로', '출처 확인 범위', '출처 확인일', '검토 상태', '검토자', '검토일', '검토 의견'],
    ...items.map(item => {
      const sources = item.sourceIds.map(id => catalogSources.find(source => source.id === id)!);
      const selection = filter ? `${industryLabel(filter.industry)} / ${headcountBands.find(band => band.id === filter.headcount)?.label} / ${categories.find(category => category.id === filter.category)?.label ?? '전체 분류'} / 작업: ${filter.work.map(id => workConditions.find(work => work.id === id)?.label).join('·') || '추가 선택 없음'} / 검색: ${filter.query}` : '전체 목록';
      return [catalogVersion, catalogNotice, selection, item.id, categories.find(category => category.id === item.category)!.label, item.title,
        item.industries.map(industryLabel).join(' · ') || '전 업종 공통 검토 후보', item.work.map(id => workConditions.find(work => work.id === id)!.label).join(' · '),
        item.focus.map(id => headcountBands.find(band => band.id === id)!.label).join(' · ') || '인원만으로 제외하지 않음', item.condition,
        item.checks.join('\n'), item.evidence.join('\n'), item.reference, sources.map(source => source.url).join('\n'),
        sources.map(source => source.inspectedUrl || '미확인').join('\n'), sources.map(source => `${source.title}: ${source.level} · ${source.scope}`).join('\n'),
        sources.map(source => `${source.title}: ${source.checkedOn ?? '미확인'}`).join('\n'), catalogStatus, '', '', ''];
    }),
  ];
  // Quote every cell and neutralize spreadsheet formula prefixes, including search text.
  const cell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
