# 사용자 지정 출시 준비 순서 · 1 → 3 → 4

> 2026-10-23 현행 상태는 [현재 출시 현황](launch-status-current.md)을 따른다. 아래의 미연동·빈 설정·검사 수치는 작성 당시 기록이다. 현재 카카오/테스트 결제 앱 왕복·격리 DB 복원·웹훅 등록은 확인했고, 실제 거래 웹훅/운영·전문 승인은 남아 있다.


2026-10-20 사용자 지시: **“2는 건너뛰고, 1>3>4로 진행해.”** [실행 결정](launch-execution.json)과 [현재 상태](launch-preparation.json)에 반영했다. 사용자 이해도 테스트는 `skipped-by-user`이며 진행을 막는 실행 항목에서 제외한다. 관찰 0명과 미실시 사실은 유지하고 통과 증거로 바꾸지 않는다. 실행 목록은 다른 7개 항목을 유지하며 공개 출시·실제 과금 승인을 만들지 않는다. 기존 연구 종합 보고서는 수행하지 않은 증거 8개를 그대로 보존하는 자료다.

## 1. 계산·풀이 기술 감수

연구 **247개**(기존 계산/풀이 검사246개 + 실행 결정 불변 검사1개), 근거 보고서 재현을 통과했다. 새 독립 천문 관측이나 실제 관계 자료를 확보한 것으로 세지 않는다.

| 검토 | 확인 및 유지한 처리 |
|---|---|
| 달력·범위 | KASI 고정 원문730일·24개월, 음력 환산 연도 범위, 연구 시간표 대조 유지 |
| 월·시 천간 | 원문 기준10묶음·120월주·14,400분 및 야자시 관습 분리 검사 재현 |
| 시간 경계 | 자정 기준, 절입 검토 양끝1,296건, 시간 모름의 후보 보존·시주 미보충 유지 |
| 역사 시계 | 중복·소실 시각 거절, 1954년 보호와 자료 불일치 표시 유지. 미해결 관습을 임의 고치지 않음 |
| 풀이 | 17개 설명 초안·100조합, 17개 기호 정의와 연·월·일의 모든 후보에 공통인 사실만 사용 |
| 제외 판단 | 일반 강약/중화, 합화 충분조건, 실제 궁합 점수·성격/관계 예측은 제공하지 않음 |
| 결과 보존 | 엔진 v5·풀이 v2 및 이전 저장/공개 버전 불변. 김춘배의 안내 말투는 표시 층에만 적용 |

이번 감수에서 새 계산 불일치가 발견되지 않아 알고리즘을 변경하지 않았다. 범위·확정/미확정·기호 정의를 다시 검토한 **개발 기술 감수**다. 계산 관습의 운영 채택과 실제 명리 전문가의 서명은 아직 없으며, 자동 검증을 그 서명으로 바꾸지 않는다. 근거는 [계산 권장안](calculation-policy-candidate.md), [종합 재현](../research/validation/reports/release-readiness.json), [풀이 자료](../research/validation/reports/beta-quality-audit.json)를 따른다.

## 3. 외부 로그인·결제 연결 준비

현재 사주 프로젝트의 별도 설정은 비어 있다. 외부 프로젝트/상점이 준비됐다는 새 확인도 없어 실제 로그인·승인·취소를 실행하지 않았다. 이전 전자책 서비스의 운영 키/DB를 재사용하지 않는다.

[설정 예시](../web/staging.env.example)와 Git 제외 파일 `web/.env.staging.local`을 준비했다. 새 로컬 파일은 권한0600이며 기존 파일은 덮어쓰지 않는다. 실제 키는 채팅·문서·Git으로 보내지 않는다.

