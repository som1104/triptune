import type { BrowserContext } from "@playwright/test";

/** 링크 미리보기는 외부 사이트를 때리므로 테스트에서는 항상 가로챈다. */
export const PREVIEW_TITLE = "E2E 목업 스테이";

export async function mockLinkPreview(context: BrowserContext): Promise<void> {
  await context.route("**/api/link-preview", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ title: PREVIEW_TITLE, image: null, siteName: "example.com", description: null }),
    })
  );
}

/** 링크 미리보기가 실패하는 상황 (봇 차단 등) 재현 — 직접 입력으로 이어져야 한다. */
export async function mockLinkPreviewFailure(context: BrowserContext, status = 502): Promise<void> {
  await context.unroute("**/api/link-preview").catch(() => {});
  await context.route("**/api/link-preview", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ error: "HTTP_ERROR", reason: "403" }),
    })
  );
}
