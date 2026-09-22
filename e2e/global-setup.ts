import { envProblemMessage, loadE2eEnv } from "./support/env";

/** 테스트가 한 줄이라도 돌기 전에, 설정이 안전한지 먼저 확인한다. */
export default async function globalSetup(): Promise<void> {
  const result = loadE2eEnv();
  if (!result.ok) {
    throw new Error(envProblemMessage(result.problems));
  }
  console.log(`[e2e] run id: ${result.env.runId} · supabase: ${result.env.supabaseUrl}`);
}
