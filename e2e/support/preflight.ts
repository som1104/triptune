import type { E2eEnv } from "./env";

/* ------------------------------------------------------------------
   테스트를 시작하기 전에 테스트용 Supabase 가 실제로 쓸 수 있는 상태인지
   확인한다. 여기서 걸러내지 않으면 브라우저가 90초 타임아웃으로 죽고,
   원인은 trace 를 열어봐야 알게 된다.
   ------------------------------------------------------------------ */

const TIMEOUT_MS = 8000;

function headers(apikey: string): Record<string, string> {
  return { apikey, Authorization: `Bearer ${apikey}`, "Content-Type": "application/json" };
}

async function body(res: Response): Promise<string> {
  return (await res.text().catch(() => "")).slice(0, 300);
}

export async function preflight(env: E2eEnv): Promise<string[]> {
  const { supabaseUrl, supabaseAnonKey } = env;
  const problems: string[] = [];
  const opts = { headers: headers(supabaseAnonKey), signal: AbortSignal.timeout(TIMEOUT_MS) };

  // 1) 서버가 살아 있는지 + 익명 로그인이 켜져 있는지
  let settings: { external?: Record<string, boolean> };
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, opts);
    if (res.status === 401 || res.status === 403) {
      return [
        `E2E_SUPABASE_ANON_KEY 가 이 프로젝트의 키가 아닙니다 (${res.status}).\n` +
          "    `npx supabase status` 의 🔑 Authentication Keys → Publishable 값을 넣어주세요\n" +
          "    (sb_publishable_… 또는 eyJ…). 📦 Storage (S3) 의 Access Key 가 아닙니다.",
      ];
    }
    if (!res.ok) return [`${supabaseUrl}/auth/v1/settings 가 ${res.status} 를 돌려줬습니다.`];
    settings = (await res.json()) as { external?: Record<string, boolean> };
  } catch {
    return [
      `${supabaseUrl} 에 연결할 수 없습니다.\n` +
        "    로컬 Supabase 라면 Docker Desktop 이 실행 중인지 확인하고 `npx supabase start` 를 실행해 주세요.\n" +
        "    (상태 확인: `npx supabase status`)",
    ];
  }

  if (settings.external?.anonymous_users !== true) {
    problems.push(
      "이 Supabase 프로젝트에 익명 로그인이 꺼져 있습니다. TRIPTUNE 은 익명 로그인으로 참여하므로 반드시 켜야 합니다.\n" +
        "    로컬: supabase/config.toml 의 [auth] 아래 `enable_anonymous_sign_ins = true` 로 바꾼 뒤 `npx supabase stop && npx supabase start`\n" +
        "    원격: Authentication → Sign In / Providers → Anonymous Sign-Ins 활성화"
    );
  }

  // 2) 세션 없는 읽기가 되는지 — 초대 화면이 정확히 이 경로로 그려진다
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/trips?select=id&limit=1`, opts);
    if (!res.ok) {
      const text = await body(res);
      problems.push(
        /JWT/i.test(text)
          ? "E2E_SUPABASE_ANON_KEY 를 REST 가 인증 키로 읽지 못합니다.\n" +
            `    (${res.status} ${text})\n` +
            "    `npx supabase status` 의 🔑 Authentication Keys → Publishable 값을 넣어주세요\n" +
            "    (sb_publishable_… 또는 eyJ…). 📦 Storage (S3) 의 Access Key 를 넣으면 이 오류가 납니다."
          : `세션 없이 /rest/v1/trips 를 읽지 못했습니다 (${res.status} ${text}).`
      );
      return problems;
    }
  } catch {
    problems.push(`${supabaseUrl}/rest/v1/trips 조회가 실패했습니다.`);
    return problems;
  }

  // 3) 마이그레이션이 끝까지 적용됐는지 — 가장 늦게 생긴 테이블로 확인한다
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/trip_reopenings?select=id&limit=1`, opts);
    if (res.status === 404) {
      problems.push(
        "테스트 데이터베이스에 trip_reopenings 테이블이 없습니다 — 마이그레이션이 끝까지 적용되지 않았습니다.\n" +
          "    supabase/migrations/ 를 번호순으로 모두 적용해 주세요.\n" +
          "    로컬: `npx supabase db reset` / 원격: SQL Editor 에서 순서대로 실행"
      );
    }
  } catch {
    /* 위 단계에서 이미 걸렀다 */
  }

  // 4) 세션 없는 초대 화면 — anon 역할이 get_trip_invite_info 를 실행할 수 있어야 한다.
  //    처음 초대 링크를 여는 사람에게는 세션이 없으므로 이 권한이 없으면
  //    초대 화면이 통째로 "초대 링크를 찾을 수 없어요."가 된다.
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_trip_invite_info`, {
      method: "POST",
      headers: headers(supabaseAnonKey),
      body: JSON.stringify({ p_invite_token: "preflight-no-such-token" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      problems.push(
        `세션이 없는 상태에서 get_trip_invite_info 를 실행할 수 없습니다 (${res.status}).\n` +
          "    초대 링크를 처음 여는 사람은 아직 로그인 전이라, 이 권한이 없으면 초대 화면이 뜨지 않습니다.\n" +
          "    supabase/migrations/0009_invite_info_for_anon.sql 을 적용해 주세요."
      );
    }
  } catch {
    problems.push("get_trip_invite_info 실행 확인에 실패했습니다.");
  }

  return problems;
}
