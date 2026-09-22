import type { BrowserContext } from "@playwright/test";

/**
 * 이 브라우저 세션의 Supabase access token 을 쿠키에서 꺼낸다.
 *
 * 권한 테스트에서만 쓴다 — 참여자가 주최자 전용 RPC 를 직접 호출해도
 * 서버가 막는지 확인하려면 UI 를 거치지 않고 그 사람의 토큰으로 쳐야 한다.
 */
export async function accessToken(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies();
  const parts = cookies
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((c) => c.value);

  if (parts.length === 0) throw new Error("이 세션에는 Supabase 인증 쿠키가 없습니다.");

  let raw = decodeURIComponent(parts.join(""));
  if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64").toString("utf8");

  const parsed = JSON.parse(raw) as { access_token?: string };
  if (!parsed.access_token) throw new Error("인증 쿠키에 access_token 이 없습니다.");
  return parsed.access_token;
}
