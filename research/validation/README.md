# 계산 엔진 검증 실행

앱 구현과 별개의 검증용 프로젝트다. `engines.lock.json`의 원본 커밋을 고정해 비교한다. `../engines`의 두 저장소는 원본 Git clone이며 직접 수정하지 않았다. 각 원본 LICENSE를 보존한다.

Node 24에서 수행했다. 시스템 node가 없다면 Codex 런타임 node 경로를 PATH에 추가한다. 다른 컴퓨터에서는 Node 24와 pnpm을 설치한 후 실행한다.

```sh
cd research/validation
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
