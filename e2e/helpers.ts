import { expect, type Page } from "@playwright/test";

export function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36).slice(-6)}`;
}

/** Fills and submits the create-trip form (screen 01), waits for the redirect to /trip/[id]. */
export async function createTrip(
  page: Page,
  opts: { title: string; destination?: string; hostNickname?: string; expectedParticipants?: number }
): Promise<string> {
  await page.goto("/");
  await page.getByLabel("여행 이름").first().fill(opts.title);
  await page.getByLabel("목적지").first().fill(opts.destination ?? "제주도");
  await page.getByLabel("주최자 닉네임").first().fill(opts.hostNickname ?? "호스트");
  await page.getByLabel("후보 기간 시작일").first().fill("2026-10-01");
  await page.getByLabel("후보 기간 종료일").first().fill("2026-10-10");

  if (opts.expectedParticipants) {
    await page.getByRole("radio", { name: `${opts.expectedParticipants}명`, exact: true }).first().click();
  }

  await page.getByRole("button", { name: "여행 만들기" }).first().click();
  await page.waitForURL(/\/trip\/[0-9a-f-]+$/, { timeout: 15_000 });
  const url = page.url();
  return url.match(/\/trip\/([0-9a-f-]+)/)![1];
}

export async function getInviteLink(page: Page): Promise<string> {
  // The card renders a "..." placeholder until its effect fills in the real
  // window.location.origin URL — wait for that, or callers race the effect.
  const locator = page.getByText(/^https?:\/\/.*\/join\//).first();
  await expect(locator).toBeVisible();
  const text = await locator.innerText();
  return text.trim();
}
