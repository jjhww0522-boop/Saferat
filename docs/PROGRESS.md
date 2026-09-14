# 개발 진행 기록

업데이트: 2026-09-14
현재 단계: P0 기반·P1 핵심 데모 구현 및 기술 검증 완료, 사용자 검증 대기

## 확인한 환경
- Markdown 10개, 기존 코드·Git 없음. 기존 문서를 보존하여 Git main 초기화.
- Node 24.13.0, npm 11.6.2. npm.cmd 실행 가능.
- npm 네트워크 조회는 샌드박스 EACCES 후 승인된 외부 실행으로 확인.
- Orca 설치 CLI를 발견했으나 PATH/Path 중복 오류로 시작 실패. 중복 환경 키를 정리한 실행도 20초 시간 초과. 실제 task/dispatch 생성 없이 단일 에이전트로 구현했다.

## 구현한 사용자 흐름
- 가상 사업장 시작 → 3단계 정보 입력 → OCR 샘플 후보 확인·수정 → 임시 저장·사용자 확인. 0명과 미응답, 개업일과 발급일을 구분한다.
- 회원 홈 → 준비할 업무 → 가상 사진 첨부/자체 서식 초안 → 내용 확인 → 검토 요청.
- 배정 검토자의 자료 확인 → 위치가 명시된 보완 의견 → 회원의 새 버전 작성·재제출 → 자료 검토 완료. 원래 버전·의견·수행 기록의 정정 이력을 보존한다.
- 문서 작성·수행 기록·사람 검토·외부 접수 상태를 분리한다. 검토 완료가 법적 이행이나 기관 접수로 바뀌지 않는다.
- 다른 고객·미배정 검토자의 자원 조회·변경을 서버 데모 범위에서 차단한다. 회원 응답에 운영자 내부 메모를 포함하지 않는다.
- 전송 실패 시 작성 내용을 유지하고 재시도한다. 공개 `/emergency`는 로그인·체험 세션·AI 없이 접근한다.

