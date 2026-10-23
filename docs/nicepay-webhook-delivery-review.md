# NICEPAY 테스트 거래 웹훅 후속 검증

2026-10-23. 이전 [실제 앱 왕복](hosted-app-ui-verification.md)은 승인/취소와 결과·프로필을 검증했고 거래 통보 이벤트는0개였다. 이번 작업은 그 별도 통보 경로를 확인한다. [비식별 진행 근거](audits/nicepay-webhook-delivery.json)는 실제 거래 수신 성공과 등록 샘플을 구분한다.

## 확인된 등록 누락과 수정

조회 가능한 Vercel 최근2시간 로그에 실제 앱 return303·취소200 등은 있었으나 웹훅 요청은 없었다. 제한 DB 조회에서도 해당 취소 주문 및 전체 NICEPAY 거래 이벤트는0개였다. 로그 보존/조회 범위 밖의 미수신까지 단정하는 증거는 아니다.

[공식 웹훅 조회 명세](https://github.com/nicepayments/nicepay-manual/blob/main/api/webhook/webhook-retrieve.md)에 따라 앱의 S2 키로 sandbox-api의 GET /v1/webhook을 호출하니 HTTP200·U111(조회내용 없음)·빈 urls가 반환됐다. 과거 관리자 등록/TEST 성공 기록과 현재 API 조회가 달랐다. 어느 계층/키 연결에서 차이가 생겼는지는 관리자 로그 대조 전이라 단정하지 않는다.

기존에 사용자가 승인한 동일 URL과 card 수단으로 sandbox-api의 POST /v1/webhook을 실행했다. [공식 등록 명세](https://github.com/nicepayments/nicepay-manual/blob/main/api/webhook/webhook-create.md)에 따른 요청은 HTTP200·0000이었고, GET 재조회도0000·card 주소 일치를 확인했다. 이어 Vercel에 해당 경로 POST200 한 건이 나타났다. 이는 NICEPAY 등록 확인 샘플 도착이며 실제 주문의 서명/상태 대사 증거가 아니다. 운영 키/상점이나 전자책 코드는 변경하지 않았다.

## 재발 점검 도구

web에서 다음을 실행한다.

```sh
npm run check:nicepay-webhook -- --settings .env.staging.local
```

이 명령은 고정된 사주 전용 staging/research/remote-test opt-in/S2 sandbox 설정만 허용한다. 등록 조회 GET만 실행하며 주소 생성·수정·삭제·결제·DB 호출을 하지 않는다. 외부/중복 card 주소와 빈 등록은 종료2, 확인 실패도 성공으로 만들지 않는다. 다른 서비스 URL·관리자 이메일·키·공급자 오류 원문은 출력하지 않고, 등록 성공에도 transactionDeliveryVerified=false를 유지한다. 오프라인 staging 사전 검사의 무외부호출 약속은 바꾸지 않았다.

## 실제 거래 재전송 대기

기존 주문은 refunded이고 이벤트0개다. 관리자 세션이 만료되어 Chrome 로그인 창을 인계했다. 로그인 뒤 다니엘의 노트 테스트에서 기존 사주 주문의 승인/취소 웹훅 발송 로그·실패 코드·재전송 가능 여부를 확인한다. 실제 NICEPAY에서 재전송한 알림을 받고 DB 이벤트 및 현재 상태가 대조되어야 거래 수신 검증을 완료한다. 임의로 서명한 알림을 보내 이 근거를 대신하지 않는다. 새 카드 인증이 필요하면 별도 실제 테스트 흐름으로 구분한다.

공식 원문 명세와 Wiki의 일부 서명/샘플 설명이 서로 다르므로, 실제 거래 전문/공급자 근거 없이 서명 예외를 늘리지 않았다. [공식 웹훅 명세](https://github.com/nicepayments/nicepay-manual/blob/main/api/hook.md)와 [관리자 재전송 절차](https://github.com/nicepayments/nicepay-manual/blob/main/management/admin.md)를 따른다. 키·주문/TID·인증·구매자 원문은 Git에 남기지 않는다.

## 실행 검증

신규4개를 포함한 단위/서비스169개, 타입 검사, Next16.4.2 빌드, 별도 NICEPAY HTTP와 합성 SDK 모바일4개, 소스 현황/문서 검사 통과. 실제 설정의 읽기 전용 등록 명령은 registered/종료0이며 transactionDeliveryVerified=false다. 앱 수신 런타임 코드는 바꾸지 않아 추가 서버 배포는 하지 않았다. 원격 변경은 이미 승인된 sandbox의 동일 card 웹훅 주소 등록이며 운영 상점/키 변경은 없다.
