# 강약·합화 판정과 궁합 점수 기준 감수

원문 명조 판어와 출처별 부정 조건을 적용한 연구 결과입니다. 일반 강약·합화 분류기나 궁합 점수의 운영 승인은 아닙니다.

## 원문 강약 20명조

| 원문 사례 | 원문 판어 | 쪽 |
|---|---|---|
| wood-too-strong | 木太旺 | 178 |
| wood-extremely-strong | 木旺極 | 179 |
| wood-too-weak | 木太衰 | 179 |
| wood-extremely-weak | 木衰極 | 180 |
| fire-too-strong | 火太旺 | 180 |
| fire-extremely-strong | 火旺極 | 181 |
| fire-too-weak | 火太衰 | 181 |
| fire-extremely-weak | 火衰極 | 182 |
| earth-too-strong | 土太旺 | 182 |
| earth-extremely-strong | 土旺極 | 183 |
| earth-too-weak | 土太衰 | 183 |
| earth-extremely-weak | 土衰極 | 184 |
| metal-too-strong | 金太旺 | 184 |
| metal-extremely-strong | 金旺極 | 185 |
| metal-too-weak | 金太衰 | 185 |
| metal-extremely-weak | 金衰極 | 186 |
| water-too-strong | 水太旺 | 186 |
| water-extremely-strong | 水旺極 | 187 |
| water-too-weak | 水太衰 | 187 |
| water-extremely-weak | 水衰極 | 188 |

물의 쇠극 마지막 명조에는 원문이 연·월의 무계 종화를 직접 언급합니다. 이 사례 판어를 일간 합화 일반 규칙으로 바꾸지 않습니다.

## 다섯 합의 방해 조건

| 합 | 방해 천간 | 적용 위치 |
|---|---|---|
| 갑기 | 무 | 두 합 위치 사이 |
| 을경 | 갑 | 두 합 위치 사이 |
| 병신 | 정 | 관찰된 천간 전체 |
| 정임 | 병 | 관찰된 천간 전체 |
| 무계 | 기 | 관찰된 천간 전체 |

갑기·을경의 間之와 나머지의 柱有를 구분합니다. 한 상대가 방해받아도 다른 상대를 함께 검사하며, 시각 미상은 미관찰 상대를 배제할 수 없습니다. 방해 부재는 합화 성립이 아닙니다.

## 배제한 강약 지름길

다른 천간 3개 중 생조 2개 이상이면 강하다는 가설은 원문과 3사례에서 어긋났습니다. 이 20명조는 극단 사례만 포함하므로 일반 정확도 수치로 읽지 않습니다.

- wood-too-strong
- wood-too-weak
- metal-too-weak

## 점수안 감수

아래 제안의 수치는 결함 검사용 임의값이며 채택된 가중치가 아닙니다.

- symbol-count: DUPLICATE_CONTRIBUTION_NEEDS_REVIEW, NO_REVIEWED_NUMERIC_WEIGHT, NO_REVIEWED_RELATIONSHIP_EFFECT. 점수·지도 반경은 null.
- individual-strength-as-compatibility: INDIVIDUAL_JUDGMENT_NOT_PAIRWISE_SCORE, NO_REVIEWED_NUMERIC_WEIGHT. 점수·지도 반경은 null.
- source-veto-as-compatibility: COHORT_NORMALIZATION_MOVES_EXISTING_PEOPLE, INDIVIDUAL_JUDGMENT_NOT_PAIRWISE_SCORE, NO_REVIEWED_NUMERIC_WEIGHT. 점수·지도 반경은 null.

합성 척도 검사: 같은 값 60을 집단 최솟값/최댓값으로 정규화하면 0.5에서 0.75로 바뀝니다. 다른 사람 추가로 기존 거리가 바뀌는 정책은 채택하지 않습니다.

기호 정의의 출처, 개인 강약 판어, 개인 합화 방해는 두 사람 관계의 효과나 숫자 가중치 근거를 대신하지 못합니다. 방향이 다른 십성도 대칭 합산 정책 없이 수치화하지 않습니다.

[전체 결과](adjudication-audit.json) · [출처·결정·미완료 범위](../../../docs/adjudication-score-review.md)
