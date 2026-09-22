# P2 인증·저장 연결 및 검증


2026-09-21 반복 운영 개선은 `202609210014_file_retry_recovery.sql`까지 순서대로 적용한다. 0010은 위험성평가 회차, 0011은 위험요인 안정 ID 재개, 0012는 권한 범위 자료·검토 검색, 0013은 요약 파서 오류 격리, 0014는 업로드 응답 유실·실패 복구다. 기존 문서·증빙·수행·검토 사실을 새 회차로 복사하지 않는다. 실패·사용 제한 또는 10분이 지난 업로드 대기는 최신 미확인 버전에서 저장 본문만 새 버전으로 만들어 파일을 다시 연결할 수 있다. 이전 파일은 보존하고 검사 대기 파일을 통과 처리하지 않는다. 10분은 서비스 재시도 기준이다. 실제 검사 공급자는 여전히 미연동이다.
## 현재 범위

2026-09-18 안내 UX에는 `202609180009_guided_journey.sql`까지 필요하다. 0009는 저장된 위험성평가의 7단계 기록 준비·미판단 수와 같은 조회 시점의 업무 메타데이터를 기존 요약 RPC에 추가한다. 사용자별 안내 위치는 비공개 테이블과 권한 검사 RPC로 보관하며 업무 사실·문서 버전·수행 기록을 바꾸지 않는다. SQL/TypeScript 요약 일치와 권한은 PGlite에서 검증한다. 실제 Supabase 적용·Auth/Storage 연결 결과는 아니다.

P2 코드와 로컬 PostgreSQL 정책 검증을 위한 구성이다. 실제 Supabase 프로젝트·Auth/MFA·Storage 서비스 연결, 파일 검사 공급자와 실제 파일 복구는 별도 검증이 필요하다. 키를 채팅에 입력하지 않는다.

회원 업무 목록과 중앙관제 분리 추가: `PORTALS_TASKS.md`를 함께 따른다. 신규 0004~0007 마이그레이션과 비공개 운영자 등록이 필요하다. 배정만으로 운영자 권한을 자동 부여하지 않는다.

2026-09-17: 최신 앱의 홈 요약에는 `202609170008_task_action_sources.sql`도 필요하다. 현장·민감자료·배정 권한을 검사하고 최신 저장본의 버전·작성자 확인·미해결 조치 수·목표일만 반환한다. 원문을 반환하지 않으며 호출당 `task_action_sources_read` 감사 1건을 남긴다. 기존 자료는 변경하지 않는다. PGlite 검증과 실제 Supabase 적용·연결 확인은 별개다.

0007은 사업장 정보·revision·확인 시각을 추가하고 이전 4인자 프로필 RPC를 7인자 RPC로 교체한다. 기존 탐색 조건은 미확인으로 유지하며 이전 사실은 감사 이력에 보존한다. 새 앱 실행 전에 마이그레이션을 적용해야 한다. 사업장 정보 확인 전에는 DB에서도 신규 업무 생성을 거부하고 기존 기록의 열람·수정 권한은 유지한다.

| 경로 | 기능 |
|---|---|
| `/login` | 기존 Supabase 계정의 이메일·비밀번호 로그인. 설정이 없으면 입력 폼 비활성 |
| `/workspace` | 사업장 정보 선입력·확인 후 현장별 관리 업무·관련 후보·전체 열람 |
| `/workspace/map` | 입력 미완성 상태에서도 관리 분야·업무·저장된 기록 준비 확인 |
| `/workspace/reviews` | 보완 요청 우선의 검토 자료·이력 연결 |
| `/workspace/tasks/[id]` | 공통 기록·핵심 자체 서식·기존 자료 연결·증빙·검토·수행 |
| `/workspace/documents` | 기존 자료함·별도 자료 작성 |
| `/ops/login`, `/ops/security`, `/ops` | 별도 운영자 인증·MFA·배정 검토 |
| `/workspace/documents/[id]` | 버전·내용 확인·검토·보완·수행 정정·첨부 상태 |
| `/workspace/members` | 초대 코드 생성·수락·철회. 자동 이메일 발송 없음 |
| `/workspace/security` | 인증 앱 등록·AAL2 추가 인증 |
| `/api/files` | 권한 확인 후 최대 10MiB 원본 격리 업로드 |
| `/api/files/[id]` | 검사 완료·권한 확인·감사 기록·무결성 확인 후 다운로드 |

`/app`은 회원 전용 데모다. `/ops`는 실제 운영자 인증으로 보호하며 시험 실행기의 분리된 테스트 세션만 별도로 허용한다. `APP_MODE=live`에서는 데모 서버 액션·시험 세션 생성을 거부한다. 실제 공간의 자료에 `DEMO_` 규칙·샘플 사진·OCR 결과를 넣지 않는다.

