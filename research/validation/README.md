# 계산 엔진 검증 실행

앱 구현과 별개의 검증용 프로젝트다. `engines.lock.json`의 원본 커밋을 고정해 비교한다. `../engines`의 두 저장소는 원본 Git clone이며 직접 수정하지 않았다. 각 원본 LICENSE를 보존한다.

Node 24에서 수행했다. 시스템 node가 없다면 Codex 런타임 node 경로를 PATH에 추가한다. 다른 컴퓨터에서는 Node 24와 pnpm을 설치한 후 실행한다.

```sh
cd research/validation
pnpm install --frozen-lockfile --ignore-scripts
node build.mjs
node run-comparison.mjs
node check-timezones.mjs
node --test adapter.test.mjs
```

원본이 없는 새 환경에서는 `engines.lock.json`의 repository를 `research/engines/<name>`에 clone하고 해당 commit으로 checkout한다. 최신 HEAD를 검증된 커밋 대신 사용하지 않는다.

fixtures에는 당시 수집한 KASI 원문과 파생 기대값, IANA 월별 정오 사례가 포함되어 있어 비교 실행 자체는 네트워크 없이 가능하다. 새 수집은 `python3 collect-fixtures.py`, `python3 collect-iana.py`로 수행하며 출처 시각과 해시를 다시 기록해야 한다.

`run-comparison.mjs`는 후보의 실패를 수집하는 평가 도구라 exit 0이 후보 통과를 뜻하지 않는다. 판정은 reports/comparison.json을 읽는다. `adapter.test.mjs`는 실제 단언에 실패하면 exit 1이다.

현재 어댑터는 연구용이며 productionApproved=false다. 1908년 이전을 차단하고 시간 미상을 임의의 정오로 확정하지 않는다. 역사적 시각 처리와 운영 범위 확정은 남아 있다. 이 어댑터를 결제 상품에 연결하지 않는다.
