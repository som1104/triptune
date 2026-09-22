import { NextResponse } from "next/server";
import { assertSafeExternalUrl } from "@/lib/server/ssrf-guard";
import { parsePreview } from "@/lib/server/link-preview";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_000_000; // 1MB cap on the response body we read
const MAX_REDIRECTS = 5;

/* 많은 상용 사이트가 정체불명의 User-Agent 를 403 이나 봇 페이지로 돌려보낸다.
   og 태그는 원래 크롤러가 읽으라고 있는 것이므로 평범한 브라우저처럼 요청한다. */
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36 TriptuneLinkPreview/1.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
} as const;

/** 왜 실패했는지 화면까지 전달한다 — 원인을 삼키면 매번 처음부터 추측하게 된다. */
class PreviewError extends Error {
  constructor(
    public code: string,
    public detail?: string
  ) {
    super(code);
  }
}

async function fetchWithLimits(startUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: REQUEST_HEADERS,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new PreviewError(aborted ? "TIMEOUT" : "NETWORK_ERROR");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new PreviewError("FETCH_FAILED", `${res.status} without location`);
      const nextUrl = new URL(location, currentUrl);
      currentUrl = await assertSafeExternalUrl(nextUrl.toString());
      continue;
    }

    // 403/429 는 대개 봇 차단이다. 사용자가 직접 입력하면 되는 상황이므로
    // 상태 코드를 그대로 올려보낸다.
    if (!res.ok) throw new PreviewError("HTTP_ERROR", String(res.status));

    // content-type 이 비어 있는 서버도 있다. 있는데 HTML 계열이 아닐 때만 거른다.
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType && !/text\/html|application\/xhtml/.test(contentType)) {
      throw new PreviewError("NOT_HTML", contentType.split(";")[0]);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new PreviewError("FETCH_FAILED", "empty body");

    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString("utf-8");
    return { html, finalUrl: currentUrl };
  }

  throw new PreviewError("TOO_MANY_REDIRECTS");
}

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  let safeUrl: URL;
  try {
    safeUrl = await assertSafeExternalUrl(body.url);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "BLOCKED_URL";
    return NextResponse.json({ error: "BLOCKED_URL", reason }, { status: 400 });
  }

  try {
    const { html, finalUrl } = await fetchWithLimits(safeUrl);

    return NextResponse.json(parsePreview(html, finalUrl));
  } catch (err) {
    const code = err instanceof PreviewError ? err.code : "FETCH_FAILED";
    const detail = err instanceof PreviewError ? err.detail : undefined;
    console.error("[link-preview]", safeUrl.href, code, detail ?? "");
    return NextResponse.json({ error: code, reason: detail }, { status: 502 });
  }
}
