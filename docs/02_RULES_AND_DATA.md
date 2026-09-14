# 02. 사업장 분류·법령 규칙·데이터 명세

작성일: 2026-09-14. 아래는 구현 구조다. 검증된 전 법령 규칙이나 법정 기준값 목록이 아니다. 법령 원문 확인과 분야별 검토를 거쳐 규칙을 채운다.

## 1. 사업장 분류 원칙

고객 계정 단위인 `tenant`와 법적 의무의 판단 단위를 구분한다. 하나의 고객 조직에 여러 법인·사업주·사업장·공사가 있을 수 있다. 같은 장소에서 여러 사업주가 일할 수도 있다. 다른 고객 계정 사이의 공유는 명시적 공유 기능과 권한을 구현하기 전까지 금지한다.

| 분류 축 | 저장 사실 | 주의할 점 |
|---|---|---|
| 사업주·조직 | 법인/개인/기관 등 형태, 사업주 주체, 등록정보 | 고객 계정과 법적 책임 주체를 동일시하지 않음 |
| 등록 업종 | 업태·종목 원문 전체, 복수 업종 | OCR 첫 줄을 자동 주업종으로 확정하지 않음 |
| 실제 활동 | 조리·판매·생산·운반·청소·정비·건설 등 | 국세청 코드·표준산업분류·법령 분류의 체계와 버전 분리 |
| 인원 | 직접고용·기간제·단시간·일용·파견·수급인 등 관계별 사실, 기준일·기간 | 임의 합산 금지, 법령별 산정 정의로 계산 |
| 사업장 | 실제 주소·행정구역 코드, 본점/지점, 이동 작업 | 등록 주소·실제 작업 장소·사고 장소 분리 |
| 계약과 역할 | 사업주·도급인·수급인·발주자, 소유·관리·사용 관계 | 계약·실질 역할을 확인, 단일 체크로 모든 도급 의무 확정 금지 |
| 작업·공정 | 작업 종류, 빈도, 작업자, 위험요인 | 선택한 작업에 관련된 추가 질문만 노출 |
| 설비 | 종류·형식·규격·용량·설치/검사 이력 | 사진에서 안 보이는 규격은 확인 필요 |
| 물질 | 명칭·식별정보·사용량·공정·MSDS 문서 | 물질명 문자열 하나로 모든 규제 확정 금지 |
| 건물·시설 | 용도·면적·층·수용 규모·소방/전기/가스 설비·관리 주체 | 임차인과 소유자 의무 구분 |
| 공사 | 종류·금액·기간·참여 사업주·역할 | 원 단위 정수 금액, 공사별 적용 단위와 합산 규칙 확인 |
| 변화 | 채용·인원·작업·설비·계약·주소·사고 발생일 | 당시 사실을 보존하고 영향 의무 재평가 |

입력값은 `value`, `unit`, `source`, `valid_from/to`, `recorded_at`, `confirmed_by/at`, `unknown_reason`을 가진다. 현재 인원 숫자만으로 과거 특정 기간의 상시근로자 수를 추정하지 않는다. `0`과 미응답 `null`을 구분한다. 500명 이상도 실제 숫자를 저장한다.

화면 구간은 탐색용으로 자유롭게 둘 수 있지만 계산은 실제 수치와 정의를 쓴다. 규칙의 경계값과 `미만/이하/초과/이상` 연산자를 데이터로 보존한다. 직원이 없는 점포도 사업장 정보를 등록할 수 있게 하고, 모든 안전 관련 의무가 없다고 일괄 제외하지 않는다.

## 2. 법령 조사 원장과 의무 원장

법률·시행령·시행규칙·별표·별지·위임 고시·부칙·경과조치를 연결한다. 지침·해설·권고는 법적 효력이 있는 의무와 구분한다. 관계 법령·조례·개별 명령 등이 발견되면 조사 범위에 추가하고 누락을 추적한다.

조문마다 `obligation_extracted / supporting_definition / exclusion_or_exception / out_of_scope_with_reason / review_pending` 중 하나와 검토 근거를 기록한다. 문서 목록만으로 조사 완료라고 하지 않는다.

| 규칙 필드 | 요구사항 |
|---|---|
| `rule_id`, `version`, `kind` | 불변 버전. 법정 의무·판단 보조·권고·데모 구분 |
| `source_refs` | 법령명·식별자·조항·별표/서식·공식 URL·원문 버전·확인 범위 |
| `effective_from/to`, `transitional_rule` | 적용 시점과 경과조치. 공포일과 시행일 분리 |
| `subject_role`, `scope_type`, `scope_resolver` | 책임 주체, 사업/사업장/공사/설비/작업/종사자별 판단 단위 |
| `required_facts`, `counting_method` | 필요한 사실과 인원·금액 등의 산정 정의 |
| `condition_ast`, `exceptions` | 허용된 비교·논리 연산자로 조건 표현. 임의 코드 실행 금지 |
| `action_requirements` | 실제 해야 할 일·대상·자격·필수 내용 |
| `schedule_rule` | 기산 사건·기한·반복·기간 계산·예외 |
| `evidence_requirements` | 문서·활동·참여·선임·접수 등 확인할 요소 |
| `submission_requirements` | 제출 여부의 조건, 기관·방법·공식 서식 버전 |
| `retention_requirements` | 법정/운영상 보존 근거, 기간·기산점·보류 조건 |
| `relationships` | 대체 인정·면제·중복 증빙·선행 의무 |
| `review_status`, `reviewer`, `reviewed_at` | 누가 어떤 범위를 확인했는지. 코드 테스트와 구분 |
| `test_cases`, `release_id` | 승인된 기대 결과와 배포 묶음 |

