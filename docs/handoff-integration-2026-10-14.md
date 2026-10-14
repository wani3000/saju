# 2026-10-14 인수인계 설계 통합 기록

현재 main 65cc7a9를 기준으로 다른 PC의 bfa9bd5d18b3ab56060e37adca428ce80f711654에서 캐릭터 설계만 선별 반영했다. 공통 조상은 aba475a이며 두 버전은 서로의 후속 커밋이 아니다. 다른 PC의 커밋 전체를 병합하거나 현재 코드를 ZIP으로 교체하지 않았다.

## 원본 확인

- [Drive 폴더](https://drive.google.com/drive/folders/1boo1DIFmkO6UOWfjY_MnU49K1FVKDcpI)의 saju-relationship-transfer-2026-10-14.zip을 별도 경로에 복원했다.
- 다운로드 파일에서 계산한 SHA-256: `9abf59650b2e179004566cfe4f494d4f5781926bda38c72c68324e489bd7156a`. 외부에서 제공된 새 ZIP 기대 해시와 대조한 것은 아니다.
- ZIP CRC 검사, 내부 PROJECT-SHA256SUMS.txt, bundle 복원 파일과 project 파일 일치 확인 완료.
- Drive 폴더의 SHA256SUMS.txt는 10월 12일 ZIP용이다. 파일 날짜만으로 현재 GitHub보다 최신이라고 판단하지 않는다.

## 반영 및 보존

| 항목 | 통합 처리 |
|---|---|
| 화면별 캐릭터 역할 | docs/13-character-plan.md에 반영, 입력 선택 단계 추가 없음 |
| 캐릭터 표시 데이터 | 승인 키·변형·카탈로그 버전, 점수·가격과 분리하는 논리 설계 |
| 공유·지도 | 두 사람 표시 스냅샷, 이름 병기, 접근성·fallback 검증 계획 |
| 사주햄찌 분석 | 기존 공개 3단계 분석 보존, 다른 PC의 차단은 환경별 이력으로 구분 |
| 캐릭터 시안 | 기존 design/characters의 3안과 표시 번호 유지, 아직 미선택 |
| 검증 코드 | research/validation 및 시간대 fixture·테스트 변경 없음 |
| GitHub 상태 | 현재 main 업로드 이력을 보존, ‘푸시 미확인’을 현재 상태로 가져오지 않음 |
| MANIFEST.json | 오래된 배치 스냅샷을 새 현재 파일 목록으로 덮어쓰지 않음 |

문서 통합이 앱·DB·결제 구현을 뜻하지 않는다. 기존 자동 테스트 22개와 1,918개 사례 통과는 10월 13일 실행 근거이며 이번 변경은 문서만 대상으로 한다. 문서 연결 검사와 diff 검사로 통합을 검증한다.

## 다음 PC의 시작점

현재 GitHub main과 저장소 루트의 [START-HERE.md](../START-HERE.md)를 사용한다. Drive의 요약 문서·ZIP·안내는 이번 작업에서 갱신하지 않았으므로 여전히 다른 PC의 분기 상태다. 기존 checkout에 로컬 변경이 있으면 새 clone 경로를 사용하거나 변경을 보존한 뒤 비교한다.
