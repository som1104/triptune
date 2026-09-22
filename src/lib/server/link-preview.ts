/* 링크 미리보기에서 HTML 을 읽는 부분만 따로 뒀다 — 네트워크 없이 테스트할 수
   있고, route 는 가져오기와 오류 처리에만 집중한다. */

/** og:*, twitter:*, 일반 meta 를 property / name 양쪽 표기로 찾는다. */
export function extractMeta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // 마지막에 — &amp;lt; 가 < 로 두 번 풀리지 않도록
}

export interface LinkPreview {
  title: string | null;
  image: string | null;
  siteName: string;
}

/** og:title → twitter:title → <title>, og:image → twitter:image 순으로 본다. */
export function parsePreview(html: string, finalUrl: URL): LinkPreview {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle =
    extractMeta(html, "og:title") ??
    extractMeta(html, "twitter:title") ??
    (titleTag ? titleTag[1] : null);

  const rawImage = extractMeta(html, "og:image") ?? extractMeta(html, "twitter:image");

  let image: string | null = null;
  if (rawImage) {
    try {
      image = new URL(decodeEntities(rawImage), finalUrl).toString();
    } catch {
      image = null; // 상대 주소도 아니고 절대 주소도 아니면 버린다
    }
  }

  return {
    title: rawTitle ? decodeEntities(rawTitle).replace(/\s+/g, " ").trim() || null : null,
    image,
    siteName: extractMeta(html, "og:site_name") ?? finalUrl.hostname,
  };
}