단계: `draft → review_pending → approved → published → superseded/withdrawn`. 사람 검토 결과·시험 근거가 없는 규칙을 코딩 에이전트가 스스로 approved로 만들지 않는다. 1인 운영에서도 작성·검토·배포 행위와 역량 범위를 기록하며, 독립 검토를 받지 않은 상태를 독립 검증 완료로 표시하지 않는다.

배포 버전은 직접 수정하지 않고 새 버전을 만든다. 법령 수집으로 변경 후보를 만들 수 있지만 자동 운영 배포는 금지한다. 오류 규칙은 배포 중지·영향 고객 확인·정정·재평가·고객 안내 대상으로 연결한다.

## 3. 적용 엔진 계약

입력: 판정 기준시점, 사실 스냅샷, 승인된 규칙 배포본, 해당 범위의 조사 상태.

출력 예시의 구조:

```ts
type Applicability = 'applicable' | 'not_applicable' | 'needs_review';
type ReviewReason =
  | 'missing_fact' | 'unconfirmed_fact' | 'rule_unverified'
  | 'source_unavailable' | 'interpretation_required' | 'scope_unresolved';

interface EvaluationResult {
  ruleId: string;
  ruleVersion: string;
  releaseId: string;
  factSnapshotId: string;
  asOf: string;
  applicability: Applicability;
  reasons: string[];
  reviewReasons: ReviewReason[];
  sourceRefs: string[];
  missingFactKeys: string[];
  evaluatedBranches: unknown[];
  evaluatedAt: string;
}
```

엔진은 같은 입력·버전으로 같은 결론과 근거를 재현해야 한다. 조건식은 제한된 AST로 구현하고 `eval`, 동적 SQL, LLM 생성 코드로 실행하지 않는다.

### 미확인 값을 처리하는 방법

논리값은 true/false/unknown이다. AND는 확정 false가 있으면 false, 모두 true이면 true, 나머지는 unknown이다. OR는 확정 true가 있으면 true, 모두 false이면 false, 나머지는 unknown이다. NOT unknown은 unknown이다. 조건·예외·역할 해석에 따라 최종 결과를 계산하되, 규칙 자체의 미검증 상태는 사실 조건과 별도로 확인한다.

운영 규칙이 승인되지 않았거나 조사 범위에 공백이 있으면 이를 화면에 남긴다. 규칙이 없는 항목은 실행할 규칙이 없다는 뜻이지 의무가 없다는 뜻이 아니다. unknown을 false로 강제 변환하는 언어 동작을 막는다.

### 시험용 규칙 예시

```json
{
  "rule_id": "DEMO_CHECKLIST_001",
  "version": "1",
  "kind": "demo",
  "title": "사진 점검 기록 체험",
  "review_status": "draft",
  "source_refs": [],
  "production_eligible": false,
  "condition_ast": {"op": "eq", "fact": "demo_requires_checklist", "value": true},
  "ui_notice": "데모 — 실제 법적 판단에 사용 불가"
}
```

법적 기준처럼 보이는 가짜 숫자나 조문으로 데모를 만들지 않는다. 엔진의 숫자 경계 시험은 테스트 내부의 합성 규칙으로 분리한다. 운영 배포는 `production_eligible`, 규칙 승인·출처·시행일·시험 결과를 서버에서 검증하며 클라이언트 값으로 우회할 수 없어야 한다.

## 4. 기한과 변화

- 기본 업무 시간대는 `Asia/Seoul`. 발생 시각은 UTC와 당시 현장 시간대, 법적 날짜는 별도로 저장한다.
- 일수·달력 월·분기·반기·사건 직후 등 기간 종류를 구별한다. ‘1개월’을 고정 30일로, ‘지체 없이’를 임의의 시간 제한으로 바꾸지 않는다.
- 기산일·초일 산입·말일·휴일·예외는 해당 근거를 확인한 계산 규칙으로 구성한다. 기준이 불명확하면 임의로 늦춘 기한을 확정하지 않는다.
- 인원 변경·계약 변경·법령 개정 후 영향 규칙만 재평가하되 영향 범위 산정에 실패하면 전체 재평가 작업으로 안전하게 전환한다.
- 반복 의무는 각 회차를 별도 `obligation_instance`로 생성한다. 이전 회차 완료로 다음 회차를 완료 처리하지 않는다.
- 업무 생성과 알림에 멱등 키를 사용해 재시도 때 중복 업무·발송이 생기지 않게 한다.

