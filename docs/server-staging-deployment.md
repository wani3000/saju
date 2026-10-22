# 서버 스테이징 배포와 실제 카카오 프로필 검증

2026-10-22. 사용자가 서버 배포·실제 카카오 로그인부터 프로필 저장까지의 검증과 문제 수정을 요청했다. 기존 정적 체험판과 다른 서버 대상이다.

## 현재 테스트 주소와 배포

- 테스트: https://chunbae-staging.vercel.app/
- Vercel 프로젝트: `chunbae-staging` / `prj_g8ciaxVhxmH3PIunfoqeN9z4jhHJ`.
- 팀: `oxaz1234-gmailcoms-projects` / `team_R8P4DPGCTnvB9cBXk2YA9Y0u`.
- 앱 소스: `6f1da26`. 최종 배포 `dpl_CYzwZMp1Hs3SaNRD4PQr6ReJW4gY`, Ready·alias 일치 확인.
- 고정 배포 URL: https://chunbae-staging-bon6byvi6-oxaz1234-gmailcoms-projects.vercel.app/
- Node22.x·Next16.4.0, 실행 함수 리전 `icn1`(서울). 빌드 로그의 `iad1`은 업로드된 산출물 배포 작업 위치이며 실행 함수 리전과 구분한다.
- 저장소의 연구 엔진을 포함해 로컬 `vercel build --prod` 후 `--prebuilt --prod --regions icn1`로 전용 프로젝트에 배포했다. 이 프로젝트의 production target은 안정된 스테이징 alias를 위한 호스팅 구분이다. 앱의 연구 모드나 운영 출시 승인을 바꾸지 않는다.

첫 서버 배포 `dpl_CJKtUGfjiwqdBTcL3EjZhaK6zpaQ` / 소스 `9b02143`에서 실제 최초 로그인을 확인했다. 아래 재로그인 불편을 수정한 `0e1f844` / `dpl_EVNv3APFZ9a9ARRbSCH2AunidsVX`에서 재로그인을 다시 검증했다. 후속 `7df465e`는 공유 테스트 상점 웹훅 보완이며 기존 프로필의 새로고침 유지와 익명/오류 응답을 확인했다. SQL 스키마 변경은 없다.

## 최초 설정과 접근 범위

전용 프로젝트의 production target에 `SAJU_MODE=research`, `SAJU_AUTH_MODE=kakao-required`, `APP_ORIGIN`, `ALLOW_REMOTE_TEST=true`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `PAYMENT_PROVIDER=nicepay-test`, `NICEPAY_MODE=sandbox`의9개만 등록했다. DB URL은 sensitive 타입·제한 `saju_server` 계정이며 bootstrap 관리자 자격을 올리지 않았다. 로컬 비밀/호스팅 설정은 Git 제외·권한600으로 유지한다. 실제 함수의 filePathMap에서 공개 CA와 마이그레이션001~004 포함을 확인했다.

이번 사용자 요청은 인증 검증용 서버 배포다. 전체 결제 staging 사전 검사는 NICEPAY 키2개 누락으로 여전히 blocked다. 가짜 키를 넣거나 해당 검사를 전체 통과로 표시하지 않았으며, sandbox/Server 승인 키 보호 장치를 유지한다. NICEPAY 키·운영 키·전자책 키는 등록하지 않았고 거래도 실행하지 않았다.

프로젝트의 기존 Vercel 보호 설정은 변경하지 않았다. 실제 canonical alias는 Vercel 로그인 없이 앱 진입 HTTP200이며, 개인 API는 앱의 카카오 세션을 요구한다. 토큰 없는 이 주소를 전달한다. 불필요하게 생성한 임시 alias shareable-link는 폐기했고 최종 활성 공유 bypass0개를 확인했다. 호스팅 초대자 제한이나 모든 출시 조건을 통과했다고 표시하지 않는다.

## 실제 검증한 흐름

| 경계 | 실제 확인 |
|---|---|
| 화면 → 서버 | 초기 방문 세션 생성·카카오 로그인 버튼·로그인 전 입력/내역 차단 |
| 서버 → Supabase → Kakao | PKCE 로그인 시작, 등록한 두 callback, 닉네임/사진만 선택 동의 |
| Kakao → Supabase → 서버 | 실제 동의 제출 후 code 교환/getUser 검증, 앱으로 정상 복귀 |
| 서버 → DB | `auth_identities`에 닉네임·사진 저장, identity와 연결된 유효 앱 세션 확인 |
| DB → 화면 | 프로필 닉네임과 카카오 CDN 사진2곳 정상 로딩, no-referrer |
| 새로고침 | 같은 프로필과 로그인 유지 |
| 로그아웃 | 프로필과 개인 내역이 사라지고 카카오 로그인 진입만 표시 |
| 재로그인 | 동일 계정·프로필 복원, 빈 방문 세션에 합치기 질문 없음 |

최초 로그인과 수정 후 재로그인 모두 활성 연결 계정1개·닉네임 저장1개·사진 저장1개·유효 로그인 계정1개를 DB 집계로 확인했다. 실제 사용자 UUID·이메일·사진 URL·세션·코드·인증번호는 이 문서에 기록하지 않는다. 실제 생일 입력이나 유료 거래는 하지 않았다. 사용자가 요청한 프로필은 서버에 보존했다.

