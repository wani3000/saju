# 카카오 로그인·프로필·이용 내역 검수

2026-10-22. 사용자 요청으로 입력 전 카카오 로그인, 헤더 프로필 이미지와 사주 조회/결제 내역을 추가했다. 공개 정적 체험판과 서버 인증 앱의 범위를 구분한다. 실서비스 인증 완료·회원 탈퇴 완료·운영 출시 승인을 뜻하지 않는다.

## 반영한 동작

- 헤더 오른쪽 ‘보관함’을 원형 프로필로 변경. 프로필 사진이 없거나 불러오지 못하면 SEED `IconPersonCircleLine`을 표시한다. 버튼 이름은 스크린리더에도 ‘내 프로필’이다.
- 서버 앱은 기본 `kakao-required`. 로그인 전 생일 입력/저장·결과 생성/조회·지도·주문·복구 코드 사용을 차단한다. 상태 응답도 초안·프로필·개인 기록을 비운다. 로컬 데모는 `SAJU_AUTH_MODE=local-demo`를 명시해야 하며 원격 API에서는 거절한다. 원격 staging 검사 역시 이를 거절한다.
- 임시 Supabase 인증/코드 검증 쿠키는 전용 이름을 사용하고 콜백 성공·실패 및 공급자 로그아웃 오류 때도 명시적으로 지운다. 앱에는 서버 세션만 남긴다.
- PKCE 교환 뒤 서버 `getUser()`가 확인한 UUID와 `kakao` identity가 있어야 계정을 연결한다. 닉네임·이미지는 표시 정보이며 권한 증명이 아니다. 요청 본문의 subject/authenticated 값이나 URL의 `auth=complete`는 로그인 성공으로 인정하지 않는다.
- `004_kakao_profile.sql`에서 표시 이름·이미지와 로그인 검증을 받은 세션의 식별자를 추가. 기존 회원·복구 코드로 얻은 세션은 카카오 로그인 세션으로 자동 승격하지 않는다. 이전 데이터 마이그레이션 후 재로그인이 필요하다.
- 프로필에는 두 탭: ‘사주 조회 내역’은 상대 이름/관계/시각/준비 상태와 재열람, ‘결제 내역’은 시각/상대/금액/테스트 승인·확인 중·취소 상태를 제공한다. 무료 결과도 조회 내역에 포함하며 결제로 표시하지 않는다. 취소 기록은 남기되 재열람 권한은 제거한다.
- 모든 내역은 세션 소유 계정으로 조회한다. 결제 키·전체 입력은 내역 요약에 담지 않는다. 기존 결과 스냅샷·무료권·소유권·중복 방지 정책은 유지한다.
- 계정 충돌 때 명시적으로 합치기/전환을 선택한다. 출생 기준 충돌·진행 중 작업은 기존 보호를 유지한다. 새 로그인 때 표시 정보를 갱신한다. 삭제 때 이름·사진을 지운다.
- 이미지 URL은 허용된 카카오 CDN 호스트의 HTTP(S)만 받아 HTTPS로 표시한다. 자격 정보·임의 호스트·data/javascript URL은 거절하고 Referrer를 보내지 않는다.
- 공식 카카오 로그인 버튼 SVG를 내용·비율 그대로 사용하며 출처 고지를 배포한다.

## 공식 설정과 현재 남은 항목

