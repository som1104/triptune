import { createClient } from "@supabase/supabase-js";
import { loadE2eEnv } from "./env";

/**
 * 이 실행이 만든 여행만 지운다.
 *
 * - 대상은 언제나 `[E2E-<runId>]` 로 시작하는 제목뿐이다. 테이블 전체를 비우거나
 *   접두사 없는 데이터를 건드리는 경로는 이 파일에 존재하지 않는다.
 * - service role 키는 Node 쪽에서만 쓰이고 브라우저나 리포트로 나가지 않는다.
 * - 키가 없으면 지우지 않고, 남은 데이터를 화면에 알려준다.
 */
export async function cleanupRunData(): Promise<void> {
  const result = loadE2eEnv();
  if (!result.ok) return;
  const { supabaseUrl, serviceRoleKey, runId } = result.env;
  const prefix = `[E2E-${runId}]`;

  if (!serviceRoleKey) {
    console.warn(
      `\n[e2e] E2E_SUPABASE_SERVICE_ROLE_KEY 가 없어 테스트 데이터를 정리하지 않았습니다.\n` +
        `[e2e] 제목이 "${prefix}" 로 시작하는 여행을 직접 지워주세요.\n`
    );
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // like 의 와일드카드를 접두사 뒤에만 붙인다 — 접두사 자체는 이스케이프한다.
  const pattern = `${prefix.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await admin.from("trips").delete().like("title", pattern).select("id");

  if (error) {
    console.warn(`[e2e] 테스트 데이터 정리 실패: ${error.message}`);
    return;
  }
  console.log(`[e2e] "${prefix}" 여행 ${data?.length ?? 0}건을 정리했습니다.`);
}