## 1. 키 없이 로컬 검증

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:db
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_PORT = '3012'
$env:CI = '1'
npm.cmd run test:e2e
```

`test:db`는 PGlite의 PostgreSQL 엔진에서 배포할 SQL을 그대로 실행한다. `tests/integration/bootstrap.sql`의 Auth 사용자·JWT 컨텍스트·Storage 메타데이터는 시험 대역이다. JWT 서명 검증·Supabase 인증 API·실제 Storage 바이트 전송을 검증했다는 뜻은 아니다. 테스트 대역 SQL은 Supabase 프로젝트에 배포하지 않는다.

`p2-adapters.test.ts`는 실제 Supabase SDK를 사용하되 HTTP 응답을 테스트에서 제공한다. 실제 공급자 호출로 집계하지 않는다.

Windows에서 테스트 서버 자동 종료가 지연되면 별도 터미널에서 `npm.cmd run start -- --port 3013`을 실행하고, 테스트 터미널에서 `$env:PLAYWRIGHT_PORT='3013'`, `$env:CI=''`을 지정해 해당 서버를 사용할 수 있다. 최종 검증은 이 방식으로 7개 시나리오를 통과했다.

## 2. 실제 연결 준비

1. 별도 시험용 Supabase 프로젝트에서 `supabase/migrations/*.sql`을 파일 이름 순서로 적용한다. 기존 프로젝트는 먼저 백업하고 적용 범위를 확인한다. Storage의 `storage.allow_only_operation` 함수가 있는 버전이 필요하다. 함수가 없다고 정책의 작업 제한을 제거하지 않는다.
2. `.env.example`을 참고해 Git에 포함되지 않는 `.env.local`에 설정한다. 실제 값은 비밀 관리 도구 또는 로컬 파일에만 저장한다.

   ```dotenv
   APP_MODE=live
   AI_MODE=off
   OCR_MODE=off
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   앱은 관리자 키를 읽지 않는다. 이 구성은 새 publishable key를 사용한다. 구형 anon JWT나 service role 키를 대체 입력하지 않는다. 원격 URL은 HTTPS를 요구하고 로컬 Supabase는 loopback HTTP를 허용한다.

   역방향 프록시를 사용하는 환경은 실제 요청의 Host와 X-Forwarded-Proto를 신뢰할 수 있게 정규화한다. 파일 POST는 브라우저 Origin과 이 값들을 대조한다.

3. 비공개 `safety-evidence` 버킷을 만든다. 제한은 10MiB, `application/pdf`, `image/jpeg`, `image/png`이다. `npm.cmd run storage:setup`은 별도 `SUPABASE_SERVICE_ROLE_KEY`가 설정된 환경에서 버킷을 생성하거나 기존 설정을 확인한다. 이미 있는 버킷의 공개 상태 등을 자동 변경하지 않는다. 이 명령은 외부 프로젝트를 변경하므로 원하는 시험 프로젝트인지 확인한 뒤 실행한다. 설정용 관리자 키를 Next.js 실행 환경에 유지할 필요는 없다.
4. 시험용 Auth 계정을 준비한다. 이 앱은 계정 생성·메일 발송을 실행하지 않는다. 이메일 확인 상태를 완료한 계정으로 로그인한다. 새 빈 조직 만들기와 기존 조직의 소속 승인은 별개다.
5. `npm.cmd run dev -- --port 3011` → `http://127.0.0.1:3011/login`. 첫 사용자는 빈 조직·현장을 만들 수 있다. 현장 소유자는 대상 이메일에 묶인 초대 코드를 생성한다. 대상자는 같은 확인된 이메일로 로그인한 뒤 코드를 입력한다. 코드는 URL에 포함하지 않아 접근 로그·Referer로 전송되지 않게 한다.
6. 검토자는 다음 절차로 배정하고 인증 앱을 등록·인증한 뒤 자료를 조회한다. 검토 완료는 자료 검토이며 이행·법적 승인·기관 접수로 바뀌지 않는다.

## 3. 배정·권한 운영

현재 조직 소유자는 초대 생성·철회를 화면에서 처리한다. 검토자 배정·민감자료 접근 권한 부여·기존 구성원 접근 철회는 권한 있는 DB 운영자가 범위를 확인한 뒤 처리한다. 일반 회원에게 테이블 쓰기 권한을 열지 않는다. 이 운영 UI는 후속 작업이다.

- `safety_memberships`: 조직의 활성 소속, owner/member. 조직 소유자라도 모든 현장·건강자료를 자동으로 읽지 않는다.
- `safety_workplace_access`: 현장별 읽기·쓰기·민감자료·활성 여부. 조직 소속도 활성이어야 한다.
- `safety_reviewer_assignments`: 현장·검토자·시작·만료·검토 가능 여부·민감자료 범위·철회 시각. JWT의 `aal2`를 함께 요구한다. 사용자 편집 프로필 메타데이터를 사용하지 않는다.
- 권한 행의 INSERT/UPDATE는 대상·이전/이후 값과 함께 `safety_audit_events`에 기록된다. 운영자 직접 SQL의 `actor_id`는 null일 수 있으므로 관리자 SQL 세션/작업 기록과 연결해 보관한다.

SQL 작업 예시에서 UUID는 운영자가 확인한 실제 대상에 바인딩한다. 아래 문자열을 그대로 실행하지 않는다.

```sql
-- 검토자 배정: 실제 만료일과 민감자료 허용 범위를 별도 결정한다.
insert into public.safety_reviewer_assignments
  (organization_id, workplace_id, reviewer_id, starts_at, expires_at, can_review, can_read_sensitive)
values (:organization_id, :workplace_id, :reviewer_id, :starts_at, :expires_at, true, false);

-- 배정 철회와 현장 접근 철회. 원본·검토 이력은 삭제하지 않는다.
update public.safety_reviewer_assignments set revoked_at = now()
where id = :assignment_id and organization_id = :organization_id;
update public.safety_workplace_access set active = false
where workplace_id = :workplace_id and user_id = :user_id and organization_id = :organization_id;
```

사업자등록번호만으로 기존 조직을 조회하거나 연결하는 경로는 없다. 초대는 기본적으로 민감자료 권한을 주지 않으며, 이미 철회된 소속을 초대 수락으로 자동 활성화하지 않는다.

## 4. 파일 검사 연결 계약

사전검사는 크기·파일명·확장자·MIME·파일 시작 바이트를 확인한다. 파일 전체 구조·암호화·페이지 수·악성 여부 검사는 별도다. `FileInspector`는 공급자 연결용 계약이고 현재 구현은 `unavailable`만 반환한다.

상태: `reserved → quarantined → clean/rejected`. 실패는 `failed`로 남는다. 비정상 종료로 `reserved`에 남은 건은 운영자 점검 대상이다. 원본은 덮어쓰지 않는다. 실패·검사 거부 파일이 있는 버전은 확인할 수 없으며 파일을 연결하지 않은 새 버전으로 내용을 보완할 수 있다.

실제 검사 워커는 격리 파일을 비공개로 읽고, 제한된 메모리·시간·네트워크 환경에서 악성코드·전체 형식·PDF 암호화·페이지 수를 검사한다. 다운로드한 바이트의 SHA-256·크기를 비교한 뒤 별도 관리자 컨텍스트에서 `safety_record_file_inspection`을 호출한다. 요청자가 제공한 성공 표시나 헤더만으로 `clean`을 기록하지 않는다. 일반 인증 사용자는 검사 결과 함수를 실행할 수 없다.

서명 URL 발급·목록·변환 경로에는 Storage SELECT를 허용하지 않는다. 감사 RPC가 만든 15초 내부 티켓과 현재 자원 권한이 모두 있어야 `object.get_authenticated`가 허용된다. 앱 다운로드는 전송 직전 권한과 해시를 다시 확인하며 `private, no-store` 응답을 사용한다. 이미 사용자에게 전달된 파일 사본까지 원격 회수하는 기능은 아니다.

## 5. 백업·복구 및 실제 연결 인수 조건

- 로컬 테스트는 DB 백업 데이터 복원과 권한 철회 상태 보존을 확인한다. 실제 Supabase 운영 복구 시험을 대신하지 않는다.
- 실제 백업은 DB 스키마/데이터/권한과 Storage 원본 바이트·객체 경로·해시 목록을 같은 기준 시점으로 확보한다. DB만 복원해도 파일이 복원된다고 가정하지 않는다.
- 복원은 별도 비공개 시험 프로젝트에서 시작한다. 공개 접근을 열기 전에 최신 권한 철회·탈퇴·삭제 및 보존 보류 목록을 다시 적용한다.
- Auth 사용자 ID와 조직 소속을 대조하고 파일 해시를 확인한다. 허용 사용자·다른 고객·미허용 현장·미배정/만료 검토자로 각각 조회·다운로드를 실행한다.
- 검사 결과를 확인할 수 없는 파일은 격리 상태를 유지한다. 복원 뒤 `safety_download_tickets`는 비워 기존 다운로드 준비 기록을 재사용하지 않는다.
- 실제 DB+Storage 복구 성공, Auth/MFA 세션 갱신·로그아웃, 고객 간 API/RLS 격리, 파일 악성/암호화/대용량 검사, 비공개 시범 사용자 검증 결과를 남긴 뒤 실사용 준비 상태를 판단한다.

## 확인한 공식 문서

- [Supabase 서버 인증 클라이언트](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs): 쿠키 갱신과 `getUser`/`getClaims` 검증.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): 행 정책·최소 권한.
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa): AAL2와 인증 앱 흐름.
- [Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control), [작업별 정책 함수](https://supabase.com/docs/guides/storage/schema/helper-functions): 비공개 파일 및 API 작업 제한.
- [Storage 스키마](https://supabase.com/docs/guides/storage/schema/design): 버킷·객체 변경은 API 사용.
- [PGlite](https://pglite.dev/docs/): 로컬 PostgreSQL 실행. 이 프로젝트의 시험용 의존성이다.

기존 Node 24·Next.js·React 버전은 유지했다. 추가 패키지는 `@supabase/ssr@0.12.7`, `@supabase/supabase-js@2.116.0`, 개발 검증용 `@electric-sql/pglite@0.5.8`로 고정했다.
