import { defineConfig } from "@playwright/test";
const origin = process.env.TEST_ORIGIN;
if (process.env.SAJU_LOCAL_RUN !== "1" || !origin || new URL(origin).hostname !== "127.0.0.1")
  throw new Error("Run npm run test:journey to create an isolated local server and database.");
export default defineConfig({
  testDir: "./e2e", testMatch:process.env.SAJU_AUTH_MODE==="kakao-required"?"kakao-required.spec.ts":"journey.spec.ts", workers: 1, fullyParallel: false,
  forbidOnly: Boolean(process.env.CI), retries: 0, maxFailures: 1, timeout: 40_000, globalTimeout: 180_000,
  reporter: "list", outputDir: "test-results",
  use: { baseURL: origin, locale: "ko-KR", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [320,390].map(width => ({name: `mobile-${width}`, use: {browserName: "chromium", viewport: {width,height:844}}})),
});
