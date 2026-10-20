# 계산 엔진 검증 실행

앱 구현과 별개의 검증용 프로젝트다. `engines.lock.json`의 원본 커밋을 고정해 비교한다. `../engines`의 두 저장소는 원본 Git clone이며 직접 수정하지 않았다. 각 원본 LICENSE를 보존한다.

Node 24에서 수행했다. 시스템 node가 없다면 Codex 런타임 node 경로를 PATH에 추가한다. 다른 컴퓨터에서는 Node 24와 pnpm을 설치한 후 실행한다.

```sh
cd research/validation
node restore-engines.mjs
pnpm install --frozen-lockfile --ignore-scripts
node build.mjs
node run-comparison.mjs
node check-timezones.mjs
pnpm test
```

원본이 없는 새 환경에서는 `engines.lock.json`의 repository를 `research/engines/<name>`에 clone하고 해당 commit으로 checkout한다. 최신 HEAD를 검증된 커밋 대신 사용하지 않는다.

fixtures에는 당시 수집한 KASI 원문과 파생 기대값, IANA 월별 정오 사례가 포함되어 있어 비교 실행 자체는 네트워크 없이 가능하다. 새 수집은 `python3 collect-fixtures.py`, `python3 collect-iana.py`로 수행하며 출처 시각과 해시를 다시 기록해야 한다.

`run-comparison.mjs`는 후보의 실패를 수집하는 평가 도구라 exit 0이 후보 통과를 뜻하지 않는다. 판정은 reports/comparison.json을 읽는다. `adapter.test.mjs`는 실제 단언에 실패하면 exit 1이다.

현재 어댑터는 연구용이며 productionApproved=false다. 1908년 이전을 차단하고 시간 미상을 임의의 정오로 확정하지 않는다. 역사적 시각 처리와 운영 범위 확정은 남아 있다. 이 어댑터를 결제 상품에 연결하지 않는다.

2026-10-12 복원 환경(Node 22.17.0, pnpm 11.25.0)에서도 위 명령과 기존 결과를 재현했다. build.mjs는 현재 작업 디렉터리와 무관하게 스크립트 위치를 기준으로 실행한다. 프로젝트 루트에서도 `node research/validation/build.mjs`를 사용할 수 있다.

## 시간대 경계 판정 · 2026-10-13

`resolve-wall-time.mjs`는 fixtures/seoul-transitions.json의 고정 자료를 사용한다. `python3 collect-transitions.py`는 현재 호스트의 Asia/Seoul TZif를 읽어 전환표와 Python zoneinfo 기대값을 갱신한다. 갱신 시 출처 해시와 변경 diff를 검토해야 한다. 기본 테스트에는 Python이나 시스템 시간대 DB가 필요하지 않다.

`pnpm test`는 22개 테스트를 실행하며 1,918개 시간대 사례를 포함한다. 시간 모름에 UTC를 발명하지 않으며, 알고 입력한 시각이 중복/누락이면 오류를 반환한다. civilTime은 사주 기둥의 역사적 시간 보정 적용 완료를 뜻하지 않는다. 기존 기둥 계산 검증과 운영 승인은 남아 있다.

## 2026-10-14 계산 경로 보강

현재 정책은 research-civil-midnight-v3다. 연월주는 역사적 UTC, 일시주는 현지 시계·자정 기준으로 분리해 계산한다. 시간 모름은 유효한 날짜 구간 전체의 후보를 보존한다. 29개 테스트가 통과했으며 상세 근거와 한계는 [검증 기록](../../docs/historical-clock-validation.md)에 있다.

원본 복원 명령은 기존 checkout을 덮어쓰지 않는다. 다른 HEAD나 변경 파일이 있으면 사용자의 작업을 보존한 뒤 정확한 commit을 직접 복원한다. build.mjs가 원본 검증을 선행한다. licenses 폴더에는 두 후보의 MIT 고지를 보존한다.

## 2026-10-19 NAOJ 독립 절입 대조

8개 표본 연도·192개 절기 시각을 NAOJ 장기 계산과 대조했다. 189건은 표시 분이 같고 3건은 1분 차이가 있다. 월 경계 전후 최소 1분 입력 192건 중 1954-12-07 23:58 한 건이 불일치한다. 최소 2분 입력 192건과 시간 모름 날짜 96건의 후보 보존은 일치한다. **34개 연구 테스트의 성공에는 알려진 불일치의 재현 검사가 포함되며 운영 정확도 통과가 아니다.**

