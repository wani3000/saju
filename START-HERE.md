# 통합본에서 개발 이어가기

기준일 2026-10-14. 현재 기준은 https://github.com/wani3000/saju 의 main이다. 65cc7a9의 코드·시간대 검증·새 캐릭터 시안을 유지하면서 다른 PC bfa9bd5의 캐릭터 역할·표시 데이터 설계를 선별 통합했다. [통합 기록](docs/handoff-integration-2026-10-14.md)을 먼저 확인한다.

## 새 PC 복원

기존 폴더를 덮어쓰지 않고 비어 있는 새 경로에서 실행한다.

```sh
git clone https://github.com/wani3000/saju.git saju
cd saju
git log -3 --oneline
python3 tools/check_docs.py
```

검증 엔진 원본과 의존성 복원은 [검증 실행 안내](research/validation/README.md) 및 engines.lock.json의 정확한 커밋을 따른다. Node 22.17.0 / pnpm 11.25.0에서 최근 검증을 실행했으며 최초 검증은 Node 24였다. 설치된 원본·node_modules·빌드 산출물·인증 정보는 Git에 포함되지 않는다.

## 읽는 순서와 상태

AGENTS.md → README.md → TASKS.md → docs/11-decisions.md → docs/engine-validation.md → docs/13-character-plan.md → docs/development-plan.md 순서로 확인한다.

- 사주햄찌 공개 3단계 분석은 완료, 로그인 이후 입력·결과·공유·충전은 미검증.
- 시간대 경계 처리 및 연월주에 역사적 UTC를 반영하는 연구 코드 구현, 29개 테스트 통과. 운영 엔진 채택·과거 절입 독립 검증·계산 정책과 풀이 감수는 미완료.
- design/characters의 새 3안은 시작 화면이며 미선택. 1번 추천이나 요약 요청은 선택으로 간주하지 않는다.
- 캐릭터 역할·표시 필드·공유 스냅샷은 논리 설계다. 앱·DB·인증·결제는 미구현.
- 다음 단계는 시안 선택 후 결과·지도 확장 및 P03 합성 데이터 앱 골격. 운영 DB·실결제·공개 배포는 별도 요청 전 실행하지 않는다.

Drive의 2026-10-14 ZIP은 bfa9bd5 분기이며 현재 main의 전체 작업을 포함하지 않는다. 해당 ZIP으로 이 checkout을 덮어쓰거나 과거 접근 차단 기록을 현재 상태로 일반화하지 않는다.

## 2026-10-14 호랑이 UI 후속 구현

사용자가 호랑이 2번을 선택했다. 최신 로컬 UI는 [prototype 실행 안내](prototype/README.md)를 따른다. 입력부터 예시 결과·지도·문구 복사가 동작한다. 이전 '시안 선택 대기' 기록은 과거 상태다. Next.js 운영 앱, 실제 계산 연결, DB, 인증, PG는 다음 단계다.

## 최신 서버 연결 앱 (2026-10-14)

[web/README.md](web/README.md)를 읽고 `web/`에서 실행한다. 포트 4180이며 로컬 DB 저장·연구 계산·공유·모의 결제가 동작한다. `prototype/`은 이전 UX 시안이다. [구현 상태](docs/server-app-status.md), [QA](web/qa.md), TASKS.md의 남은 외부 조건을 확인한다. Drive ZIP 이후 변경은 GitHub main을 기준으로 받는다.
