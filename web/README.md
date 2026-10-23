# 가까운 사이 · 서버 연결 앱

선택한 [조선 기록 사진풍 2안](../design/characters/joseon/documentary-ui-v2/02-paper-greeting.png)에 **충청북도 괴산의 서당 훈장 김춘배**라는 가상 인물을 적용했다. 기존 [클릭 시안](../prototype/README.md)은 그대로 보존한다.

실제 카카오 로그인 서버: https://chunbae-staging.vercel.app/. [배포·프로필 저장 검증](../docs/server-staging-deployment.md). NICEPAY 결제와 운영 출시는 아직 준비 중이다.

## 실행

Node 22.17.0에서 검증했다. 루트에서 연구 원본을 복원한 다음 실행한다.

```sh
node research/validation/restore-engines.mjs
pnpm --dir research/validation install --frozen-lockfile
cd web
npm ci
SAJU_AUTH_MODE=local-demo npm run dev
```

주소: http://127.0.0.1:4180. 위 명령은 별도 키 없는 로컬 체험이다. 기본 실행은 `kakao-required`로, 카카오 설정 전에는 입력과 내역을 열지 않는다. [프로필·인증 검수](../docs/kakao-profile-history-review.md)를 참고한다. 기본 DB는 `.data/postgres`의 파일 기반 PGlite이며 Git에서 제외한다. 서버를 종료했다 켜도 입력·결과가 남는다. 실제 개인정보를 합성 검증 자료로 사용하지 않는다.

```sh
npm test
npm run db:check
npm run build
SAJU_AUTH_MODE=local-demo npm start
# 서버가 실행 중인 별도 터미널
npm run test:http
```

`test:http`는 현재 서버에 합성 계정을 생성하므로 개발 서버에서만 실행한다. 모든 금액은 모의 결제다. `npm start`도 연구 모드이며 production build라는 명칭이 서비스 출시 승인을 뜻하지 않는다.

## 구현한 동작

- HttpOnly·SameSite 쿠키 기반 익명 세션, 30일 세션 만료, 해시 저장.
- 입력 자동 저장, 낙관적 revision으로 다른 탭의 덮어쓰기 차단.
- 서버 음양력·윤달·시간 검증. 연구 엔진의 실제 사주 기둥은 결과의 접힌 영역에 표시. 시간 모름은 시주 null 및 절입 후보 보존.
- 첫 무료권 예약·소비와 결과/권한 저장을 트랜잭션으로 처리. 영속 job, lease/fencing, 실패 후 재시도.
- 결과 입력·계산·문구 스냅샷. 같은 사람·출생값은 이름/관계 표시 변경으로 재구매하지 않으며 기존 결과를 그대로 연다. 별명 변경을 과거 결과에 소급 반영하는 프로필 편집은 아직 없다.
- 관계 지도·목록·4명 페이지. 내 출생 정보가 달라지면 지도 그룹을 분리한다. 실제 궁합 점수/거리는 미승인 상태라 제공하지 않는다.
- 공개용 별명·예시 풀이만 담는 256비트 공유 토큰. 토큰 해시만 DB에 저장하고 30일 만료·철회·환불 시 즉시 열람 차단. no-store/noindex/no-referrer.
- 개발용 보관함 복구 코드. 회전 시 이전 코드 만료. 보관함 전환은 기존 계정을 덮어쓰거나 무료 이력을 합치지 않는다. Supabase PKCE·카카오 연결 경로와 명시적 합치기를 구현했다. 내 생일이 다르거나 처리 중 작업이 있으면 합치기를 거절한다. 외부 로그인 왕복은 아직 미검증.
- 가격 2,900원을 서버 고정. 모의 결제, 취소, 승인 응답 유실·승인 전 중단 복구, 중복 지급 차단, 환불 중 권한/공유 중단.
- Toss **테스트 전용** 서버 승인·조회·전액 취소 어댑터와 SDK 진입점. 웹훅 본문을 신뢰하지 않고 공급자 조회로 상태 확인. 실제 Toss 왕복 검증은 키가 없어 미수행.

## 환경 및 경계

[.env.example](.env.example)에 변수명만 있다. `.env.local`에 필요한 설정을 넣는다.

