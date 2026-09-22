import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------
   E2E 환경변수 로딩과 안전장치.

   테스트는 절대 운영 Supabase를 건드리면 안 된다. 그래서 앱이 쓰는
   NEXT_PUBLIC_* 를 그대로 재사용하지 않고, E2E 전용 변수를 따로 받는다.
   ------------------------------------------------------------------ */

export const ROOT = path.resolve(__dirname, "..", "..");

/** 테스트 실행마다 붙는 짧은 꼬리표. 데이터 정리와 이름 충돌 방지에 쓴다. */
export const RUN_ID: string = (process.env.E2E_RUN_ID ??= makeRunId());

function makeRunId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function parseEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** .env.test.local > .env.test 순으로 읽어 이미 있는 값은 덮지 않는다. */
function loadDotEnvTest(): void {
  for (const file of [".env.test.local", ".env.test"]) {
    for (const [k, v] of Object.entries(parseEnvFile(path.join(ROOT, file)))) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

/** 운영/개발 파일에 적힌 Supabase URL — 테스트가 이 주소를 쓰면 즉시 막는다. */
function protectedSupabaseUrls(): Set<string> {
  const urls = new Set<string>();
  for (const file of [".env.local", ".env.development.local", ".env.production", ".env.production.local"]) {
    const url = parseEnvFile(path.join(ROOT, file))["NEXT_PUBLIC_SUPABASE_URL"];
    if (url) urls.add(url.replace(/\/+$/, ""));
  }
  return urls;
}

function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

export interface E2eEnv {
  baseURL: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** 정리(teardown) 전용. 없으면 정리를 건너뛰고 남은 데이터를 알려준다. */
  serviceRoleKey: string | null;
  runId: string;
}

export type E2eEnvResult = { ok: true; env: E2eEnv } | { ok: false; problems: string[] };

let cached: E2eEnvResult | null = null;

export function loadE2eEnv(): E2eEnvResult {
  if (cached) return cached;
  loadDotEnvTest();

  const problems: string[] = [];
  const supabaseUrl = (process.env.E2E_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const supabaseAnonKey = process.env.E2E_SUPABASE_ANON_KEY ?? "";
  const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

  if (!supabaseUrl) problems.push("E2E_SUPABASE_URL — 테스트용 Supabase 주소 (예: http://127.0.0.1:54321)");
  if (!supabaseAnonKey) problems.push("E2E_SUPABASE_ANON_KEY — 테스트용 Supabase anon(publishable) 키");

  if (supabaseUrl) {
    if (protectedSupabaseUrls().has(supabaseUrl)) {
      problems.push(
        `E2E_SUPABASE_URL 이 .env.local / .env.production 에 적힌 주소와 같습니다 (${supabaseUrl}). ` +
          "자동 테스트는 운영 데이터베이스를 대상으로 실행할 수 없습니다."
      );
    } else if (!isLocalUrl(supabaseUrl) && process.env.E2E_ALLOW_REMOTE_SUPABASE !== "1") {
      problems.push(
        `E2E_SUPABASE_URL 이 로컬 주소가 아닙니다 (${supabaseUrl}). ` +
          "테스트 전용 Supabase 프로젝트가 맞다면 E2E_ALLOW_REMOTE_SUPABASE=1 을 함께 설정해 주세요."
      );
    }
  }

  cached = problems.length
    ? { ok: false, problems }
    : {
        ok: true,
        env: {
          baseURL,
          supabaseUrl,
          supabaseAnonKey,
          serviceRoleKey: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || null,
          runId: RUN_ID,
        },
      };
  return cached;
}

export function envProblemMessage(problems: string[]): string {
  return [
    "",
    "E2E 테스트를 실행할 수 없습니다. 아래 항목을 확인해 주세요:",
    ...problems.map((p) => `  • ${p}`),
    "",
    "설정 방법: 저장소 루트에 .env.test 를 만들고 .env.example 의 E2E_* 항목을 채우세요.",
    "로컬 Supabase 준비 방법은 README 의 'E2E 테스트' 절을 참고하세요.",
    "",
  ].join("\n");
}
