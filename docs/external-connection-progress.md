# 카카오·NICEPAY 실제 연동 착수

2026-10-22. 사용자가 실제 로그인/결제 연결을 요청하고 카카오 Developers의 사주 전용 앱을 직접 생성하도록 지시했다. 현재 로그인 인증 단계가 남아 있으며 연결 완료로 표시하지 않는다.

## 확인한 상태

- Chrome에서 Kakao Developers를 열었으나 계정 로그인 필요. 저장된 로그인으로 진입하지 못해 공식 카카오 QR 인증 화면을 열었다. **개발자 앱은 아직 생성되지 않았다.** 본인 인증 뒤 ‘김춘배 훈장’ 전용 앱 생성과 최소 프로필 동의·콜백 설정을 이어간다.
- Supabase Dashboard도 로그인 필요. GitHub 로그인을 시도했으나 GitHub 계정 입력 단계다. Supabase 연결 기능은 제안했지만 설치·인증 완료는 확인되지 않았다. 새 프로젝트/DB/역할/공급자는 생성되지 않았다.
- NICEPAY 관리자는 계정 입력 단계. 전자책 `Documents/Codex/2026-07-18/pc/website`의 코드와 과거 온보딩 기록에서 같은 결제사임을 재확인했다. 현재 사주용 테스트 키·운영 계약 완료·새 거래는 확인되지 않았으며 전자책 운영 키/DB를 복사하지 않았다.
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