- `DATABASE_URL` 미설정: 로컬 PGlite. **한 Node 프로세스만 사용**한다. 웹 서버와 CLI worker를 같은 디렉터리 DB에 동시에 연결하지 않는다.
- `DATABASE_URL` 설정: pg pool + PostgreSQL 트랜잭션. 로컬 PostgreSQL 17의 두 연결 풀에서 동시성·제한 role·백업 복원을 검증했다. 운영 DB 검증과는 구분한다. 서버 실행 전에 마이그레이션 전용 계정으로 `npm run db:migrate`를 실행한다.
- `PAYMENT_PROVIDER=mock` 기본. `toss-test`를 쓰려면 `TOSS_CLIENT_KEY=test_ck_...`, `TOSS_SECRET_KEY=test_sk_...`와 승인한 테스트 콜백 주소가 필요하다. 키는 브라우저 대화나 Git에 쓰지 않는다.
- `APP_ORIGIN`은 정확한 앱 출처여야 한다. 원격 테스트는 `ALLOW_REMOTE_TEST=true`를 명시해야 한다. 운영 키·production 사주 모드는 코드에서 거절한다.
- 일반 요청 로그는 비활성화했다. 호스팅·프록시 로그의 공유 토큰/결제키 마스킹은 배포 전 별도 설정해야 한다.
- `npm run worker`는 단발성 작업 재개 명령이다. 로컬 PGlite 사용 중이면 웹 서버를 먼저 멈춘다. 외부 DB로 전환한 뒤 별도 worker/대사 실행기를 운영 구성해야 한다.
- 로컬 복구 코드는 운영용 카카오/Supabase 인증을 대체하지 않는다. 비회원 만료 정리·개인정보 삭제·백업 복원 리허설을 구현했다. 외부 무료권 남용 제한, 실제 보존 정책과 운영 동의문은 출시 전 확정이 필요하다.

## 설계 자료와 검증

[통합 QA](qa.md), [구현 상태와 출시 준비](../docs/server-app-status.md), [마이그레이션](db/migrations/001_core.sql), [서비스 테스트](tests/service.test.ts), [HTTP 여정](tests/http.mjs).

