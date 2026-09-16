import { NextResponse } from "next/server";
import { assertSafeExternalUrl } from "@/lib/server/ssrf-guard";

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 1_000_000; // 1MB cap on the response body we read
const MAX_REDIRECTS = 3;

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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
        headers: { "User-Agent": "TriptuneLinkPreview/1.0" },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("FETCH_FAILED");
      const nextUrl = new URL(location, currentUrl);
      currentUrl = await assertSafeExternalUrl(nextUrl.toString());
      continue;
    }

    if (!res.ok) throw new Error("FETCH_FAILED");

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error("NOT_HTML");

    const reader = res.body?.getReader();
    if (!reader) throw new Error("FETCH_FAILED");

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

  throw new Error("TOO_MANY_REDIRECTS");
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
  } catch {
    return NextResponse.json({ error: "BLOCKED_URL" }, { status: 400 });
  }

  try {
    const { html, finalUrl } = await fetchWithLimits(safeUrl);

    const ogTitle = extractMeta(html, "og:title");
    const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = ogTitle ?? (titleTagMatch ? titleTagMatch[1] : null);

    const image = extractMeta(html, "og:image");
    const siteName = extractMeta(html, "og:site_name") ?? finalUrl.hostname;

    return NextResponse.json({
      title: title ? decodeEntities(title).trim() : null,
      image: image ? new URL(image, finalUrl).toString() : null,
      siteName,
    });
  } catch {
    return NextResponse.json({ error: "FETCH_FAILED" }, { status: 502 });
  }
}
