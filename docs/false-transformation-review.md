# 합신·화신과 진화·가화의 구분 후속

2026-10-22. 『滴天髓闡微』 1947년 판본 「假化」 PDF384~386쪽(인쇄108~110쪽)을 전체 페이지로 대조했다. 기존 「化象」의 진화4명조와 구분해 **가화2명조의 출처 귀속**을 종합 연구 v4에 추가했다. 일반 최종 강약·중화·합화·성격 규칙이나 공개 v8은 바꾸지 않는다.

[원본 소장 정보](https://commons.wikimedia.org/wiki/File:SSID-11335994_滴天髓闡微.pdf), [원본 PDF](https://upload.wikimedia.org/wikipedia/commons/d/db/SSID-11335994_%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE.pdf), [페이지·PDF 해시와 선택 전사](../research/validation/fixtures/reading-sources/false-transformation-source.json). [PDF384](../research/validation/fixtures/reading-sources/ditian-1947-page-384.png) · [PDF385](../research/validation/fixtures/reading-sources/ditian-1947-page-385.png) · [PDF386](../research/validation/fixtures/reading-sources/ditian-1947-page-386.png). 전사는 原註와 任氏를 혼합하지 않으며, 구두점을 추가했다. 온라인 전사만으로 판정하지 않았다.

## 확인한 차이

384쪽 任氏는 가화의 형상이 하나가 아니라고 설명하며 합신/일주, 화신/뿌리, 화신 부족/일주 기운, 겁·인의 생부, 다른 글자의 손상 등 서로 다른 맥락을 열거한다. 이를 하나의 숫자 기준이나 충족 체크 개수로 합칠 근거는 확보하지 못했다. 이 문단의 ‘화신 유여’를 원래 일간의 신강으로 옮기지도 않는다.

| 년·월·일·시 | PDF386의 판어와 맥락 | 도출하지 않는 판단 |
|---|---|---|
| 기묘·갑술·갑자·기사 | 두 갑·두 기가 각자 합하며 쟁투가 없다는 설명과 가화 판어가 함께 있음 | 쟁합/투합이 없으면 진화라는 충분조건 |
| 갑자·병자·갑신·기사 | 합신이 참되지만 실령, 화신은 가화이며 불청하다는 설명 | ‘합신이 참됨’과 ‘진화’를 동일시하는 판단 |

원문의 관직·재산·운·인품 평가는 앱 풀이와 연구 출력에 옮기지 않았다. 명조 표의 방향은 년→월→일→시로 전사하고 기존 월간/시간 전개 자료로 별도 대조했다. 실제 출생일을 복원하거나 이 명조들이 현실에서 정확히 해석됐다고 검증한 것은 아니다.

## 반영과 한계

`false-transformation-review.mjs`는 네 기둥이 모두 확정되어 정확히 일치할 때만 해당 판본의 `sourceTerm=假化`와 관찰을 돌려준다. 일부 후보/시간 모름/한 기둥 변경에는 판어를 주지 않는다. 이를 합화 성립의 보편 참/거짓으로 바꾸지 않아 `transformationEstablished`, `originalDayStrength`, `moderation`, `score`는 모두 null이다.

종합 연구 v4는 기존 진화 참조와 별개로 이 검토를 보관한다. 보고서는 기존 강약/중화22사례와 새 가화2사례를 별도 집계한다. 기존60개 조건 범위·88개 한 기둥 변경·22개 시간 모름 검사는 유지한다. 이 두 명조로 일반 경계값을 학습/추정하거나 다른 출처의 조건을 덮어쓰지 않는다.

새4개 검사 포함 전체 연구268개 통과. 페이지 SHA-256, 전사 명조/용어, 정확 일치·후보/시간 모름·한 기둥 변경, 합성 월간/시간 전개를 검사했다. `audit-whole-chart-synthesis.mjs --check`, `audit-condition-boundaries.mjs --check` 재현과 앱 버전 보존을 확인했다. 사람이 수행한 명리 감수/독립 적중률·최종 규칙 승인은 여전히 미완료다. 나머지 가화 명조와 실제 구응의 강도·우선순위 및 일반 중화 경계는 추가 감수 대상이다.
