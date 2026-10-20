# 출시 준비 종합 검토

현재 상태: **출시 차단 유지**. 외부 연동은 준비 후 진행합니다.

자료 재현: 달력 730일·풀이 조합 100개·원문 22명조·편집 초안 17개.

월간·시간 천간 원문 10묶음 → 파생 월주 120조합·시각 14400분을 추가 재현합니다.

| 항목 | 상태 | 차단 사유 |
|---|---|---|
| calendar-policy | pending | CALENDAR_POLICY_PENDING |
| expert-interpretation | not-completed | EXPERT_REVIEW_PENDING |
| user-comprehension | not-started | USER_STUDY_NOT_STARTED |
| private-access | not-verified | PRIVATE_ACCESS_UNVERIFIED |
| external-auth | deferred-until-ready | EXTERNAL_AUTH_UNVERIFIED |
| external-payment | deferred-until-ready | EXTERNAL_PAYMENT_UNVERIFIED |
| paid-product | deferred | PAID_PRODUCT_NOT_APPROVED |
| operations | not-verified | OPERATIONS_UNVERIFIED |

이 명령은 자료 해시와 보고서 재현을 검사합니다. 단위·브라우저·DB·빌드 검사를 대신 실행하지 않습니다.

[구조화 결과](release-readiness.json) · [근거와 후속 작업](../../../docs/calendar-reading-release-review.md)
