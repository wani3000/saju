# 카카오·NICEPAY 실제 연동 착수

2026-10-22. 사용자가 실제 로그인/결제 연결을 요청하고 카카오 Developers의 사주 전용 앱을 직접 생성하도록 지시했다. 현재 로그인 인증 단계가 남아 있으며 연결 완료로 표시하지 않는다.

## 확인한 상태

- Chrome에서 Kakao Developers를 열었으나 계정 로그인 필요. 저장된 로그인으로 진입하지 못해 공식 카카오 QR 인증 화면을 열었다. **개발자 앱은 아직 생성되지 않았다.** 본인 인증 뒤 ‘김춘배 훈장’ 전용 앱 생성과 최소 프로필 동의·콜백 설정을 이어간다.
- Supabase Dashboard도 로그인 필요. GitHub 로그인을 시도했으나 GitHub 계정 입력 단계다. Supabase 연결 기능은 제안했지만 설치·인증 완료는 확인되지 않았다. 새 프로젝트/DB/역할/공급자는 생성되지 않았다.
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
| 앱 배포 | 미실행 |
| 원격 환경변수 | 조회 당시 없음 |
| 연결 | web/.vercel에 전용 프로젝트로 연결, Git 제외 |

도메인 소유/등록은 실제 앱 서비스 응답이나 OAuth 성공 증거가 아니다. 비밀값 없는 로컬 설정에 이 origin을 기록했고, DB·인증·PG 값은 비어 있다. 원격 서비스 호출·공급자 키 등록·스키마 적용·서버 배포는 로그인과 설정 확인 이후 진행한다. 사주 전용 DB와 runtime 역할을 사용하고 기존 프로젝트의 데이터에는 마이그레이션하지 않는다. 서버 배포는 연구 엔진 생성과 SQL 파일 포함을 확인한 로컬 prebuilt 경로 또는 저장소 전체 빌드 경로를 사용해야 한다. web 폴더만 원격 업로드하면 상위 연구 엔진 복원 경로가 빠질 수 있다.

## 연결 과정에서 수정한 문제

1. `staging.env.example`에 로그인 필수 모드가 빠져 있었다. `SAJU_AUTH_MODE=kakao-required`를 추가하고 비밀값을 입력하지 않는 템플릿 회귀 검사를 추가했다. 기존 로컬 비밀 설정은 값을 출력하지 않고 누락된 모드만 보완했다.
2. 외부 DB 시작 검사가003까지만 확인해004 프로필 변경이 빠져도 통과할 수 있었다. 모든 배포 마이그레이션의 적용 여부와 체크섬을 읽기 전용으로 확인한다. 누락/변경이면 서버 시작을 거절하며 runtime 자격으로 스키마를 자동 수정하지 않는다.

웹150개·Next 빌드·타입·로컬 PostgreSQL21테이블 복원 통과. 새4개 검사는 최신 프로필 마이그레이션 누락/원장 변조/미초기화 DB 거절과 템플릿 누락을 확인한다. 제한된 runtime 역할 및 복원 DB에서도 원장 읽기 검사를 통과했다. 빌드의 API 추적 파일에 SQL001~004 포함을 확인했다. 현재 로컬 설정 검사는 예상대로 차단되며 누락은 Supabase URL/publishable key·DB URL·NICEPAY 테스트 client/secret의5개다. 이는 외부 연결 성공/실결제 검증이 아니다.

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