공식 참고: [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [PGlite 파일 저장](https://pglite.dev/docs/filesystems), [Toss 결제창](https://docs.tosspayments.com/guides/v2/payment-window/integration), [Toss API](https://docs.tosspayments.com/reference). MIT 엔진과 폰트 고지는 [licenses](licenses/README.md)에 있다.

## NICEPAY · 로그인 · 운영 후속 구현

사용자가 지정한 전자책 플랫폼 **다니엘의 노트**의 결제 서비스는 NICEPAY다. 새 연동은 `PAYMENT_PROVIDER=nicepay-test`를 사용한다. 전자책의 운영 키와 DB는 복사하지 않았다. `S2_` 서버 승인 테스트 상점과 `NICEPAY_MODE=sandbox`만 허용하며 API 호스트도 샌드박스로 고정했다. 기존 Toss 어댑터는 이전 테스트 호환용이다.

NICEPAY 결제 준비 → 서명·20분 반환 토큰 확인 → 거래 소속 조회 → 서버 승인 → 거래 조회 → 이용권 흐름을 구현했다. 웹훅도 서명과 현재 거래를 확인한다. 전액 취소 후 조회가 확인되어야 환불 완료로 기록한다. API 응답을 주입하는 테스트는 통과했지만 실제 NICEPAY 테스트 상점 왕복은 아직 하지 않았다. 승인 전 `ready` 거래 조회 가능 여부도 실제 상점에서 확인해야 한다.

Supabase에 카카오 공급자를 활성화하고 `.env.example`의 URL·publishable key·APP_ORIGIN을 설정한다. redirect allowlist에는 정확한 `APP_ORIGIN/auth/callback`을 등록한다. 서버가 PKCE 코드를 교환하고 `getUser()`로 확인한 식별자만 연결한다. 이미 계정이 있으면 사용자가 합치기/전환을 고른다. 합치기는 현재 입력 기준이 같을 때만 허용하며 주문·결과·공유·무료 이용 이력을 함께 이관한다. 사주 입력·결제 정보는 인증사로 보내지 않고 앱 DB에는 확인된 로그인 식별자와 동의한 닉네임·허용된 이미지 주소를 저장한다. 외부 OAuth 왕복은 프로젝트 설정 후 검증한다.

```sh
npm run db:migrate
npm run test:postgres # 별도 임시 PostgreSQL 클러스터 생성·검증·종료
# PG_BIN=/path/to/postgres/bin 으로 설치 위치 지정 가능
npm run health
npm run maintenance
```

`health`는 집계 상태만 읽고, `maintenance`는 승인/환불 미확정 대사·job 8건 처리·만료 정리를 실행한다. **PGlite에서는 웹 서버를 먼저 종료**하고 실행한다. 외부 PostgreSQL에서는 별도 프로세스가 가능하다. 반복 실행 스케줄러·장애 알림은 호스팅을 정한 뒤 연결한다. DB 역할 예시는 [runtime-role.sql](db/runtime-role.sql)에 있다. 공유 스키마에 무작정 적용하지 말고 전용 테스트 DB에서 사용한다.

개인정보 삭제는 초안·생일·차트·결과·공유·세션·복구 코드를 지운다. 미확정 결제는 먼저 대사하도록 막으며, 최소 주문·동의·무료 사용 이력과 삭제된 로그인 식별자는 남긴다. 삭제 후 늦은 환불 통보는 주문만 종결하고 결과를 복구하지 않는다. 이 보존 범위는 개발 정책이며 운영용 개인정보 처리방침 승인으로 간주하지 않는다.

공식 연동 근거: [NICEPAY 서버 승인](https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md), [조회](https://github.com/nicepayments/nicepay-manual/blob/main/api/status-transaction.md), [취소](https://github.com/nicepayments/nicepay-manual/blob/main/api/cancel.md), [웹훅](https://github.com/nicepayments/nicepay-manual/blob/main/api/hook.md), [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

`003_server_access.sql`은 모든 테이블에 RLS 기본 거절을 적용한다. 마이그레이션 소유자 외 서버 계정은 `runtime-role.sql`의 정책이 필요하다. 호스팅이 anon 역할에 기본 테이블 권한을 부여하더라도 정책이 없어 행을 읽거나 쓸 수 없음을 별도 PostgreSQL 역할로 검증한다. 이후 새 테이블도 RLS와 서버 전용 정책을 함께 추가한다.

## 반복 중단과 요청 크기 제한

작업은 자동 실행 3회까지만 시도한다. 실패를 기록하지 못한 프로세스 중단도 lease 만료 후 횟수에 포함하며, 3회 만료 시 `LEASE_EXHAUSTED`로 종결한다. 무료 예약은 반환하고 유료 이용권은 보존한다. 화면에서 다시 시도하면 같은 비교·구매 권한으로 새 실행 횟수를 시작한다. 한 작업의 오류나 계정 삭제로 다른 계정 작업이 중단되지 않으며 DB 장애 자체는 호출자에게 실패로 전달한다. `worker`와 `maintenance`는 완료·재시도 처리·건너뜀 건수를 출력하고 원문 오류/개인정보는 출력하지 않는다. 자동 지수 지연이나 호스팅 스케줄러는 아직 추가하지 않았다.

API·PG 반환·웹훅은 요청 본문을 읽는 중 16KiB를 넘으면 413, 읽기 시간이 10초를 넘으면 408로 중단한다. Content-Length 유무와 관계없이 UTF-8 바이트를 계산한다. 프록시 레벨의 연결/전송 제한은 실제 호스팅에서 별도로 설정해야 한다.

## 운영 점검 결과 읽기

`npm run --silent health`는 JSON 한 줄로 연구 모드 DB의 현재 상태를 반환한다. `jobs`는 대기·실행·실패·만료 lease 건수, `payments`는 승인 중·승인 불명·환불 대기 건수를 각각 제공한다. `oldestExpiredLeaseSeconds`는 가장 오래된 lease의 만료 후 경과 시간이다. `oldestPendingOrderSeconds`는 미확정 **주문 생성 후** 경과 시간이며 해당 결제 상태의 체류 시간은 아니다. 계정/주문 ID·입력·토큰·원문 오류는 출력하지 않는다.

세 명령(`health`, `worker`, `maintenance`)의 종료 코드는 **0: 점검 정상, 2: 조치 필요, 1: 실행 실패**다. 정상 대기·유효 lease만 있으면 0일 수 있으므로 큐가 비었다는 뜻은 아니다. 실패 job·만료/누락 lease·미확정 결제가 하나라도 있으면 2와 `FAILED_JOBS`, `EXPIRED_LEASES`, `PENDING_PAYMENTS` 사유를 반환한다. DB 연결·조회·종료 실패는 1과 고정 코드 `OPERATION_FAILED`만 출력한다. 이는 서비스 출시 준비 완료 판정이 아니다.

- `EXPIRED_LEASES`: `npm run --silent worker`로 재개 후 다시 점검한다. 3회 소진 작업은 실패로 남으며 자동 무한 재실행하지 않는다. 누락 lease는 DB 상태 점검이 필요하다.
- `FAILED_JOBS`: 보관함에서 해당 결과의 재시도를 실행한다. 무료권 반환·유료 권한 유지 정책을 따르며 원인 해결 없이 전체 작업을 초기화하지 않는다.
- `PENDING_PAYMENTS`: `npm run --silent maintenance`로 기존 결제사 거래를 대사한다. 테스트 상점 설정/접속을 확인하고 상태 불명 거래에 새 결제를 만들지 않는다.
- 종료 코드 1: 환경 설정, DB 연결과 마이그레이션 적용 여부를 확인한다. 인증값이나 원문 오류를 공유 로그에 붙이지 않는다.

`maintenance`는 처리 후 상태로 운영 이력을 남긴다. 재시도 소진 작업을 정리했더라도 실패 job이 남아 있으면 `needs_attention`으로 기록한다. 실제 호스팅 알림·지연 임계치·스케줄러 연결은 미완료다.

## 2026-10-19 연구 계산 경계 보완

새 계산 버전은 `manseryeok-research-civil-midnight-v4`다. 절입 전후 2분의 임시 검토 구간에 출생 입력 분/날짜가 걸치면 연·월주를 미확정으로 두고 후보를 저장한다. 일시주와 기존 저장 결과는 유지한다. 검토 구간은 정확도 보증이 아니며 [원인 조사와 남은 조건](../docs/historical-clock-validation.md), [실행 검증](qa.md)을 따른다.

### 역사 시각·풀이 버전 (2026-10-19)

새 계산은 `manseryeok-research-civil-midnight-v5`다. 국가기록원과 IANA의 1954년 시각 차이에 대해 신규 입력 보호와 시간 미상 표시를 추가했다. 고정 예시 문구는 `content/readings.json`에서 관리하며 신규 작업은 `example-copy-v2`, 대기 작업은 저장된 `rule_version`, 공유는 저장 결과 문구를 따른다. 이전 버전 문구를 삭제하거나 기존 release를 덮어쓰지 않는다. 실제 명리 규칙은 승인 전이다. [감수 기록](../docs/reading-review.md), [역사 검증](../docs/historical-clock-validation.md), [QA](qa.md)를 참고한다.

## 입력별 기호 풀이 후보 v1

신규 결과는 `source-observations-copy-v2`를 사용하며 이전 기호 v1 결과는 보존한다. 서버에서 저장된 계산표를 읽어 일간 오행과 연·월·일의 공통 합충 기호를 설명한다. 대화 제안은 관계 유형별 편집 문구이며 점수는 null이다. 기존 예시 v1/v2와 저장된 결과는 보존한다. 공유에는 사주 기호·생일·검토 근거를 제외한 대화 주제만 담는다. [선정 정책·문구·후보 처리](../docs/selected-reading-release.md)를 따른다. 연구 모드 및 운영 차단은 유지한다.

첫 베타는 로컬 비공개 기호 설명판이다. [범위·풀이 품질·유료 전환 조건](../docs/beta-scope-and-quality.md)과 [17사례 검토 초안](../research/validation/reports/beta-quality-drafts.md)을 따른다. `node research/validation/audit-beta-quality.mjs --check`는 저장소 루트에서 재현한다. 전문가·계산 승인과 실제 사용자 관찰을 통과한 것으로 표시하지 않는다.

## 사용자 흐름·보안·모바일 자동 검사

저장소 루트에서 `npm run build --prefix web` 후 `npm run test:journey --prefix web`를 실행한다. 처음에는 `npm exec --prefix web -- playwright install chromium`이 필요하다. 이 명령은 기존 개발 서버·DB와 분리된 임시 서버/DB에서 HTTP 검사와 320px·390px 모바일 8사례를 실행한다. `.env`나 외부 서비스 키·DB URL을 상속하지 않고 연구 모드·모의 결제로 고정한다. GitHub Web validation에서도 같은 여정을 실행한다.

새로고침 복귀는 저장된 현재 보관함의 결과·초안만 허용한다. 탭 저장소에는 화면·내부 식별자만 남기고 동의·생일·이름·토큰·복구 코드는 보관하지 않는다. [설계·보안 변경·복구와 검증 범위](../docs/local-release-checks.md)를 따른다. `web/test-results/`에는 합성 자료 및 테스트 토큰이 포함될 수 있으므로 Git과 일반 공개 자료에서 제외한다.

## 2026-10-20 저장 계산 근거와 출시 검토

계산 상세에는 저장된 양력 환산·연월주 후보·시간 모름과 자정/절입/태양시 보정 기준, 1908년 4월 전 표준화/1972년 전/1954년 시각 제한을 표시한다. 지원하는 저장 정책만 설명하며 새 정책으로 계산을 교체하지 않는다. 공개 카드와 기존 풀이 버전은 유지한다. 현재 단위·서비스 80개 및 모바일 12사례를 검사한다. [추가 달력 730일·풀이 100조합 및 출시 종합 검사](../docs/calendar-reading-release-review.md)를 참고한다.

## 2026-10-20 입력 안내와 지연 요청 점검

입력 전 [계산·저장·공유 안내](content/research-policy.json)를 펼쳐 확인할 수 있다. 이 파일은 안내용이며 계산을 덮어쓰지 않는다. 기존 결과는 저장 당시 정책을 계속 사용한다. 과거 시계의 소실/중복과 양력 환산 연도 범위 초과를 구분해 안내하고, 시각을 자동 보정하거나 무료권을 소모하지 않는다.

`health`에 `jobs.delayedQueued`와 `oldestQueuedComparisonSeconds`를 추가했다. queued인 비교의 생성 후 300초 이상이면 `DELAYED_QUEUE`와 종료 코드 2다. 이는 순수 큐 체류 시간이나 운영 SLO가 아니며, 재시도도 원래 비교 생성 시각을 유지한다. worker 중단/주기를 확인하고 처리한 뒤 다시 점검한다.

웹 88개·모바일 18사례·HTTP·빌드/타입·로컬 PostgreSQL 복원 통과. [실제 감수와 사용자 관찰 양식](../docs/launch-review-kit.md), [정책 권장안](../docs/calculation-policy-candidate.md), [운영 절차](../docs/launch-operations-runbook.md)는 준비됐으며 실제 전문가·참가자·외부 연동·운영 승인은 별도다.

## 김춘배 훈장 화면과 공유 버전

한지 배경·Noto Serif KR 제목·먹갈색 버튼과 카메라를 보지 않는 창작 사진을 사용한다. [설정·자산 제작 기록](../design/characters/joseon/chunbae-v1/README.md), [시각 비교 QA](../design-qa.md)를 따른다. 새 이미지는 실제 역사 사진이 아니며 훈장은 안내 인물이다. 인물 안내는 시작 화면의 펼침 항목에서 읽는다.

신규 기호 설명 공유에는 chunbae-v1/kim-chunbae-v1만 고정한다. 기존 tigers-v1 공유는 기존 그림으로 표시하고, 미지원 카탈로그는 최신 인물로 대체하지 않는다. 공개 미리보기와 공개 페이지가 같은 자산 해석기를 사용한다. 계산 v5·문구 v2·기존 저장 결과/구매/가격은 그대로다. 신규 서비스 회귀 검사로 이전 공개 스냅샷과 결과의 불변을 확인했다.

웹 88개, HTTP, 320/390px 모바일 18사례, 빌드·타입, 로컬 PostgreSQL 21테이블 복원/권한 검사를 통과했다. 실제 Chrome에서 입력→결과→공유 미리보기 및 인물 안내를 확인했다. 외부 인증·PG 검증이나 공개 출시 완료를 뜻하지 않는다.

입력부터 결과까지 [훈장 말투·전체 여정 기준](../docs/chunbae-journey-voice.md)을 적용했다. `journey-copy.json`은 현재 화면의 안내만 담당하고 저장된 풀이 버전과 분리한다. 입력은 단계가 보이는 기록장, 결과는 세 부분 해설과 인장, 공유·지도·보관함은 같은 한지 디자인을 사용한다.

## 외부 연동·운영 시작 전 검사

[1→3→4 실행 안내](../docs/launch-sequence-1-3-4.md)에 따라 별도 테스트 설정을 사용한다. `staging.env.example`을 Git 제외 `.env.staging.local`에 복사하고 비공개로 채운다. `npm run check:staging -- --settings .env.staging.local`은 네트워크/DB를 건드리지 않고 누락·잘못된 형식/운영키·TLS 해제·공개 secret 변수를 검사한다. 통과는 실제 연동 성공이 아니며 미준비는 종료2, 파일/인자 오류는 값 없이 종료1이다.

`npm run start:staging -- --settings .env.staging.local`은 같은 검사 통과 후에만 127.0.0.1:4180에서 Next를 시작한다. 별도 DB 마이그레이션·호스팅/접근 제어·실제 로그인/PG·운영 복구 검증을 대신하지 않는다. 기존 로컬 실행과 생성된 결과 버전은 유지한다.

실제 연결 재개는 [외부 연동 상태](../docs/external-connection-progress.md)를 확인한다. 외부 서버 시작은 저장소의 SQL 전체 적용과 체크섬을 검증하며, runtime 계정으로 누락 스키마를 자동 생성하지 않는다.

## 실제 스테이징 앱 백업의 로컬 복원 검사

`npm run test:hosted-restore -- --settings .env.staging.local --bootstrap .env.supabase-bootstrap.local --project nwicejxousubxiczwwkb --private-local-copy`는 지정한 연구용 서울 DB를 읽기 전용으로 백업해 자체 생성한 임시 로컬 PostgreSQL17에만 복원한다. 실제 개인정보가 포함될 수 있어 비공개 로컬 복사를 명시해야 한다. 파일 권한600·동일 snapshot·21테이블 데이터/스키마/소유자/RLS/ACL·제한/익명 권한을 확인하고 임시본을 제거한다. 원문·토큰·자격·행 해시는 출력하지 않는다. 관리자를 앱에 등록하거나 원격 복원을 수행하지 않는다. [한계·정리 실패 대응·재현 기록](../docs/hosted-backup-restore-check.md)을 따른다. Supabase auth/스토리지·장기 백업·전체 재해 복구 승인은 포함하지 않는다.

## 운영 명령 인자 보호 · 2026-10-23

health는 maintenance 진입점의 정확한 --health 하나만 허용하며 maintenance와 worker는 추가 인자를 받지 않는다. 옵션 오타·중복·지원하지 않는 dry-run/임의 인자는 DB 연결 전 종료1/INVALID_OPERATION_ARGUMENTS로 거절한다. 입력한 인자 원문은 출력하지 않는다. 카카오/NICEPAY 여정 명령도 정확한 검사 범위 하나만 허용하며 잘못된 인자는 INVALID_JOURNEY_ARGUMENTS로 중단한다. 실제 운영 중 상태만 보려면 npm run health를 사용하고, maintenance/worker는 데이터를 처리한다.

현재 외부 연동/운영 증거와 남은 일은 [출시 현황](../docs/launch-status-current.md)을 따른다.


## 보관·환불·백업·알림 기본값 · 2026-10-23

[채택한 정책과 미연결](../docs/policies/release-decisions.md)을 따른다. 서버 조회는30일 지난 초안 내용을 반환하지 않으며 정리 시 개인 내용을 지우고 수정 번호만 남긴다. 기존 결과/계정 내역은 회원 유지 동안 보관한다. `npm run retention`은 만료 정리만 실행하고 PG/worker를 실행하지 않는다. DB를 변경하는 명령이므로 상태 확인에는 `npm run health`를 사용한다. 어느 정기 작업도 원격에 새로 등록하지 않았다.

승인/환불 최초 요청은 `payment_attempts`에 기록하고 재시도로 시각을 갱신하지 않는다. health의 `overduePending`은 현 작업 요청 후10분 이상, `unknownPendingAge`는 기존 기록의 시각 미확인 건수다. 오래된 주문의 생성일을 환불 대기 시간으로 쓰지 않는다.7일 자율 환불 판정은 검증된 결제시각을 받는 준비 함수이며 운영 접수에는 아직 연결하지 않았고 sandbox 전액 취소도 제한하지 않는다.

`npm run backup:file`은 저장소 밖의 비공개 기존 덤프를 별도 키로 암호화/인증 복호화하는 파일 명령이다. DB·업로드·7일 자동 파기 기능은 없다. `npm run alerts:plan`은 엄격한 집계 JSON으로 알림 후보와 모의 다음 상태만 출력하며 외부 발송하지 않는다. 파일 형식·권한/키 분리·명령 예시는 [운영·복구 준비](../docs/operations-recovery-preparation.md)를 확인한다. `test:postgres`는 합성 덤프를 암호화·복호화한 파일로 격리 복원한 뒤 임시본을 제거한다.
