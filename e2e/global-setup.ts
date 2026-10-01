import { envProblemMessage, loadE2eEnv } from "./support/env";
import { preflight } from "./support/preflight";

/** 테스트가 한 줄이라도 돌기 전에, 설정과 테스트 DB 상태를 먼저 확인한다. */
export default async function globalSetup(): Promise<void> {
  const result = loadE2eEnv();
  if (!result.ok) throw new Error(envProblemMessage(result.problems));

  const problems = await preflight(result.env);
  if (problems.length) throw new Error(envProblemMessage(problems));

  console.log(`[e2e] run id: ${result.env.runId} · supabase: ${result.env.supabaseUrl}`);
}