## 변경 파일
| 범위 | 파일 및 역할 |
|---|---|
| 실행 기반 | package.json, package-lock.json, tsconfig.json, next-env.d.ts, next.config.ts, postcss.config.mjs, eslint.config.mjs, .gitignore, .env.example |
| 도메인·데모 | src/domain/{types,rules,workflow,config}.ts, src/demo/seed.ts: 사실 스냅샷·3값 논리·버전별 검토·충돌 방지·가상 사업장 |
| 서버·연결부 | src/server/{store,actions}.ts, src/adapters/registration.ts: 세션별 메모리 상태·서버 검증·OCR 후보 인터페이스 |
| UI | src/app/**, src/components/**: 회원·운영자·정보 입력·문서 버전·긴급 화면, 크림/파랑 반응형 디자인 |
| 검증 | vitest.config.ts, playwright.config.ts, tests/unit/{rules,workflow,adapters}.test.ts, tests/e2e/demo.spec.ts |
| 기록 | README.md, docs/{DECISIONS,DESIGN,LEGAL_PREPARATION,ORCHESTRATION,PROGRESS}.md |

기존 기획 Markdown은 보존했다. README에는 실행 안내를 추가하고 원본 내용을 유지했다.

## 실제 실행 및 결과
| 명령/검증 | 결과 |
|---|---|
| npm.cmd install | 잠금 파일 생성·버전 고정. 최종 설치 출력: 231개 패키지 감사, 취약점 0개 보고. 전체 보안 감사의 의미는 아님 |
| npm.cmd run typecheck | 통과. 초기 메모리 Map 타입 추론 오류 수정 후 확인 |
| npm.cmd run lint | 최종 ESLint 10·TypeScript·Hooks·Next 플러그인 구성에서 통과 |
| npm.cmd test | 3개 파일, 30개 테스트 통과: 미확인/0 구분, 합성 경계, 판정 재현, demo/live 차단, 버전·검토·권한·동시 수정, OCR 후보, 수행 이력 |
| npm.cmd run build | Next.js 프로덕션 빌드 통과. 공개 긴급 화면 및 동적 체험·회원·운영자 경로 생성 |
| npm.cmd run test:e2e | Microsoft Edge, 4개 시나리오 모두 통과 (50.4초). 이전 화면 이동 대기 오류를 고친 뒤 전체 재실행 |
| 접근성·화면 | 홈 360px에서 axe WCAG 2 A/AA·2.1 AA·2.2 AA 선택 규칙 위반 0건. 320/360px·720 CSS px 확대 상당 환경에서 가로 넘침 없음. 공개 긴급 경로의 키보드 119 접근 확인 |
| 화면 육안 확인 | 데스크톱·모바일 캡처 확인. 전체 페이지 캡처의 스크롤 위치 영향을 별도 Edge 뷰포트로 확인: 본문 건너뛰기 링크는 평상시 화면 밖, 사이드바 시작 위치 정상 |
| npm.cmd ls --depth=0 | 필수 패키지 버전 확인. 로컬에 sharp의 선택적 wasm 패키지 1개가 extraneous로 표시됨; node_modules는 커밋 대상에서 제외 |
| git diff --check | 공백 오류 없음. Windows 줄바꿈 변환 안내만 출력 |
| 비밀 설정 제외 | git check-ignore로 .env.local/.env.production, node_modules, .next, test-results, playwright-report 제외 확인 |

E2E 세부: ① 제출→보완→새 버전 재제출→검토, 내부 메모·다른 고객·미배정 접근 차단 ② 입력·임시 저장·확인·미응답 ③ 모바일·접근성·공개 긴급 경로 ④ 전송 실패·입력 보존·재시도.

초기 axe 검사에서 장식 숫자 대비 부족을 발견해 수정했다. 테스트가 검토 상세 이동 전에 이전 URL을 저장하던 문제는 상세 URL 도착을 기다리도록 수정했다. Orca agent-browser는 연결 시간 초과로 사용하지 못해 Playwright에서 설치된 Edge를 직접 실행했다. 실패를 성공으로 집계하지 않았다.

화면/테스트 산출물은 로컬 test-results/ 및 playwright-report/에 있으며 Git에서는 제외한다. 200% 상당 레이아웃 검증은 실제 브라우저 확대 조작 시험과 구분한다.

## 실행 방법
1. Node 24·npm 11 환경에서 `npm.cmd ci`, `npm.cmd run dev`.
2. http://127.0.0.1:3000 → 가상 사업장으로 체험하기.
3. 역할 메뉴에서 A 고객 → JH 배정 검토자 → A 고객으로 전환하여 보완 흐름 확인.
4. 브라우저 자동 검증은 다른 3000번 포트 서버를 종료하고 `npm.cmd run build`, `npm.cmd run test:e2e` 순서로 실행.

키 없이 실행한다. 메모리 상태는 같은 체험의 새로고침에는 유지되고 서버 재시작·초기화·세션 만료 시 사라진다. 실제 자료는 입력하지 않는다.

## 데모·미연동·미검증 범위
- P2 실제 인증·조직 소속 확인·DB/RLS·파일 저장·백업·복구·삭제 정책 미구현. 역할 전환은 가상 권한 체험이며 운영 인증이 아니다.
- 승인된 실제 법령 규칙은 0개. P3 법령 원문 조사·전문 검토·규칙 승인/배포·개정 영향 분석 미완료. DEMO_ 규칙은 실제 적용 의무가 아니다.
- P4 실제 OCR/AI·고객 파일·PDF 내보내기·전자서명·발송·기관 제출/접수 미연동. OCR는 제공된 샘플 후보만 반환한다. APP_MODE=live 및 AI/OCR live는 명시적으로 거부한다.
- 시설관리 담당자 참여 사용성 검증, 실제 iOS/Android·보조기기·브라우저 확대 조작 검증 미실행. axe 홈 검사를 전체 서비스 접근성 인증으로 해석하지 않는다.
- Orca 런타임 연결 및 에이전트별 독립 교차 검토 미완료. 후속 구성은 총괄 1명 + 작업자 최대 3명이며 docs/ORCHESTRATION.md에 배정/통합 기준을 기록했다.
- 공개 배포·외부 발송·유료 자원 구매 없음.

## 남은 차단 요인과 다음 작업
1. 시설관리 담당자에게 정보 확인·자료 준비·보완 재제출을 수행하게 하여 다음 행동과 상태 의미를 이해하는지 확인한다.
2. P2 실제 인증·영속 저장·조직/현장 권한을 연결하고 고객 간 격리·서버 재시작 복구를 검증한다. 관련 외부 계정/프로젝트 설정 필요.
3. P3 시설관리·유지보수 범위의 법령 원문과 적용 사실을 조사하고 사용자 1차 검토·외부 전문 검토를 거쳐 규칙을 승인한다.
4. Orca 연결 복구 후 독립 작업만 분리해 배정하고, 완료 기록과 통합 검증을 확인한다.
