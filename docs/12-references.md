# 출처와 기존 사이트 관찰

확인일 2026-10-09. 아래 링크는 선택의 근거이며 라이브러리 정확도·운영 보안을 검증 완료했다는 의미가 아니다. 구현 시 현재 버전과 조건을 다시 확인한다.

## 공식 자료

| 자료 | 확인 내용 | 사용 범위 |
|---|---|---|
| [ssaju 원본 저장소](https://github.com/golbin/ssaju) | 사주/음양력 계산 인터페이스, MIT 표기, 시간 기본값 안내 | 자체 엔진 후보, P01 코드·라이선스·경계 검증 필요 |
| [manseryeok 비교 후보](https://github.com/yhj1024/manseryeok) | 한국 만세력 TypeScript 구현 안내 | 비교 후보, 아직 독립 정확도 검증 없음 |
| [한국천문연구원 음양력 정보](https://www.data.go.kr/data/15012679/openapi.do) | 음양력 관련 기초 자료 | 달력 대조, 궁합 점수 근거로 사용하지 않음 |
| [SAZU API 문서](https://www.sazu.app/manse-api/docs) | 만세력 및 관계 궁합 API 안내 | 자체 구현의 대안, 가격/조건은 계약 시 확인 |
| [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | DB 행 권한, grants와 RLS, 서버 전용 권한 주의 | 테이블별 권한 설계 |
| [Supabase 익명 로그인](https://supabase.com/docs/guides/auth/auth-anonymous) | 익명 인증과 계정 연결 기능 | 첫 체험과 계정 전환 검증 |
| [Toss Payments 연동 문서](https://docs.tosspayments.com/guides/v2/payment-widget/integration) | 결제 UI와 서버 승인 연동 | P07 테스트 결제 구현 |

문서의 순서·테이블·가격·거리 산식·성능 목표는 이 프로젝트를 위한 설계 제안이다. 외부 자료가 이 서비스의 비즈니스 성과나 실제 궁합 정확도를 보장하지 않는다.

## 참고 사이트 관찰

[사주도령](https://doryeong.app/) 공개 화면에서 확인한 범위:

- 홈에 다양한 사주 상품과 가격이 노출됨.
- 대표 사주와 무료 오늘 운세 진입은 로그인으로 연결됨.
- 귀인 지도는 비회원 입력 경로가 있음.
- 캐릭터 기능은 비회원으로 가상 생일을 입력해 결과 생성까지 확인함.
- 캐릭터 결과에서 지도와 유료 풀이로 연결되는 흐름이 있음.
- 로그인/실결제/유료 결과와 해당 사이트의 소스 코드·DB는 확인하지 않음.

사용자는 작은 글씨, 어른에게 어려운 화면, 복잡한 UX를 핵심 문제로 지적했다. 이 프로젝트는 그 문제를 큰 글씨와 한 가지 반복 흐름으로 해결한다.

화면 증거는 [참고 분석 보고서](../reference/site-audit/report.html)에 있다. 캡처는 연구 참고용이며 자산 사용 허가나 원 사이트 복제 지시가 아니다. 상품명·가격·화면은 관찰 당시 상태로 이후 달라질 수 있다.
