# 카카오·NICEPAY 실제 연동 착수

2026-10-22. 사용자가 실제 로그인/결제 연결을 요청했다. 전용 서울 Supabase DB와 카카오 앱을 연결한 뒤 서버에서 실제 OAuth 복귀·앱 세션·프로필 저장·재로그인까지 확인했다. 결제와 탈퇴/운영 검증은 남아 있다. 최신 [서버 배포 기록](server-staging-deployment.md)을 따른다.

## 확인한 상태

- 최초에는 카카오 본인 로그인이 필요했다. 이후 사용자가 로그인을 완료하고 앱 생성·정책 확인·최소 프로필 키 연결을 승인하여 전용 앱1618169를 생성했다. 아래 최신 카카오 연결 기록을 따른다.
- Supabase Dashboard 관리자 로그인 완료. 사용자 요청으로 Google→GitHub 로그인과 인증 앱의 추가 인증을 거쳐 wani3000 계정으로 진입했고, Supabase 조직 화면까지 확인했다. 이는 앱 사용자용 카카오 OAuth 연동과 다르다. 무료 프로젝트2개를 모두 사용 중이라는 생성 제한 안내와 비활성 생성 버튼을 확인했다. 새 프로젝트/DB/역할/공급자는 생성되지 않았다. Supabase 연결 플러그인 설치와도 구분한다.
- NICEPAY 관리자는 계정 입력 단계. 전자책 `Documents/Codex/2026-07-18/pc/website`의 코드와 과거 온보딩 기록에서 같은 결제사임을 재확인했다. 현재 사주용 테스트 키·운영 계약 완료·새 거래는 확인되지 않았으며 전자책 운영 키/DB를 복사하지 않았다. 2026-10-22 추가 조사에서는 해당 전자책 Vercel에 NICEPAY 변수4개가 등록된 사실을 확인했다. 아래 추가 조사 기록이 과거의 설정 누락 기록보다 우선한다.
- 이전 커밋8d05804의 GitHub Research/Web/Prototype validation은 모두 성공했다.

## 실제로 준비한 서버 대상

기존 공개 정적 체험판과 별개인 Vercel 프로젝트를 생성했다.

| 항목 | 확인값 |
|---|---|
| 팀 | oxaz1234-gmailcoms-projects |
| 프로젝트 | chunbae-staging |
| 프로젝트 ID | prj_g8ciaxVhxmH3PIunfoqeN9z4jhHJ |
| 설정 | Next.js, Node22.x, npm ci / npm run build |
| 소유 도메인 | chunbae-staging.vercel.app, Vercel 등록/verified 확인 |
| 앱 배포 | 전용 서울 서버 Ready, 후속 배포 기록 참고 |
| 원격 환경변수 | 인증 검증용9개 등록, NICEPAY 키 미등록 |
| 연결 | web/.vercel에 전용 프로젝트로 연결, Git 제외 |

도메인 소유/등록은 실제 앱 서비스 응답이나 OAuth 성공 증거가 아니다. 최초 준비 당시 로컬에는 origin만 있었으나, 아래 후속 작업에서 DB·Supabase 공개 설정과 스키마 적용을 완료했다. NICEPAY 설정과 서버 배포는 아직 남아 있다. 사주 전용 DB와 runtime 역할을 사용하고 기존 프로젝트의 데이터에는 마이그레이션하지 않는다. 서버 배포는 연구 엔진 생성과 SQL 파일 포함을 확인한 로컬 prebuilt 경로 또는 저장소 전체 빌드 경로를 사용해야 한다. web 폴더만 원격 업로드하면 상위 연구 엔진 복원 경로가 빠질 수 있다.

## 연결 과정에서 수정한 문제

1. `staging.env.example`에 로그인 필수 모드가 빠져 있었다. `SAJU_AUTH_MODE=kakao-required`를 추가하고 비밀값을 입력하지 않는 템플릿 회귀 검사를 추가했다. 기존 로컬 비밀 설정은 값을 출력하지 않고 누락된 모드만 보완했다.
2. 외부 DB 시작 검사가003까지만 확인해004 프로필 변경이 빠져도 통과할 수 있었다. 모든 배포 마이그레이션의 적용 여부와 체크섬을 읽기 전용으로 확인한다. 누락/변경이면 서버 시작을 거절하며 runtime 자격으로 스키마를 자동 수정하지 않는다.

