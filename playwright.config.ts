import { defineConfig, devices } from "@playwright/test";
import { loadE2eEnv, RUN_ID } from "./e2e/support/env";

/* 설정을 읽는 시점에는 실패시키지 않는다 — `--list` 나 리포트 열람이 막히면
   원인을 찾기 더 어려워진다. 실제 중단은 global-setup 에서 한다. */
const result = loadE2eEnv();
const env = result.ok ? result.env : null;

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = env?.baseURL ?? `http://127.0.0.1:${PORT}`;
const isCI = !!process.env.CI;

/** 앱이 바라볼 Supabase 를 테스트용으로 바꿔서 띄운다. */
const appEnv: Record<string, string> = { E2E_RUN_ID: RUN_ID, PORT: String(PORT) };
if (env) {
  appEnv.NEXT_PUBLIC_SUPABASE_URL = env.supabaseUrl;
  appEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.supabaseAnonKey;
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  /* 익명 로그인에는 Supabase 쪽 속도 제한이 걸려 있고, 한 여행 안에서 여러
     사람이 동시에 움직이는 시나리오라 파일 단위 병렬만 허용한다. */
  fullyParallel: false,
  workers: isCI ? 1 : 2,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },

  reporter: isCI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  },

  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testMatch: /scenario-a-.*\.spec\.ts/,
    },
  ],

  /* `next dev` 는 라우트마다 첫 진입에서 컴파일하느라 느려져, 앱 버그가 아닌
     이유로 테스트가 흔들린다. 그래서 프로덕션 빌드를 세워두고 친다. */
  /* 환경 설정이 안전하지 않으면 앱을 띄우지도 않는다 — global-setup 이
     빠진 변수 이름을 알려주며 곧바로 멈춘다. */
  webServer: env
    ? {
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: appEnv,
      }
    : undefined,
});
