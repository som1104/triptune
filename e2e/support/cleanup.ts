import { createClient } from "@supabase/supabase-js";
import { loadE2eEnv } from "./env";

/** service role 클라이언트. 키가 없으면 null — 정리를 건너뛴다. */
function admin() {
  const result = loadE2eEnv();
  if (!result.ok || !result.env.serviceRoleKey) return null;
  return createClient(result.env.supabaseUrl, result.env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 이 실행이 만든 여행을 id 로 콕 집어 지운다.
 * 제목 접두사 대신 id 를 쓰므로, 캡처용으로 제목을 깨끗하게 둔 여행도
 * 다른 데이터를 건드릴 위험 없이 정리할 수 있다.
 */
export async function cleanupTripIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = admin();
  if (!db) {
    console.warn(
      `[e2e] E2E_SUPABASE_SERVICE_ROLE_KEY 가 없어 캡처용 여행을 정리하지 못했습니다: ${ids.join(", ")}`
    );
    return;
  }
  const { error } = await db.from("trips").delete().in("id", ids);
  if (error) console.warn(`[e2e] 캡처용 여행 정리 실패: ${error.message}`);
  else console.log(`[e2e] 캡처용 여행 ${ids.length}건을 정리했습니다.`);
}

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
    const hint = /JWT/i.test(error.message)
      ? " — E2E_SUPABASE_SERVICE_ROLE_KEY 가 인증 키가 아닙니다. `npx supabase status` 의 🔑 Authentication Keys → Secret 값(sb_secret_… 또는 eyJ…)을 넣어주세요. 📦 Storage (S3) 의 Secret Key 가 아닙니다."
      : "";
    console.warn(`[e2e] 테스트 데이터 정리 실패: ${error.message}${hint}`);
    console.warn(`[e2e] 제목이 "${prefix}" 로 시작하는 여행이 남아 있습니다.`);
    return;
  }
  console.log(`[e2e] "${prefix}" 여행 ${data?.length ?? 0}건을 정리했습니다.`);
}
