# 김춘배 훈장 랜딩 개편 · 2026-10-23

사용자가 승인한 ‘서당의 초대장 + 실제 결과 미리보기’를 기존 Next 앱에 적용했다. 조선 기록 사진풍2안의 독립 사진·한지·붉은 인장·자체 호스팅 서체를 재사용한다. 외부 레퍼런스의 얼굴·이미지·코드는 복제하지 않았다.

## 구성

서비스 설명 → 인장 바로 아래 훈장 소개 → 개인 성격 예시 → 연인/친구/가족/동료별 도움·대화·실천 예시 → 이용 방법 → FAQ 순서다. 하단 고정 두 버튼·상하20px 여백·안전 영역·그라데이션, 오른쪽 위 프로필을 유지한다. 로그인/새 입력/저장 입력의 기존 버튼 분기도 유지한다. 예시의 관계 선택은 랜딩 안에서만 동작하며 저장된 관계를 바꾸지 않는다. 동의 칸·가상 입력 채우기·무료 체험 홍보 블록·입력 단계 탭은 추가하지 않았다.

데스크톱은 최대1120px에서 사진과 설명을 좌우 배치한다. 모바일은 세로 배치이며 짧은 화면에서는 사진을 줄여 제목과 설명이 버튼/그라데이션 위에 남도록 했다. dock 높이는 기존 ResizeObserver로 측정한다. 본문 끝의 예약 공간만 늘려 첫 화면 가림을 해결했다고 간주하지 않는다.

## 예시의 출처

[정적 예시](../web/content/landing-sample.json)는 [생성 스크립트](../web/scripts/prepare-landing-sample.ts)가 공개 합성 fixture의 양력1990-03-12와1992-05-21, 시간 모름을 현재v8에 넣어 발췌한다. 표시 이름은 보라·도하이며 실제 회원/조회 결과를 읽지 않는다. 개인 성격과 대화는 같은 상관/편인 문장을 사용한다. 도움·함께할 일은 네 관계의 실제 본문에서 각각 발췌한다. 이름 치환 외에 별도 성격/관계 판정을 추가하지 않는다.

런타임은 JSON만 읽으며 계산 엔진·서버 모듈을 클라이언트에 추가하지 않는다. 예시라고 명시하고 점수·성공 확률·가짜 후기/이용자 수를 만들지 않는다. 재생성 명령은 web 디렉터리에서 `npx tsx scripts/prepare-landing-sample.ts`다. 현재 풀이와 정적 발췌의 일치·관계별 차이·불필요한 식별 필드 부재를 자동 검사한다.

## 참고 범위

[Kombai](https://kombai.com/gallery/web/)는 가치 설명/결과/FAQ의 정보 순서, [Inspo](https://inspomcp.dev/)·[A1](https://www.a1.gallery/)은 사진·명조·여백의 편집 방향에 참고했다. [Taste](https://buildwithtaste.com/)는 기존 취향 유지, [Screenshots](https://github.com/joesteinkamp/screenshots-design-inspiration)·[Gummble](https://gummble.com/)은 로그인/결제/내역의 후속 비교용이다. [Collect UI](https://collectui.com/)의 과거 화면별 분류는 확인하지 못했다. 계정/MCP 연결·유료 구독·타사 자산 복제는 하지 않았다.

## 검증

- 단위/서비스174개 통과.1개는 공개 발췌의 현재v8 일치/비식별/개인·대화 연결 검사다.
- 일반 HTTP 및 브라우저30개 통과.320×568·375×667·390×844·768×700·1280×720·1440×900에서 가로 넘침 없음, 제목/설명이 dock보다40px 이상 위에 위치함을 검사했다. 기존 입력의 글자2배·저장/공유/철회·소유권/프로필 회귀도 포함한다.
- 카카오 필수 HTTP/모바일2개, NICEPAY HTTP/합성SDK 모바일4개 통과. 실제 외부 OAuth/카드 결제를 이번에 다시 실행했다는 뜻은 아니다.
- 타입·Next/Vercel 빌드·정적 체험판 빌드·소스 현황 일치·문서 검사 통과. CUA로 실제390×844 첫 화면과 링크 이동/내용을 확인했다.

계산·풀이 규칙/이전 스냅샷·인증·결제·DB 스키마는 바꾸지 않았다. 실제 거래 웹훅·출시 감수 등은 [현재 출시 현황](launch-status-current.md)을 따른다. 이번 배포도 기존 연구용 staging만 갱신한다.

## 재배포와 원격 확인

- 앱 소스 [9a0a02d](https://github.com/wani3000/saju/commit/9a0a02d0f8f6f28998595c4c40e1fa8b8af8adeb)를 기존 chunbae-staging에 prebuilt 배포했다. 배포ID는 `dpl_7NHNeiVrRvXjKSQW3WBybuB69fQd`, 고정 URL은 https://chunbae-staging-7z8o3jq3p-oxaz1234-gmailcoms-projects.vercel.app 이다.
- READY·전용 프로젝트·함수 서울icn1 확인 후 stage 페이지 JS의 로컬/원격 SHA-256 일치를 확인하고 같은 production 산출물을 promote했다. https://chunbae-staging.vercel.app 의 동일 배포ID를 재확인했다. production은 이 테스트 프로젝트의 alias 구분이며 앱의 정식 운영 출시는 아니다.
- 일반 익명 HTTP에서 랜딩200/no-store·개인 state401/no-store. IAB의 비로그인 화면에서 네 관계 선택, 활성 카카오 로그인 진입, 지도→로그인 차단, 뒤로가기 확인. 새 회원/주문/결과를 만들지 않았다.
- CUA에서 실제390×844·1280×720의 공개 배포 화면 확인. 데스크톱 설명 끝365.26px, dock 시작529px로 가림이 없다. [모바일](../web/qa-evidence/landing-2026-10-23/hosted-mobile-390.png)·[데스크톱](../web/qa-evidence/landing-2026-10-23/hosted-desktop-1280.png)·[친구 예시](../web/qa-evidence/landing-2026-10-23/hosted-friend-example.png)를 저장했다. 임시 viewport 설정은 초기화했다.
- 기존 카카오 세션이 있는 Chrome의 새 탭에서 ‘저장한 입력 이어가기’·프로필/사주 조회 내역·저장 입력 복원 확인. 개인정보를 캡처/문서화하지 않고 생일/주문/무료권을 수정하지 않았다. 이번 작업에서 OAuth 재로그인/카드 인증·새 결제·외부 웹훅 재검증은 실행하지 않았다.
- 앱 소스의 GitHub CI3개가 성공했다: Web39887870521·Research39887870502·Prototype39887870520. 배포 후10분 범위 error 로그 조회는 해당 조건 로그 없음으로 응답했다. 지속 감시나 오류가 절대 없다는 보증은 아니다.
- 별도 정적 체험판 프로젝트는 빌드 호환만 검사했고 재배포하지 않았다. 이번 테스트 링크는 서버 앱의 동일 canonical 주소다.
