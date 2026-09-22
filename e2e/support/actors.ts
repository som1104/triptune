import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mockLinkPreview } from "./mocks";

export interface Actor {
  name: string;
  context: BrowserContext;
  page: Page;
  close(): Promise<void>;
}

/**
 * 한 사람 = 하나의 browser context.
 * 쿠키·localStorage·Supabase 익명 세션이 서로 완전히 분리된다.
 */
export async function newActor(browser: Browser, name: string): Promise<Actor> {
  const context = await browser.newContext();
  await mockLinkPreview(context);
  const page = await context.newPage();
  return { name, context, page, close: () => context.close() };
}

/** 두 사람의 익명 세션이 실제로 다른 사용자인지 확인한다. */
export async function assertSeparateSessions(a: Page, b: Page): Promise<void> {
  const [ca, cb] = await Promise.all([a.context().cookies(), b.context().cookies()]);
  const auth = (cookies: { name: string; value: string }[]) =>
    cookies
      .filter((c) => /^sb-.*-auth-token/.test(c.name))
      .map((c) => c.value)
      .join("|");
  expect(auth(ca)).not.toBe("");
  expect(auth(ca)).not.toBe(auth(cb));
}
