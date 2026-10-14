# 서버 API와 작업 처리 계약

2026-10-14 구현 상태: [서버 연결 앱](../web/README.md)과 [완료/미완료 대조](server-app-status.md)를 먼저 확인한다. 아래 상세 설계에는 운영 전 예정 항목도 포함된다.

## 공통 규칙

아래 경로는 제안 계약이다. 구현 시 타입/스키마를 함께 정의한다. 모든 비공개 요청은 검증된 세션에서 소유자를 얻는다. 오류 응답에는 `code`, 사용자가 이해할 `message`, 추적용 `requestId`, `retryable`을 포함한다. 날짜·결제키·전체 공급자 응답을 오류 메시지에 노출하지 않는다.

| 메서드와 경로 | 역할 | 핵심 조건 |
|---|---|---|
| POST /api/session/guest | 익명 체험 시작 | 속도 제한, 기존 세션 재사용 |
| POST /api/persons | 내/상대 프로필 저장 | owner는 서버에서, 날짜 검증 |
| PATCH /api/persons/:id | 별명·관계 수정 | 출생 변경은 별도 버전 생성 |
| POST /api/persons/:id/birth-versions | 출생 정보 버전 생성 | 기존 구매 결과 불변 |
| POST /api/comparisons/quote | 비교 가능 여부·가격 조회 | 기존 결과·무료권·지원 범위 판단 |
| POST /api/comparisons | 고정 입력 비교 생성 | Idempotency-Key, release 버전 고정 |
| POST /api/comparisons/:id/free | 첫 무료 예약·작업 등록 | 원자적 무료권 검사 |
| POST /api/orders | 유료 주문 생성 | 영구 계정, 금액 서버 결정 |
| POST /api/payments/confirm | 공급자 승인 확인 | 주문 소유권·가격·상태 검증 |
| POST /api/payments/webhook | 공급자 이벤트 수신 | 공급자 인증/조회 검증, 이벤트 중복 제거 |
| GET /api/comparisons/:id/status | 상태 조회 | 자기 요청만 조회 |
| GET /api/results/:id | 결과 조회 | 자기 active entitlement 확인 |
| GET /api/map | 관계 지도 DTO | 소유자 본인, 접근 가능한 결과만 |
| POST /api/results/:id/shares | 미리보기 승인 후 링크 발급 | 공개 필드 whitelist, 만료 |
| DELETE /api/shares/:id | 공유 철회 | 소유자만, 캐시 무효화 |
| GET /s/:token | 공유 결과 공개 보기 | 토큰 유효·만료·철회·권한 확인 |
| GET /api/orders | 결제 내역 | 자기 내역만 |
| POST /api/refund-requests | 환불 요청 접수 | 직접 상태 변경 아님 |

## 비교 입력 예시

```json
{
  "selfBirthVersionId": "uuid",
  "partnerBirthVersionId": "uuid",
  "relationshipType": "friend"
}
```

가격, 무료 여부, 점수, engine_version 선택 권한은 클라이언트에 주지 않는다. 서버가 현재 승인 release와 사용자 권한을 적용한다. quote는 안내이고 무료권/가격 최종 권한은 실제 트랜잭션에서 다시 확인한다.

## 상태

comparison: `draft → awaiting_payment 또는 queued → processing → ready / failed`.

주문 결제가 성공해도 비교가 ready일 필요는 없다. 결과 페이지는 ‘결제 완료, 결과 준비 중’을 표시한다. 실패하면 같은 구매 권한으로 다시 생성한다.

권장 응답: 즉시 완료는 200, 생성은 201, 비동기는 202와 status URL, 입력 오류 422, 인증 401, 권한 403/리소스 숨김 404, 상태 충돌 409, 속도 제한 429, 일시 서버 오류 503.

## 작업 실행

1. 무료 예약 또는 유료 이용권 생성과 job 등록을 한 DB 트랜잭션으로 commit.
2. worker가 실행 가능한 job을 잠그고 lease와 새 fencing_token을 발급받음.
3. 고정 입력·engine/rule/template release를 읽고 계산. 개인 chart는 중복 키로 재사용.
4. 결과 스키마, 근거와 문구, 점수 범위를 검증.
5. 현재 lease token이 일치하고 취소되지 않았는지 검사한 뒤 결과·상태·권한을 commit.
6. 무료일 경우 이 commit에서 free_claim 소비 및 entitlement 생성. 유료는 이미 있는 entitlement 유지.
7. worker가 죽으면 lease 만료 후 새 worker가 다시 수행. 이전 worker가 늦게 돌아와도 commit하지 못함.

개발 초기 기본 재시도는 최대 3회와 증가 지연을 제안한다. 고정 입력 오류는 즉시 실패, 일시 인프라 오류만 재시도한다. 실패 job을 삭제하지 않고 상태/오류코드를 남긴다.

## 멱등성과 충돌

- 같은 키와 같은 입력: 같은 리소스/응답 반환.
- 같은 키와 다른 입력: 409, 새 주문으로 해석하지 않음.
- 두 탭에서 무료 요청: free_claim 행 잠금으로 하나만 예약.
- 같은 비교의 두 주문: 활성 주문 고유 제약으로 하나만 유지.
- 결과 재시도: comparison_result unique로 중복 저장 방지.
- 외부 결제 호출은 DB 트랜잭션 밖에서 실행하고 uncertain 상태를 허용한다. 응답 유실 시 공급자 조회 후 수렴시킨다.

## 지도 DTO

사람 ID, 표시 이름, 관계 요약, 표시 거리 또는 band, 고정 각도, result ID만 반환한다. 원문 생일이나 전체 사주 JSON을 지도 렌더링에 보내지 않는다. 새 결과가 ready이고 권한이 있을 때 지도에 반영한다.

## 오류 문구 예

‘날짜를 다시 확인해 주세요’, ‘이미 본 궁합이에요. 기존 결과를 열어드릴게요’, ‘결제 상태를 확인하고 있어요. 다시 결제하지 않아도 돼요’, ‘결제는 완료됐어요. 같은 결과를 다시 준비하고 있어요’.