웹150개·Next 빌드·타입·로컬 PostgreSQL21테이블 복원 통과. 새4개 검사는 최신 프로필 마이그레이션 누락/원장 변조/미초기화 DB 거절과 템플릿 누락을 확인한다. 제한된 runtime 역할 및 복원 DB에서도 원장 읽기 검사를 통과했다. 빌드의 API 추적 파일에 SQL001~004 포함을 확인했다. 당시 로컬 설정 검사는5개 설정 누락으로 차단됐다. 아래 후속 연결 후 최신 누락은 NICEPAY 테스트 client/secret의2개다. 이는 외부 연결 성공/실결제 검증이 아니다.

## 인증 후 이어갈 순서

1. 카카오 전용 앱 생성, Supabase 프로젝트/카카오 공급자, 정확한 두 콜백 등록. 닉네임·사진 최소 동의와 이메일 없는 계정을 확인한다. [Supabase 공식 절차](https://supabase.com/docs/guides/auth/social-login/auth-kakao).
2. 전용 PostgreSQL 마이그레이션/제한 역할을 적용한 뒤 서버 staging 배포·접근·쿠키·실제 OAuth 왕복·기기 변경과 내역 소유권을 검사한다.
3. NICEPAY 사주 테스트 상점의 Server 승인/Basic 키로 승인·조회·중복 콜백·취소·권한 회수와 웹훅을 검증한다. 공식 문서는 샌드박스와 운영 키/응답을 구분한다. [테스트 상점](https://github.com/nicepayments/nicepay-manual/blob/main/common/test.md), [키 설정](https://github.com/nicepayments/nicepay-manual/blob/main/common/api.md).
4. 운영 결제는 상점/서비스 심사·계약·정책·원고/계산 승인과 운영 키가 확인된 뒤 별도 전환한다. 지금 코드의 `research`/테스트 PG 제한을 제거하지 않았다. 실제 카카오 연결 해제/탈퇴 및 외부 웹훅도 [기존 검수](kakao-profile-history-review.md)의 미완료 항목으로 유지한다.

## 2026-10-22 Danielsbook 전자책 소스 재확인

사용자가 ‘다니엘의 서점 / Danielsbook’의 코드·GitHub·로컬 파일을 확인하도록 요청했다. 확인한 전자책 프로젝트의 실제 코드상 이름은 **다니엘의 노트**, 운영 도메인은 `danielsnote.com`이다. ‘Danielsbook’이라는 별도 저장소·프로젝트와 같은 서비스인지는 이름만으로 확정하지 않는다.

- 로컬: `/Users/chulwan/Documents/Codex/2026-07-18/pc/website`.
- GitHub: [wani3000/book](https://github.com/wani3000/book). 로컬 HEAD와 원격 main은 `82a95ee7d8d4ec38b946c9a0d069a98e4a652d09`로 일치한다. 기존 작업자의 미커밋 주문/라이브러리 변경3파일은 수정하지 않았다.
- Vercel: `oxaz1234-gmailcoms-projects/danielsnote`, 프로젝트 `prj_4LQYXek8dd6LhL71a1FXYuAn4L4h`. 도메인 루트 HTTP200과 현재 문서 제목 ‘다니엘의 노트’를 확인했다.
- NICEPAY 모듈: `app/nicepay/server.ts`의 Basic 인증·요청/응답 SHA256 서명·승인/조회/전액 취소, `app/api/nicepay/ready/route.ts`의 로그인/서버 상품 가격/주문 생성, `app/api/nicepay/return/route.ts`의 인증 서명/주문 일치/승인/주문 저장 실패 복구, `app/refunds/process.ts`의 환불/대사/열람 권한 회수. 클라이언트는 공식 `AUTHNICE.requestPay` SDK를 사용한다.
- 현재 Production 변수 이름 조회에서 **NEXT_PUBLIC_NICEPAY_CLIENT_KEY, NICEPAY_SECRET_KEY, NEXT_PUBLIC_NICEPAY_ENABLED, NICEPAY_MODE의4개 등록을 확인했다.** 8월 인계 문서의 ‘활성 플래그·모드 미설정’을 현재 사실로 재사용하지 않는다. 키 값은 열람/복사하지 않았다. 두 비밀이 아닌 플래그의 개별 조회도 값이 생략되어 활성 여부와 sandbox/production 값은 확정하지 못했다.
- 과거 인계 문서는19,000원 승인·전액 취소·권한 회수 이력을 기록한다. 일부 구절은 테스트 상점, 일부는 운영 스토어라고 적혀 있어 해당 문서만으로 실운영 승인·현 계약 완료를 확정하지 않는다. 이번에는 실제 주문·승인·조회 거래·환불을 실행하지 않았다.

### 사주 코드와 대조

이미 `web/src/server/nicepay.ts`, `nicepay-checkout.ts`, `web/src/components/nicepay-client.ts`에 같은 결제사의 Server 승인/Basic·서명 검증·조회·전액 취소 흐름이 구현돼 있다. 전자책 모듈을 통째로 복사할 필요는 없다. 전자책의 Turso 주문/PDF 권한은 사주 PostgreSQL 주문/이용권과 구조가 다르며 공유하지 않는다.

| 전자책 설정 | 사주 설정/차이 |
|---|---|
| NEXT_PUBLIC_NICEPAY_CLIENT_KEY | NICEPAY_CLIENT_KEY; 사주는 서버가 결제 준비 응답에 필요한 공개 clientId만 전달 |
| NICEPAY_SECRET_KEY | 같은 이름의 서버 비밀 설정; 실제 값의 재사용 여부는 미확인 |
| NICEPAY_MODE=sandbox 또는 production | 현재 사주는 sandbox 및 S2 서버 승인 키만 허용 |
| NEXT_PUBLIC_NICEPAY_ENABLED=true | 사주는 PAYMENT_PROVIDER=nicepay-test로 공급자 선택 |
| /api/nicepay/return | 사주는 같은 경로에 만료되는 state nonce를 추가하여 주문과 연결 |

따라서 ‘전자책에 설정이 전혀 없다’는 결론을 철회한다. 현재 남은 것은 사주 전용 환경에 사용할 테스트 설정 확인·서버 DB/인증 연결·실제 테스트 왕복 검증이다. 전자책 키를 운영/테스트 구분 없이 복사하거나 사주의 테스트 보호 장치를 해제하지 않았다.

## 2026-10-22 관리자 로그인 완료와 무료 프로젝트 한도

Google 계정→GitHub의 기존2단계 인증→Supabase GitHub 로그인 경로로 관리자 접근을 완료했다. 로그인한 GitHub 계정은 wani3000이며 Supabase 조직의 기존 프로젝트는 mariecard-production, PlateLingo였다. 기존 계정의 인증수단/보안 설정은 변경하지 않았다. 인증번호·세션 값은 파일이나 문서에 저장하지 않았다.

사주 전용 새 프로젝트 화면은 계정의 활성 무료 프로젝트 한도2개 도달로 생성이 차단된다. 기존 프로젝트의 중지·삭제·플랜 변경·새 유료 구독은 실행하지 않았다. Supabase UI 및 [공식 가격](https://supabase.com/pricing)에서 Free는 활성2개, Pro는 월25달러부터와 첫 프로젝트 포함/추가 프로젝트 월10달러부터를 확인했다. 기존 조직을 그대로 업그레이드하면 프로젝트별 컴퓨팅 비용이 달라질 수 있으므로25달러를 조직 전체의 확정 총액으로 보지 않는다.

사용자에게 진행 방식을 요청했고 **다른 Supabase 계정으로 진행**을 선택했다. 이후 chulwan0123@gmail.com으로 관리자 로그인을 완료하고 아래 전용 프로젝트를 생성했다. 유료 가입은 수행하지 않았다. 카카오 개발자 앱·실제 OAuth/결제 왕복은 미완료다.


## 2026-10-22 새 계정의 서울 Free DB 연결 완료

사용자가 전용 `chunbae-staging` 무료·서울 프로젝트 생성, DB 비밀번호 자동 생성·Git 제외 로컬 보관·앱 연결을 승인했다. `chulwan0123@gmail.com` 계정에서 새 프로젝트를 생성했다. 다른 프로젝트는 변경하지 않았다.

| 항목 | 실제 확인 |
|---|---|
| 프로젝트 | chunbae-staging / nwicejxousubxiczwwkb |
| 조직 | yiyvrvpnpfryirbaelte |
| 플랜/리전 | Free / Seoul ap-northeast-2 / NANO, Healthy |
| Supabase URL | https://nwicejxousubxiczwwkb.supabase.co |
| DB 스키마 | 마이그레이션001~004 적용, 체크섬 일치,21테이블 모두 RLS |
| 앱 DB 계정 | 전용 saju_server 로그인 + saju_runtime 그룹; superuser/createdb/createrole/bypassrls 없음 |
| 앱 연결 | Supavisor transaction pooler6543, 제한 계정, verify-full TLS |
| 인증 Site URL | https://chunbae-staging.vercel.app |
| 인증 Redirect URL | https://chunbae-staging.vercel.app/auth/callback 하나만 등록 |
| 카카오 공급자 | 전용 앱1618169 및 공급자 활성화, 이메일 없이 로그인 허용. 최소 동의 화면 확인, 앱 서버 OAuth 복귀는 미검증 |
| Vercel 원격 앱 | 아직 미배포·원격 환경변수 미등록 |

관리자와 앱용 DB 비밀번호는 서로 다른 난수로 생성했다. 사용자 계정 로그인 비밀번호와 구분하며, 관리자 연결은 bootstrap 파일에만 두고 앱은 제한 계정을 사용한다. `web/.env.supabase-bootstrap.local`과 `web/.env.staging.local`은 Git 제외·권한600을 확인했다. 비밀값은 문서·검사 출력·커밋에 포함하지 않았다.

최초 엄격 TLS 검사는 CA 체인 확인 오류로 거절됐다. 검증을 끄지 않고 해당 프로젝트 Database Settings가 제공한 공식 공개 CA를 `web/certs`에 보존했다. CA 출처·체크섬·만료는 [인증서 기록](../web/certs/README.md)을 따른다. Next 서버 추적에 공개 CA와 SQL001~004가 포함된 것을 확인했다. 클라이언트 TLS의 encrypted/authorized가 모두 true다. Supavisor 뒤의 `pg_stat_ssl` 값은 내부 연결이므로 클라이언트 암호화 판정에 사용하지 않는다.

### 실제 원격 DB 검증

전용 대상을 명시하는 `npm run test:hosted-runtime -- --settings .env.staging.local --project nwicejxousubxiczwwkb`를 추가했다. 연구 모드·명시적 원격 테스트 허용·정확한 제한 계정과 Supabase 프로젝트·인증서 검증 URL이 아니면 실행하지 않는다. 앱 역할로 마이그레이션 체크섬/RLS·DDL 거절·auth.users 접근 거절을 확인했다. 합성 두 계정의 풀이 생성/저장·다른 소유자의 조회 거절·공유/철회·개인 기록 삭제를 하나의 트랜잭션에서 검사하고 전부 롤백했다. 계정 수 복원도 확인했다. 원격 DB 전체 복원이나 실제 이용자 OAuth/결제 테스트를 수행한 것은 아니다.

최신 오프라인 staging 검사의 누락은 `NICEPAY_CLIENT_KEY`, `NICEPAY_SECRET_KEY`의2개다. 이 검사는 외부에 연결하지 않으므로 DB 실검증 결과를 자동 인증하지 않는다. `SAJU_MODE=research`, 카카오 필수 모드와 sandbox 결제 제한은 유지한다. DB 연결 완료를 실제 카카오 로그인·실결제·서버 배포 완료로 표시하지 않는다.


검증: 웹152개, 일반 HTTP/모바일28개, 카카오 필수 HTTP/모바일2개, 타입 검사, Next 빌드, 소스 현황 일치, 문서 검사 통과. API 서버 추적에 CA와 마이그레이션4개 포함을 확인했다. 새 hosted-runtime 명령도 실제 제한 계정으로 통과했다. 서버 staging 배포와 실제 OAuth/결제 왕복은 이 검사에 포함되지 않는다.


## 2026-10-22 김춘배 훈장 카카오 앱·Supabase 공급자 연결

사용자가 직접 카카오 로그인을 완료하고 앱 생성·운영정책 준수 확인·인증 키의 Supabase 저장을 승인했다. 필수 상호명은 사용자가 지정한 **플로렌스랩**이다.

- 전용 앱 **김춘배 훈장**, 앱ID **1618169**, 카테고리 엔터테인먼트, 대표 도메인 `https://chunbae-staging.vercel.app`를 생성했다. 기존 전자책 등 다른 앱은 변경하지 않았다.
- 카카오 로그인 ON. `profile_nickname`, `profile_image`만 **선택 동의**로 저장했다. 이메일·전화번호·생일·성별·친구 목록·메시지 권한은 요청하지 않는다. 실제 카카오 동의 화면에서 상호/서비스명과 두 선택 항목을 확인했다. 사용자의 동의 제출은 하지 않았다.
- 자동 발급된 전용 REST 키를 `Chunbae Supabase Staging`으로 식별하고, 활성 상태의 카카오 로그인 Client Secret과 함께 Supabase `nwicejxousubxiczwwkb` Kakao 공급자에 저장했다. 키를 프로젝트 파일·Git·클라이언트 번들에 추가하지 않았다.
- Kakao REST 키의 로그인 Redirect URI는 `https://nwicejxousubxiczwwkb.supabase.co/auth/v1/callback` 하나다. 비즈니스 인증 Redirect URI는 비어 있다. Kakao 공급자 Enabled와 `Allow users without an email` 저장을 확인했다. Supabase 앱 복귀 허용 주소는 기존의 정확한 `https://chunbae-staging.vercel.app/auth/callback`을 유지한다.

### 실제 요청에서 발견한 이메일 범위 문제와 수정

Supabase의 이메일 선택 설정을 켜도 기본 authorize 응답에는 `account_email,profile_image,profile_nickname`이 포함됐다. [공식 구현](https://github.com/supabase/auth/blob/master/internal/api/provider/kakao.go)과 [이슈2574](https://github.com/supabase/auth/issues/2574)의 기본 이메일 범위 문제와 일치했다. SDK의 `scopes` 옵션은 기본 범위에 추가하므로 이 문제를 해결하지 못한다. 앱 서버가 `queryParams.scope=profile_nickname,profile_image`를 보내도록 수정했고, 실제 hosted authorize302의 최종 범위가 정확한 두 항목으로 제한되는 것을 검증했다. `Allow users without an email`만 켰다는 사실을 최소 권한 보장으로 간주하지 않는다.

- 새 SSR SDK 회귀 검사는 네트워크 없이 profile-only `scope`, 정확한 callback, PKCE challenge와 verifier 저장을 확인한다.
- `npm run test:kakao-provider -- --settings .env.staging.local --project nwicejxousubxiczwwkb`는 승인된 전용 연구 환경만 대상으로 실제 authorize 응답의 공급자/콜백/범위를 검사한다. 사용자 계정 동의·코드 교환·토큰·실제 프로필 값은 출력하지 않는다.
- 실제 Chrome에서도 카카오 동의 화면에 정상 진입했으며 닉네임과 사진만 선택 항목이었다. 검증용 미완료 동의 탭은 닫았다. 실제 앱 서버 세션을 발급한 것은 아니다.

현재 완료 범위는 **개발자 앱 생성·공급자 설정·최소 권한 요청과 동의 화면 진입**이다. 서버 staging은 아직 미배포다. 따라서 PKCE 코드 교환 후 앱 세션 생성, 재로그인·기기 변경, 사진 미동의/없음의 실제 계정 흐름·탈퇴/웹훅은 미완료로 유지한다. NICEPAY 테스트 키2개와 실제 결제·취소도 별도다. 기존 공개 정적 체험판에 실제 로그인을 붙였다고 표시하지 않는다.


연결 후 검증: 새 SSR SDK 회귀1개 포함 웹153개, 타입·Next 빌드, 일반 HTTP/모바일28개와 카카오 필수 HTTP/모바일2개, 소스 현황 일치·문서 검사를 통과했다. 전용 hosted authorize 최소 범위 검사도 통과했다. 새 스키마 변경은 없으며, 이전 원격 DB 검증을 이번 실제 OAuth 완료 근거로 재사용하지 않는다.

## 2026-10-22 서버 배포·실제 프로필 저장 검증 완료

사용자가 서버 배포와 실제 로그인부터 프로필 저장까지 요청했다. [현재 서버](https://chunbae-staging.vercel.app/)와 [배포/경계별 근거](server-staging-deployment.md)를 확인했다. 최초/재로그인·프로필 이름/사진 DB 저장·이미지 로딩·새로고침 유지·로그아웃 차단을 실제 브라우저에서 검증했다. 빈 방문 세션에도 합치기를 묻던 문제를 수정하고 소스0e1f844를 서울에 재배포하여 재검증했다. 웹155개·모바일30개·양 모드 HTTP·빌드/타입·원격 합성 DB 검사 통과. 원격 설정9개에 관리자 DB 자격/결제 키는 포함하지 않았다. 앞선 ‘서버 미배포/코드 교환 미검증’은 당시 단계 기록이며 현재는 이 후속 결과를 따른다. 실제 NICEPAY 거래·탈퇴/웹훅·다른 기기·운영 승인까지 완료한 것은 아니다.
