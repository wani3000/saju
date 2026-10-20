# Next.js 서버 연결 앱

상위 AGENTS.md를 따른다. 선택한 조선 기록 사진풍 2안과 김춘배 훈장 디자인을 유지한다. 인물은 가상이며 카메라를 보지 않는다. 기존 공유의 tigers-v1 자산은 보존하며 `prototype/`의 보호된 런타임은 수정하지 않는다.

- 앱은 research mode다. 실제 궁합 규칙·문구·PG·인증 감수 전 production gate를 제거하지 않는다.
- PGlite는 단일 프로세스 로컬 개발 전용이다. 별도 worker는 웹 서버를 멈춘 후 실행하거나 외부 PostgreSQL을 사용한다.
- 생일, 복구 코드, 세션, 공유 토큰, 결제키는 로그·Git에 넣지 않는다.
- 입력 스키마, 소유권, 무료권, 결제, 공유 변경 시 서비스 테스트와 HTTP 여정을 실행한다.
- `npm run build`, `npm test`, 실행 서버에 `npm run test:http`가 기본 검증이다. 실제 브라우저는 CUA로 확인한다.
- 실제 외부 OAuth·NICEPAY 상점 왕복 없이 실연동 검증을 완료했다고 쓰지 않는다. 로컬 PostgreSQL 검증과 운영 DB 검증을 구분한다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
