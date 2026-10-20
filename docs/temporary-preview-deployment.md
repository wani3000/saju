# 김춘배 훈장 임시 체험 배포

2026-10-20 사용자 요청으로 현재 App·연구 엔진·풀이를 재사용한 브라우저 단독 체험판을 배포했다. 정식 서비스 출시는 아니다.

| 항목 | 확인값 |
|---|---|
| Vercel 팀 | oxaz1234-gmailcoms-projects |
| 전용 프로젝트 | chunbae-preview / prj_OFQZ94cPRQBbZBfiz8OhIz5oY7JT |
| 소스 커밋 | 63374a0 |
| 배포 ID | dpl_3ABbpHSQ9swpX7HL7ZQAmTHntG1A |
| 상태·대상 | Ready / preview (CLI inspect) |
| 주소 | https://chunbae-preview-q2qc6uv1d-oxaz1234-gmailcoms-projects.vercel.app |
| 체험 링크 만료 | 2026-10-27 20:25:10 KST |

기본 URL은 Vercel Authentication으로 보호된다. 이 배포에만 유효한 7일 Shareable Link를 사용자에게 전달하고 토큰은 Git에 기록하지 않는다. 프로젝트 접근 보호는 해제하지 않았다. 첫 신규 프로젝트 배포가 플랫폼에서 production으로 지정되어 별도 preview를 만들었다. 최초 배포 dpl_EuE1AViAc1bvGTx2zt1gWYPxsvQa는 ID로 지정해 제거했다. 검증용 vercel curl이 자동 생성한 프로젝트 automation bypass도 폐기했다. 다른 프로젝트는 변경하지 않았다.

## 실제 검증

- 원격 Chrome에서 가상 나래(1990-03-12)·하루(1992-05-21), 시간 모름으로 입력→동의→결과. 기준 오행 화/화와 지지 육충·천간 합 설명 표시. 새로고침 후 동일 결과 복원.
- 지도에서 하루 표시. 공유 미리보기는 열리며 공개 링크 발급 버튼은 비활성화.
- 가온 추가→2,900원 예정/청구 없음 안내→모의 승인→결과. 보관함 초기화 후 빈 시작 화면 복귀.
- 390px 결과와 320px 시작 화면에서 가로 넘침 없음. 문서 clientWidth/scrollWidth375/375, 305/305(세로 스크롤바 제외). 실제 모바일 기기 검증은 아니다.
- 인증된 HTTP200 및 동일 JS/CSS 해시. Vercel이 피드백 스크립트 태그를 추가하므로 HTML 전체는 로컬과 다르다. CSP의 외부 스크립트 차단·connect-src none, noindex/nofollow, no-referrer, nosniff, frame DENY 확인.
- 웹96개·Next.js 빌드/타입·HTTP/모바일18사례·별도 정적 빌드 통과. 소스63374a0의 GitHub Research/Web/Prototype validation 모두 성공.

입력·결과는 이 탭의 sessionStorage에만 보관한다. 실제 로그인·복구·공개 공유·실결제는 제외했다. 브라우저 세션 복원으로 기록이 남을 수 있으므로 체험 후 보관함의 초기화를 사용한다. 외부 연동·전문가 서명·상품 확정·정식 출시 승인 대기는 유지하며 사용자 테스트는 기존 지시대로 건너뛴 상태다.

증거: [시작390px](../web/qa-evidence/chunbae-hosted-home-390.jpg) · [시작320px](../web/qa-evidence/chunbae-hosted-home-320.jpg) · [결과390px](../web/qa-evidence/chunbae-hosted-result-390.jpg). 가상 정보만 포함하고 접근 토큰은 촬영하지 않았다. [빌드·재배포 안내](../web/preview/README.md).
