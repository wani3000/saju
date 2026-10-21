# 강약·중화 경계와 합화 조건 후속 감수

2026-10-22. 신규 `source-boundary-priority-review-v1`, 종합 연구 `whole-chart-evidence-synthesis-research-v2`. 공개 앱 v8은 유지한다.

## 확인 및 정정

직전 종합 분석 v1은 극단 강약 20사례만 연결했다. 저장소에는 이미 `beta-moderation-cases.json`의 **중화 사례 1개와 계절상 왕상 판단의 반례 1개**가 있었으나 통합에서 빠졌다. 이번에 두 사례를 실제 종합 결과의 `moderation` 검토에 연결했다. 새로운 원전 사례를 발견했다고 세지 않는다. 원전 사례 전체와 일반 분류 경계는 여전히 다르다.

다음 보존 이미지를 직접 재대조했다. 기존 명세의 해시와 전사는 유지한다.

- [滴天髓闡微 1947, PDF189쪽](../research/validation/fixtures/reading-sources/ditian-1947-page-189.png): 중화와 재/겁·관/상·살/제의 상대 관계. 하나의 일간 강약 점수로 환원할 수치 문턱은 없다.
- [190쪽](../research/validation/fixtures/reading-sources/ditian-1947-page-190.png): 신사·갑오·계묘·계해, `中和純粹`. 사해 충이 함께 있으므로 ‘충이 하나라도 있으면 중화 아님’의 반례다. 일반 신강/신약 수치 경계가 아니다.
- [191쪽](../research/validation/fixtures/reading-sources/ditian-1947-page-191.png): 기유·병자·계미·무오, `似乎旺相，不知財殺太重`. 계절상 왕상만으로 전체 판정을 끝내는 지름길의 반례다. 이것을 일반 신약 확정으로 바꾸지 않는다.
- [子平真詮 1926, PDF20쪽](../research/validation/fixtures/reading-sources/ziping-1926-page-20.png): 경오·을유·갑자·을해, 격위 때문에 두 을과 경의 관계를 단순 쟁합으로 취급하지 않는 사례. 개수만으로 모든 합을 무효화할 수 없다.
- [三命通會 1926, PDF129쪽](../research/validation/fixtures/reading-sources/sanming-1926-page-129.png): 선호 시주 예와 문맥상 기피 조건을 함께 보존. 선호=충분조건이라는 문구는 확인하지 못했다.

원전 출처 메타데이터: [중화 사례 명세](../research/validation/fixtures/reading-sources/beta-quality-sources.json), [위치 조건 명세](../research/validation/fixtures/reading-sources/context-source.json), [시상 조건 명세](../research/validation/fixtures/reading-sources/scoped-criteria-source.json).

## 코드에 반영한 검토 순서

이는 **근거를 잘못 합치지 않는 구현 순서**다. 전통 명리학 전체의 최종 우선순위를 확정했다는 의미는 아니다.

1. 시각·후보·판정 대상을 확인한다. 모르는 조건은 통과 처리하지 않는다.
2. 해당 판본의 일간/합 상대/월/위치 조건이 맞는지 확인한다.
3. 선호 조건과 방해 조건을 함께 기록한다. 한 합 상대의 방해를 다른 합이나 차트 전체의 불성립으로 확대하지 않는다.
4. 자조·구응은 전제 성립을 먼저 요구한다. 다른 합화가 일어났다고 가정해 최초 합화를 증명하는 순환 논리를 허용하지 않는다.
5. 다른 판본의 쟁합/격위 조건은 별도로 남긴다. 어느 판본을 우선할지 확인되지 않으면 보류한다.
6. 방해가 안 보인다는 이유나 선호 시주가 있다는 이유만으로 최종 합화 true를 내지 않는다.

예: 무진·정사·계유·병진은 병진 선호 시주와 유 일지의 기피 조건이 함께 관찰된다. 두 조건이 공존한다는 것은 확인되지만 어느 쪽이 최종적으로 이기는지는 미판정이다. 일부 후보에서만 각각 성립하면 확정 공존으로 합치지 않는다.

## 구현·검증

[검토 모듈](../research/validation/boundary-priority-review.mjs), [새 회귀 검사](../research/validation/boundary-priority-review.test.mjs).

- 중화/대조 사례는 정확한 네 기둥이 일치할 때만 출처 판어로 연결. 시간 제거/기둥 변경 시 이전 판어를 전용하지 않는다.
- 선호 시주와 경고 동시 존재, 후보 순서 불변, 일부 후보의 잘못된 합성 방지.
- 격위/중복 합 상대, 자조의 미확정 전제, 다른 사람으로부터 조건을 빌려오지 않는 개인·궁합 분리.
- 기존 연구 전체 포함 260개 통과. 원전22사례와 출생5사례의 [종합 보고서](../research/validation/reports/whole-chart-synthesis.json) 재생성.

일반 강약·중화 경계와 합화 충분조건은 계속 null이다. 원전 대조를 전문가 승인이나 실제 성격 적중률로 표시하지 않는다. 공개 앱 재배포 대상은 이번 변경에 없다.