익명 별도 HTTP 검사에서 Secure/HttpOnly/SameSite=Lax 세션 쿠키, no-store, 로그인 전 profile=null, 개인 결과 요청401/KAKAO_LOGIN_REQUIRED, 다른 Origin 요청403을 확인했다. 이 검사는 실제 사용자 브라우저 쿠키를 추출하지 않고 별도 익명 세션으로 수행했다.

## 발견한 문제와 수정

첫 재로그인은 기존 identity를 발견하면 빈 방문 세션에도 무조건 합치기/전환을 물었다. 신규 방문자의 `guest` 상태·복구 정보 없음·초안/비교/주문/다른 identity 없음·무료권 available/generation0/비교 없음이 모두 확인되면 기존 검증 계정으로 바로 연결한다. 데이터를 옮기거나 대상 무료권을 갱신하지 않는다. 기록·복구·무료 이용 이력이 있으면 기존 명시적 검토를 유지한다. 시도 만료/일회성·삭제 계정·다른 identity·소유권 검사를 유지한다.

단위 회귀는 대상의 이미 소비한 무료권과 저장 결과가 그대로이고, 원래 guest 세션만으로는 로그인이나 결과 조회가 되지 않으며, 초안/복구/무료권 이력이 있으면 검토가 필요함을 확인한다. 실제 원격 DB의 합성 returning-account 검사도 전체 롤백으로 통과했다. 실제 브라우저에서도 수정 후 곧바로 원래 계정으로 복귀했다. 로그인 연결이 된 뒤에도 준비 중이라고 읽히던 연구 안내 문구는 현재 범위에 맞게 고쳤다.

## 검증과 남은 범위

- 웹155개·타입·Next/Vercel prebuilt 빌드 통과.
- 일반 HTTP/모바일28개와 카카오 필수 HTTP/모바일2개 통과.
- 실제 원격 제한 DB의 마이그레이션/RLS/권한·결과/공유/삭제·재로그인 합성 검사 통과, 검증 데이터 전부 롤백.
- 소스 현황 일치·문서 검사 통과. 위 실제 브라우저/DB 검증은 합성 검사와 구분한다.

NICEPAY 결제/취소·실제 다른 기기/카카오 인앱 브라우저·프로필 미동의의 실계정 흐름·연결 해제/탈퇴와 외부 웹훅·호스팅 백업 복원·운영 감시·전문가/출시 승인은 별도 미완료다. 기존 정적 체험판은 이번 서버 배포로 대체하거나 재배포하지 않았다.

후속: [실제 앱 DB 백업의 격리 로컬 복원](hosted-backup-restore-check.md)은21테이블 데이터/스키마/권한 대조를 통과했다. 호스팅 전체 재해 복구·인증 공급자/스토리지 복원·장기 보관·지속 감시는 구분하여 미완료로 유지한다. 해당 백업 도구 작업은 배포를 변경하지 않았다.

## 2026-10-22 공유 테스트 상점 웹훅 보완 배포

[기존 NICEPAY 테스트 상점 검수](nicepay-shared-sandbox-review.md)의 다른 서비스 주문 무시·위조 거절·현재 상태 대사·503 재시도 보완을 소스7df465e로 재배포했다. 웹161개·HTTP/모바일28개·Next/Vercel 빌드·소스 현황/문서 검사 통과. 실제 배포는 READY·서울icn1·canonical alias 일치를 확인했다. 익명 랜딩200/no-store, 개인 state401/no-store, 잘못된 JSON 웹훅400/no-store를 확인했다. 실제 브라우저에서 기존 카카오 프로필의 새로고침 유지도 확인했다. 기존 로그인 왕복 검증과 이번 유지 확인은 구분한다.

테스트 키2개 저장과 웹훅 등록은 사용자 확인 대기 상태다. 서버 설정은 기존9개이며 키를 넣거나 NICEPAY API를 호출하지 않았다. 실제 결제 승인·취소·외부 웹훅 통보 검증으로 표시하지 않는다.


## 2026-10-22 실제 S2 키 연결 후 배포

기존 테스트 키2개를 사용자 승인 후 sensitive 환경에 추가해 서버 설정은11개이며 staging 사전 검사 누락0개다. 관리자 DB 자격이나 운영 R키는 배포하지 않았다. 실제 현대카드 인증에서 드러난 최초 승인 전 조회 오류와 웹훅 등록 샘플 처리를 수정했다. NICEPAY에 신용카드 웹훅을 저장하고 관리자 TEST호출 성공을 확인했다. [실제 승인/전액 취소와 재검증 범위](nicepay-shared-sandbox-review.md)를 따르며 research mode·실과금 차단은 유지한다. 아래 후속 배포 기록을 현재 기준으로 읽는다.


최종 앱 소스6f1da26를 `dpl_CYzwZMp1Hs3SaNRD4PQr6ReJW4gY`로 배포했다. READY·프로젝트 일치·서울icn1·canonical alias의 같은 deployment ID를 Vercel API로 확인했다. 익명 랜딩200, 개인 API401, 잘못된 JSON400, 형식 유효 비UUID 샘플200/OK, 위조 UUID400을 원격 확인했다. 임시 구조 진단 코드는 최종 산출물에서 제거했다. 자동 hosted return 재검증은 현대카드 앱 인증 대기이며 실제 청구는 차단한다.