## 5. 상태 모델

| 대상 | 기본 상태 | 허용되지 않는 자동 전환 |
|---|---|---|
| 적용 판정 | applicable / not_applicable / needs_review | 입력 누락 → not_applicable |
| 문서 | draft / user_confirmed / approved / superseded | AI 생성 → approved |
| 실제 활동 | not_started / in_progress / reported_done / verified_under_scope / reopened | 사진 업로드 → verified_under_scope |
| 자료 검토 | not_requested / queued / in_review / changes_requested / reviewed / reopened | reviewed → 모든 법적 의무 완료 |
| 외부 제출 | not_required / required / draft_ready / user_reported_sent / receipt_evidence_attached / agency_receipt_confirmed | 전화 클릭·파일 출력 → agency_receipt_confirmed |
| OCR | queued / processing / extracted / awaiting_confirmation / confirmed / failed | OCR 신뢰도 높음 → confirmed |
| 보완 과제 | open / working / resubmitted / resolved / reopened | 새 파일 도착 → resolved |

`not_required`도 근거 있는 제출요건 판정이 필요하다. 기관 접수 확인은 확인자·방법·시각·근거를 기록한다. API 연계가 없으면 고객 제출 기록과 접수증 등록 상태를 정확하게 보여준다.

완료 기준은 의무별 필수 항목과 실제 수행·승인·접수 조건으로 계산한다. UI에는 ‘등록된 의무 N건 중 자료 검토 M건’처럼 분모를 설명한다. ‘법적 준수율 100%’나 ‘사업장 안전 점수’로 바꾸지 않는다. 등록 의무가 0건이면 ‘아직 판정된 의무 없음’을 표시한다.

## 6. 데이터 구조

아래 이름은 권장 논리 모델이다. 물리 테이블을 처음부터 모두 만들 필요는 없지만 서로 다른 상태·권한·버전은 하나의 불투명 메모로 합치지 않는다. JSON 필드는 타입·스키마·버전 검증을 적용한다.

| 묶음 | 주요 엔터티 | 단계 |
|---|---|---|
| 고객·권한 | tenants, memberships, legal_entities, workplaces, workplace_memberships | P2 |
| 운영자 배정 | provider_assignments, access_grants | P2 |
| 사실 | fact_snapshots, fact_values, headcount_snapshots, work_activities | P2~P3 |
| 설비·계약·물질 | assets, substances, contracts, legal_role_assignments | P3 필요한 분야부터 |
| 원본·출력 | documents, document_versions, evidence_links | P2 |
| 업무·수행 | obligation_instances, action_records, corrective_actions | P2~P3 |
| 검토·소통 | review_cases, review_comments, review_events | P2 |
| 법령 | legal_sources, source_versions, provision_reviews, obligation_definitions | P3 |
| 적용 | rule_versions, rule_releases, evaluations, evaluation_traces | P3 |
| 서식 | template_versions, template_field_mappings | P3~P4 |
| 교육·선임 | training_sessions, participation_records, appointment_records | P3 |
| 사고·기관 | incidents, report_obligations, report_events, authorities, jurisdiction_rules | P3 |
| AI·OCR | processing_jobs, extraction_fields, ai_findings, confirmation_events | P4 |
| 감사·보존 | audit_events, retention_policies, legal_holds, deletion_requests | P2부터 단계 확장 |
| 운영·상품 | entitlements, usage_ledger, support_policies, periodic_reviews | P5 |

고객 데이터에는 tenant_id를 명시하고 현장 범위가 있으면 workplace_id도 연결한다. 종속 데이터의 복합 외래키·서버 검증으로 다른 고객의 document_id나 workplace_id를 조합할 수 없게 한다. 고객 내 법인·사업주도 같은 고객 범위인지 확인한다. 공개 법령 원장은 고객 데이터와 권한 체계를 분리한다.

원본 해시·문서 버전·추출 버전·판정 버전·검토 대상 버전을 연결한다. 검토 후 원본이 교체되면 기존 검토를 새 파일에 그대로 승계하지 않고 재검토 필요를 기록한다. 해시나 EXIF가 실제 촬영 시점·현장 상황의 진실성을 보증한다고 설명하지 않는다.

## 7. 교육·선임·관련 법령의 확장

교육은 종류·대상·발생 계기·시간·내용·방법·강사/기관 요건·면제/대체·증빙을 분리한다. 교육일지 생성과 실제 참여·이수를 구분한다. 선임은 직무·대상 기준·자격·실제 선임일·증빙·보고 여부·변경/해임을 관리한다.

산업안전보건법과 중대재해처벌법을 중심으로 건설·시설물·소방·전기·가스·화학·위험물·식품 및 공중 이용시설 관련 안전 의무를 조사한다. 중대산업재해와 중대시민재해의 정의·대상·책임을 구분한다. 모든 업종의 모든 세무·노무·영업 규제가 자동으로 서비스 범위에 포함된다고 표시하지 않는다. 안전관리와 연결되는 범위 및 미검토 법령을 조사 원장에 명시한다.