필요한 설정은 **HTTPS APP_ORIGIN, 별도 PostgreSQL DATABASE_URL, Supabase URL/publishable key, NICEPAY S2 client/secret**의 6개다. 카카오 REST API 키/Client Secret은 앱 파일이 아니라 Supabase 공급자 설정에 넣는다. Kakao에 등록하는 Supabase 인증 callback과 앱으로 돌아오는 `/auth/callback`은 서로 다르다. 앱 redirect는 Supabase allowlist에 등록한다. [Supabase 카카오 공식 안내](https://supabase.com/docs/guides/auth/social-login/auth-kakao), [redirect 공식 안내](https://supabase.com/docs/guides/auth/redirect-urls)를 2026-10-20 확인했다.

NICEPAY는 sandbox·S2 서버 승인 방식만 사용한다. 실제 창→서명 반환→금액/소속 조회→승인/상태 조회→취소까지 연결 확인이 필요하며, 현재 승인 전 ready 조회의 실제 지원 확인도 남아 있다. [NICEPAY 공식 매뉴얼](https://github.com/nicepayments/nicepay-manual)을 같은 날짜 확인했다. 공개 예제 키를 우리 상점 설정으로 채우지 않는다.

### 사전 점검·제한된 시작 명령

```sh
cd web
npm run check:staging -- --settings .env.staging.local
npm run build
npm run start:staging -- --settings .env.staging.local
```

`check:staging`은 명시한 파일을 Node의 데이터 파서로만 읽는다. shell source·네트워크·DB 연결·마이그레이션·파일 수정은 하지 않는다. 환경변수 파일을 암묵적으로 찾지 않는다. 값/URL/원문 오류는 출력하지 않고 설정명과 고정 코드만 출력한다. `--settings`는 Node 자체 옵션과 충돌하지 않도록 사용한다.

`start:staging`은 같은 검사에서 누락/잘못된 값이 있으면 exit2로 중단하고 Next 프로세스를 시작하지 않는다. 유효한 형식일 때만 127.0.0.1:4180에 바인딩한다. 호스팅·터널·포트 외부 공개를 자동 설정하지 않는다. 기존 로컬 `npm start`는 그대로다.

검사 내용: research mode, 끝 슬래시 없는 원점 형태의 HTTPS 주소, 명시적 remote test, publishable/legacy anon 키(서비스 role 키 거절), NICEPAY sandbox/S2, 별도 PostgreSQL·`sslmode=verify-full` 단일값, 인증서 검증 해제/공개 secret 변수 거절. 중복 sslmode로 뒤의 disable 값을 숨기는 경우도 거절한다. 형식 통과는 실제 키 인증이나 서버 TLS 연결 성공을 뜻하지 않는다.

종료0은 `configuration-valid-unverified`, 종료2는 `blocked`, 파일/인자 오류는 종료1 `STAGING_CHECK_FAILED`다. 빈 실제 설정으로 실행해 **6개 누락과 종료2**를 확인했다. 외부 키/서비스가 없는데 통과 처리하지 않았다.

## 4. 운영 준비와 복원 연습

로컬 PostgreSQL에서 별도 DB 복원을 다시 실행해 **21개 테이블 전체 데이터·스키마·ACL·RLS, 두 연결 풀·12개 동시 무료 요청·승인/환불 경쟁, 복원 후 한 번 작업 재개**를 통과했다. 실행/익명 role 제한과 CLI 오류 정보 비노출도 확인했다. 실제 운영 DB 백업을 검증한 것은 아니다.

준비된 실행 명령은 [운영 절차](launch-operations-runbook.md)를 따른다. 실제 호스팅 결정 후 다음 증거를 채운다: 전 경로 초대자 접근 제한, HTTPS/쿠키와 비공개 캐시, URL/본문 로그 비식별, 별도 DB 역할·마이그레이션, 백업/복구 시간, worker/maintenance 스케줄·상태 알림, 이전 앱 복귀, 운영자·문의/보관/환불 정책. `ALLOW_REMOTE_TEST=true`를 접근 제어 승인으로 세지 않는다.

사업자/문의 채널/호스팅·도메인은 아직 지정되지 않았다. 결제 키를 받는 것만으로 이 항목을 완료하지 않는다. 실제 과금·운영 DB 변경·공개 배포는 수행하지 않았다. 유료 상품 범위도 기존 보류 상태다.

## 이번 변경 검증

연구247개·웹92개·HTTP·320/390px 모바일18사례·빌드/타입·문서/자료 재현 검사를 통과했다. 웹 신규4개 검사는 비밀값 비출력, 미설정 시작 차단, 운영키/TLS 해제·중복 sslmode 거절, legacy anon과 service-role 구분을 포함한다. 이 추가 검사는 실제 공급자 계정으로 수행한 검증이 아니다. 현재 빈 설정 검사 실패(종료2)는 예상한 준비 상태이며 회귀 실패로 감추지 않는다.