```sh
python3 research/validation/collect-naoj.py --check
node research/validation/compare-naoj.mjs --check
pnpm --dir research/validation test
# 현재 운영 승인 미완료이므로 종료 코드 2가 정상:
node research/validation/compare-naoj.mjs --check --release-check
```

새 출처를 의도적으로 수집할 때만 `python3 research/validation/collect-naoj.py --download --retrieved YYYY-MM-DD`를 쓴다. 기본 실행은 저장된 원문만 파싱하고 fixture를 재작성하며 `--check`는 읽기 전용이다. 갱신 후 출처·ΔT·해시·보고서 차이를 검토한다. (C) NAOJ, [이용 안내](https://eco.mtk.nao.ac.jp/koyomi/site/). 분 단위 정밀도, UT/UTC, 역사 역산과 실제 당시 발행물의 차이는 [검증 기록](../../docs/historical-clock-validation.md)을 따른다. 원문은 EUC-JP이며 앱 런타임이나 사용자 계산에 다운로드 자료를 직접 주입하지 않는다.

## 원인 추적과 현재 v4 정책

`audit-term-rounding.mjs --check`는 동일 원본 의존성 lunar-javascript 1.7.7로 1908~2026년 2,856개 분 반올림을 재현한다. 이는 **출처 추적**이며 독립 정확도 오라클이 아니다. 패키지는 검증 전용으로 고정했고 MIT 고지를 licenses에 추가했다. `python3 collect-naoj-sensitivity.py`는 저장된 ΔT 통제 응답 6개의 해시·추출값을 오프라인 검사한다. 명시적 재수집만 `--download --retrieved YYYY-MM-DD`를 사용한다.

현재 앱 어댑터는 research-civil-midnight-v4다. 절 전후 120초의 임시 검토 구간과 입력 분/날짜 구간이 겹치면 연·월주 후보를 보존한다. 120초를 검증된 오차 한도로 해석하지 않는다. 시간 모름은 시주 null을 유지한다. `baseline-v3.mjs`는 이전 정책의 동결된 비교 기준으로, 기존 KASI/NAOJ 보고서의 알려진 실패를 계속 재현한다. 42개 연구 테스트는 두 경로를 구분한다. [원인·실험·제약](../../docs/historical-clock-validation.md)을 따른다.

## 2026-10-19 JPL 독립 모델과 이중 반올림 검사

`audit-solar-models.mjs --check`는 고정된 JPL DE440s/IAU2000A의 TT 근 2,856건과 원본 계산을 비교한다. 1988·2024년의 표시 분 차이는 같은 ΔT에서 각각 약 1.39·1.30초의 모델 차이가 반올림 경계를 넘으며 발생함을 재현했다. `term-precision.mjs`는 초 API를 거치지 않고 연속 근을 보존하며 표시 때 한 번만 반올림한다. 이 수정 경로에서 기존 표의 별도 이중 반올림 37건도 드러난다. 앱 v4·고정 원본 표는 유지하며 새 도구를 런타임에 번들하지 않는다.

```sh
python3 research/validation/collect-naoj-sensitivity.py --thresholds
node research/validation/audit-solar-models.mjs --check
pnpm --dir research/validation test
# 승인 검사는 종료 코드 2 유지:
node research/validation/audit-solar-models.mjs --check --release-check
```

전체 독립 근을 다시 계산하려면 Python 3.9~3.12의 격리 환경을 사용한다. 32MB 커널은 최초 `--download`에서만 복원하고 고정 해시를 확인한다. 재수집 없이 `--check`를 쓸 때 캐시가 없으면 실패한다. 기본 CI의 fixture 검사와 전체 천문 재계산을 구분한다.

```sh
python3 -m venv /tmp/saju-ephemeris
/tmp/saju-ephemeris/bin/pip install -r research/validation/requirements-ephemeris.txt
/tmp/saju-ephemeris/bin/python research/validation/collect-ephemeris.py --download --check
```

생성 갱신은 명시적으로 `--check`를 빼고 수행한 뒤 파생 자료·해시·보고서 diff를 검토한다. 실제 정확도와 수치 수렴·재현 허용 오차를 구분한다. 전체 원인과 제약은 [검증 기록](../../docs/historical-clock-validation.md)을 따른다. Skyfield MIT 고지는 licenses에 보존한다. 현재 연구 테스트는 49개다.

## 역사 시간척도 후속 (2026-10-19)

`python3 check-time-standards.py`는 저장한 IANA 2025b 원본을 zic로 임시 컴파일하고 기존 28개 전환·1,918개 입력과 비교한다. 호스트 tzdata에 의존하지 않으며 같은 출처의 재현 검증이다. `time-scales.mjs`는 고정 IERS 표의 유효 범위에서만 TT→UTC를 계산한다. 1972년 이전과 윤초 자체는 거절하며 웹 런타임에 포함하지 않는다.

전체 연구 테스트 57개에는 현대 UTC 월 경계 660건/전후 1,320입력, 전환 누락·중복 분 1,533건, 자정 정책의 43,465일 주기 전개 검사가 추가됐다. 국가기록원과 IANA의 1954 전환 시각 차이로 새 어댑터는 v5 보호를 적용한다. 기존 v4는 baseline-v4.mjs에 보존했다. [출처 차이와 한계](../../docs/historical-clock-validation.md)를 읽고 재현 성공을 역사 정확도 승인으로 간주하지 않는다.

## 관보 원본과 명리 규칙 정의 (2026-10-19 후속)

1954년 관보 원본의 00:30 문구를 확인했다. `compare-1954-clocks.mjs`는 IANA와 종전 시계 00:30 가설을 명시적으로 비교하며 앱 시간표를 교체하지 않는다. [관보 판정](../../docs/gazette-1954-review.md)을 따른다.

`reading-rules.mjs`와 `reading-analysis.mjs`는 1926년 판본 스캔에서 대조한 천간 오행 배속 및 합·충 17쌍을 연구 프로필에 적용한다. 일치 위치·후보 공통성·출처를 남기되 합화·강약·성격·궁합 점수를 추론하지 않는다. 앱과 연결하지 않는다. [명리 규칙 감수](../../docs/reading-rules-review.md)에 적용 범위와 후속 조건을 기록했다.

```sh
node research/validation/audit-reading-rules.mjs --check
pnpm --dir research/validation test
# 승인 미완료: 종료 코드 2
node research/validation/audit-reading-rules.mjs --release-check
```

전체 연구 68개 테스트에는 2,880분 역사 모델 비교, 244개 기호 짝, 3,600쌍 A/B 대칭, 시간 모름·경계 후보·음양력 대응과 합성 감수 보고서 6개 재현을 포함한다. CI는 저장된 전체 페이지 이미지와 전사의 해시를 오프라인 검사한다. 원문 수기 판독과 명리적 해석 자체를 자동 증명하는 검사가 아니다.

## 지장간·십성 후속 (2026-10-19)

`natal-rules.mjs` / `natal-analysis.mjs`는 원전 지장간 목록과 일간 기준 분류를 별도 연구 버전으로 제공한다. 한국어 십성 명칭은 명시적인 미승인 용어 정책이며 월령 강약·합화·궁합 점수는 산출하지 않는다. 일간과 자신의 지장간은 같은 일주 후보 안에서만 묶는다. 후보 공통 분류만 감수 문장으로 만들며 웹과 연결하지 않는다. [상세 감수](../../docs/natal-rules-review.md).

```sh
node research/validation/audit-natal-rules.mjs --check
pnpm --dir research/validation test
# 운영 승인 미완료: 종료 코드 2
node research/validation/audit-natal-rules.mjs --release-check
```

전체 연구 77개 검사 통과. 새 9개는 100방향 조합·60일주 후보·원문 예시·출처 해시·시간 모름·초안 재현을 포함한다. 읽기용 `reports/natal-reading-drafts.md`와 전체 `reports/natal-rule-audit.json`을 함께 재생성한다. 이전 합충 v1 보고서는 변경하지 않는다.

## 월령·합화 조건과 관계별 초안 (2026-10-19)

`context-analysis.mjs`는 월지 지장간의 투출·뿌리 연결·합의 위치/중간 극/추가 상대를 관찰한다. 합 짝과 맥락의 후보 공통성을 따로 검사하며 합화·강약·상쇄의 결론은 만들지 않는다. `context-drafts.mjs`는 공통 사실만 한국어로 설명하고, 관계별 일반 대화 제안을 생일 근거와 분리한다. 점수·정규화값·지도 반경은 null이다. [감수 범위](../../docs/month-combination-review.md).

```sh
node research/validation/audit-context-rules.mjs --check
pnpm --dir research/validation test
# 운영 미승인: 종료 코드 2
node research/validation/audit-context-rules.mjs --release-check
```

전체 연구 92개 검사 통과. 신규 15개는 원문 PDF와 쪽 해시·후보 상관관계·16개 주변 조합 전수 비교·원전 예시·관계 유형 불변성·과거 보고서 재현을 포함한다. 조건 사례 8개와 관계 초안 4개는 `reports/context-rule-audit.json`, `reports/context-reading-drafts.md`로 함께 생성한다. 원전 구절과 코드가 대응한다는 검토는 예측 타당성이나 운영 승인이 아니다.

## 원전의 명시적 통근·합 방해 판단

`source-judgments.mjs`는 『子平真詮』의 통근 11사례와 갑기 사이 경/을 방해 사례를 `ziping-explicit-judgments-research-v1`으로 분류한다. 정성적 뿌리 등급은 수치가 아니며, 미수록 사례는 무근·합화 성공으로 바꾸지 않는다. 기존 관찰과 버전은 보존한다. [감수 범위](../../docs/source-judgments-review.md), [읽기용 16사례](reports/source-judgment-drafts.md)를 따른다.

```sh
node research/validation/audit-source-judgments.mjs --check
# 운영 미승인으로 종료 코드 2
node research/validation/audit-source-judgments.mjs --release-check
```

## 사령·강약 요소·합화 필요조건 통합 감수

`seasonal-command.mjs`는 원문 12월 배분과 실제 절입 경과 구간을 연결한다. 오월 29일 합계·명목 30일 초과·시각 경계는 미확정 처리한다. `strength-transformation-review.mjs`는 사령·투출·통근·생극을 함께 반환하고 갑기 합의 확인된 필요조건을 검사한다. 종합 신강·신약과 합화 충분조건은 미승인이다. [적용 기준](../../docs/seasonal-strength-review.md), [12사례 초안](reports/seasonal-review-drafts.md).

```sh
node research/validation/audit-seasonal-review.mjs --check
# 운영 미승인: 종료 코드 2
node research/validation/audit-seasonal-review.mjs --release-check
```

### 오월·중화·다섯 합의 출처 대조

`extended-source-review.mjs`는 1940년 오월 29일 대조, 『命理集成』의 다섯 합 월령·예외월·중복 검사, 『滴天髓闡微』 강약 네 원문 명조 대조를 통합한다. 기존 연구 버전은 보존한다. [근거와 범위](../../docs/extended-source-review.md), [보고서](reports/extended-source-drafts.md).

```sh
node research/validation/audit-extended-sources.mjs --check
# 운영 미승인 종료 코드 2
node research/validation/audit-extended-sources.mjs --release-check
```

## 2026-10-20 KASI 월별 자료와 출시 준비 보고서

`python3 collect-kasi-months.py --check`는 고정된 24개월·730행과 압축/원문 해시를 오프라인 검사한다. 재수집은 `--download`를 명시한 경우에만 실행한다. 공개 자료의 음력 연·월 표기는 절입 사주 연·월의 정답으로 사용하지 않는다. `node audit-calendar-reading.mjs --check`는 달력·기존 풀이의 연결, `node audit-release-readiness.mjs --check`는 종합 보고서를 재현한다. 후자의 `--release-check`는 현재 코드 2(미완료 조건 8개)가 기대값이며 0으로 우회하지 않는다. [근거·한계·화면 변경](../../docs/calendar-reading-release-review.md).

`node audit-month-hour.mjs --check`는 『評註淵海子平』 PDF 39~40쪽의 시작값 10묶음·페이지 해시에서 파생 월주 120조합과 시각 14,400분을 재현한다. KASI 일진 10행을 사용하며 파생 조합을 독립 사료로 세지 않는다. 늦은 자시 정책은 선언한 구현 관습으로 검사한다. 연구 전체 213개, 계산·풀이 버전은 유지한다. [원문과 로컬 복원 검증](../../docs/month-hour-restore-review.md).
