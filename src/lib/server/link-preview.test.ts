import { describe, expect, it } from "vitest";
import { decodeEntities, extractMeta, parsePreview } from "./link-preview";

const BASE = new URL("https://nol.example.com/stay/123?a=1");

describe("extractMeta", () => {
  it("reads property=… content=… in that order", () => {
    expect(extractMeta(`<meta property="og:title" content="제주 호텔">`, "og:title")).toBe("제주 호텔");
  });

  it("reads content=… property=… in the reverse order", () => {
    expect(extractMeta(`<meta content="제주 호텔" property="og:title">`, "og:title")).toBe("제주 호텔");
  });

  it("reads name=… as well, which is how twitter tags are written", () => {
    expect(extractMeta(`<meta name="twitter:image" content="https://i/x.jpg">`, "twitter:image")).toBe(
      "https://i/x.jpg"
    );
  });

  it("returns null when the tag is absent", () => {
    expect(extractMeta(`<meta property="og:description" content="x">`, "og:title")).toBeNull();
  });
});

describe("parsePreview", () => {
  it("prefers og:title over the title tag", () => {
    const html = `<title>사이트 이름</title><meta property="og:title" content="제주 오션뷰 호텔">`;
    expect(parsePreview(html, BASE).title).toBe("제주 오션뷰 호텔");
  });

  it("falls back to twitter:title, then the title tag", () => {
    expect(parsePreview(`<meta name="twitter:title" content="트위터 제목">`, BASE).title).toBe("트위터 제목");
    expect(parsePreview(`<title>타이틀 태그</title>`, BASE).title).toBe("타이틀 태그");
  });

  it("collapses whitespace in a multi-line title tag", () => {
    expect(parsePreview("<title>\n  제주\n  호텔\n</title>", BASE).title).toBe("제주 호텔");
  });

  it("resolves a relative og:image against the final url", () => {
    const html = `<meta property="og:image" content="/img/a.jpg">`;
    expect(parsePreview(html, BASE).image).toBe("https://nol.example.com/img/a.jpg");
  });

  it("keeps an absolute og:image as-is and un-escapes its query", () => {
    const html = `<meta property="og:image" content="https://cdn.x/a.jpg?w=1&amp;h=2">`;
    expect(parsePreview(html, BASE).image).toBe("https://cdn.x/a.jpg?w=1&h=2");
  });

  it("falls back to twitter:image when og:image is missing", () => {
    const html = `<meta name="twitter:image" content="https://cdn.x/t.jpg">`;
    expect(parsePreview(html, BASE).image).toBe("https://cdn.x/t.jpg");
  });

  it("returns nulls rather than throwing on a page with no tags", () => {
    const parsed = parsePreview("<html><body>없음</body></html>", BASE);
    expect(parsed.title).toBeNull();
    expect(parsed.image).toBeNull();
    expect(parsed.siteName).toBe("nol.example.com");
  });

  it("uses og:site_name when present", () => {
    expect(parsePreview(`<meta property="og:site_name" content="NOL">`, BASE).siteName).toBe("NOL");
  });
});

describe("decodeEntities", () => {
  it("un-escapes &amp; last so &amp;lt; does not become <", () => {
    expect(decodeEntities("a &amp;lt; b")).toBe("a &lt; b");
  });

  it("handles the quote and space entities a title tag usually carries", () => {
    expect(decodeEntities("&quot;제주&quot;&nbsp;호텔 &#39;A&#39;")).toBe('"제주" 호텔 \'A\'');
  });
});
