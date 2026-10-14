# 가까운 사이 · 서버 연결 앱

선택한 [호랑이 2번](../design/characters/tigers/02-tiger.png)을 Next.js로 구현했다. 기존 [클릭 시안](../prototype/README.md)은 그대로 보존한다.

## 실행

Node 22.17.0에서 검증했다. 루트에서 연구 원본을 복원한 다음 실행한다.

```sh
node research/validation/restore-engines.mjs
pnpm --dir research/validation install --frozen-lockfile
cd web
npm ci
npm run dev
```

주소: http://127.0.0.1:4180. 별도 API 키 없이 실행한다. 기본 DB는 `.data/postgres`의 파일 기반 PGlite이며 Git에서 제외한다. 서버를 종료했다 켜도 입력·결과가 남는다. 개발 화면에는 합성 데이터 채우기 버튼이 있다. 실제 개인정보를 검증 자료로 사용하지 않는다.

```sh
npm test
npm run db:check
npm run build
npm start
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

Supabase에 카카오 공급자를 활성화하고 `.env.example`의 URL·publishable key·APP_ORIGIN을 설정한다. redirect allowlist에는 정확한 `APP_ORIGIN/auth/callback`을 등록한다. 서버가 PKCE 코드를 교환하고 `getUser()`로 확인한 식별자만 연결한다. 이미 계정이 있으면 사용자가 합치기/전환을 고른다. 합치기는 현재 입력 기준이 같을 때만 허용하며 주문·결과·공유·무료 이용 이력을 함께 이관한다. 이메일·카카오 프로필·출생 정보를 인증사로 보내지 않는다. 외부 OAuth 왕복은 프로젝트 설정 후 검증한다.

```sh
npm run db:migrate
npm run test:postgres # 별도 임시 PostgreSQL 클러스터 생성·검증·종료
# PG_BIN=/path/to/postgres/bin 으로 설치 위치 지정 가능
npm run health
npm run maintenance
```

`health`는 집계 건수만, `maintenance`는 승인/환불 미확정 대사·job 8건 처리·만료 정리를 실행한다. **PGlite에서는 웹 서버를 먼저 종료**하고 실행한다. 외부 PostgreSQL에서는 별도 프로세스가 가능하다. 반복 실행 스케줄러·장애 알림은 호스팅을 정한 뒤 연결한다. DB 역할 예시는 [runtime-role.sql](db/runtime-role.sql)에 있다. 공유 스키마에 무작정 적용하지 말고 전용 테스트 DB에서 사용한다.

개인정보 삭제는 초안·생일·차트·결과·공유·세션·복구 코드를 지운다. 미확정 결제는 먼저 대사하도록 막으며, 최소 주문·동의·무료 사용 이력과 삭제된 로그인 식별자는 남긴다. 삭제 후 늦은 환불 통보는 주문만 종결하고 결과를 복구하지 않는다. 이 보존 범위는 개발 정책이며 운영용 개인정보 처리방침 승인으로 간주하지 않는다.

공식 연동 근거: [NICEPAY 서버 승인](https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md), [조회](https://github.com/nicepayments/nicepay-manual/blob/main/api/status-transaction.md), [취소](https://github.com/nicepayments/nicepay-manual/blob/main/api/cancel.md), [웹훅](https://github.com/nicepayments/nicepay-manual/blob/main/api/hook.md), [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