[Supabase 공식 Kakao 가이드](https://supabase.com/docs/guides/auth/social-login/auth-kakao)에 따라 다음 두 redirect를 혼동하지 않는다.

1. Kakao Developers의 Redirect URI: 해당 Supabase 프로젝트의 `/auth/v1/callback`.
2. Supabase Redirect URLs: 정확한 `APP_ORIGIN/auth/callback`.
3. Kakao REST API 키/활성화한 Client Secret은 Supabase 공급자 설정에 입력한다. 앱 서버에는 프로젝트 URL/publishable key를 설정한다. 키를 채팅·Git·배포 정적 번들에 넣지 않는다.
4. 닉네임/프로필 사진만 필요한 동의 범위로 검토한다. 이메일은 계정 키로 쓰지 않으며 이 기능에 필수가 아니다. 이메일을 요청하지 않으면 Supabase의 ‘Allow users without an email’ 설정도 확인해야 한다. 실제 동의 화면/사진 미동의/사진 없음은 프로젝트 준비 뒤 검증한다.

[카카오 공식 로그인 절차](https://developers.kakao.com/docs/ko/kakaologin/common)는 서비스 로그아웃·카카오 연결 해제·회원 탈퇴를 구분한다. **현재 로그아웃은 이 앱 세션 종료이며, 내 정보 삭제는 앱 기록 삭제다. 카카오 unlink/Supabase 사용자 삭제는 구현·실검증되지 않았다.** 삭제된 식별자를 보존하는 기존 개발 정책도 정식 탈퇴 정책 승인이 아니다. 운영 전 식별자 파기/필수 보존 동의·연결 해제 API·외부 탈퇴 웹훅·세션 철회·재가입/무료권 정책을 함께 확정해야 한다. 이 항목을 완료로 체크하지 않는다.

후속 실제 앱/공급자 설정과 최소 동의 화면 확인은 [연결 기록](external-connection-progress.md)의 최신 항목을 따른다. 아직 앱 서버 OAuth 왕복은 미실행이다. 서버 배포 후 로그인 성공/취소·쿠키 및 HTTPS·코드 재사용/만료·기기 변경·프로필 변경/미동의·다른 계정 전환·로그아웃/탈퇴 및 웹훅을 검증한다. 모바일 카카오 인앱/외부 브라우저도 실제 기기로 확인해야 한다. [버튼 규정](https://developers.kakao.com/docs/ko/kakaologin/design-guide)과 [공식 리소스](https://developers.kakao.com/tool/resource/login)를 대조했다.

## 체험판과 검증

공개 정적 체험판은 실제 로그인/결제를 연결하지 않는다. 우측 프로필에서 조회·모의 결제 내역과 ‘로그인 없이 체험하기’를 확인할 수 있으며 실제 로그인 버튼은 준비 중이다. 가짜 카카오 로그인 계정이나 임의 프로필 사진을 만들지 않는다.

검증 명령:

```sh
npm test --prefix web
npm run build --prefix web
npm run typecheck --prefix web
npm run test:journey --prefix web
npm run test:kakao --prefix web
npm run test:postgres --prefix web
npm run build:preview --prefix web
npm run release:inventory --prefix web
python3 tools/check_docs.py
```

합성 DB 검사는 회원/복구/타 계정/만료 세션의 로그인 우회 차단, 공급자 검사, 표시 정보 정리, 삭제, 환불 이력·열람 철회·소유권을 포함한다. 별도 카카오 필수 모드 HTTP·모바일 검사는 미로그인 생일/내역 진입 차단과 구성 미완료 안내를 확인한다. 일반 로컬 데모 여정은 입력·결과·지도·공유·복구와 프로필 조회를 검증한다. 어느 검사도 실제 OAuth 왕복/실결제·법률 검토·전문가 승인을 대체하지 않는다.

최종 자동 검사: 웹146개, 기존 로컬 모바일28개와 별도 카카오 필수 모바일2개, 양 모드 HTTP, 타입/Next·정적 빌드 통과. 로컬 PostgreSQL21테이블 복원에서 새 프로필·카카오 세션 표식과 복구 세션의 차이도 확인했다. [체험판 프로필390px](../web/qa-evidence/chunbae-profile-history-390.jpg). 공개 배포 상태는 [배포 기록](temporary-preview-deployment.md)에서 별도로 확인한다.


2026-10-22 실제 설정 후속: 전용 앱1618169/플로렌스랩·두 프로필 선택 동의·활성 Client Secret·Supabase 이메일 없는 계정 허용을 저장했다. 기본 요청에 이메일이 추가되는 문제를 실재현하고 서버 `queryParams.scope`로 제한했다. 신규 SSR SDK 회귀 검사와 실제 hosted authorize 검사를 통과했으며, 브라우저 동의 화면도 두 선택 항목만 확인했다. 코드 교환/앱 세션과 실제 이용자 탈퇴 검증은 포함하지 않는다.
