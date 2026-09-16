import { test, expect } from "@playwright/test";
import { createTrip, getInviteLink, uniqueName } from "./helpers";

test("주최자가 여행을 생성하면 초대 화면으로 이동하고 참여자 목록에 자동 등록된다", async ({ page }) => {
  const title = uniqueName("생성테스트");
  await createTrip(page, { title, hostNickname: "생성호스트" });

  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("초대 링크").first()).toBeVisible();
  await expect(page.getByText("생성호스트").first()).toBeVisible();
  await expect(page.getByText("주최자").first()).toBeVisible();
});

test("초대 링크로 다른 브라우저에서 참여하면 호스트 화면에 실시간으로 반영된다", async ({ page, browser }) => {
  const title = uniqueName("참여테스트");
  await createTrip(page, { title, hostNickname: "참여호스트", expectedParticipants: 4 });
  const inviteLink = await getInviteLink(page);

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(inviteLink);
  await expect(guestPage.getByText(title, { exact: true }).first()).toBeVisible();

  await guestPage.getByLabel("이름 또는 닉네임").first().fill("게스트참여자");
  await guestPage.getByRole("button", { name: "여행에 참여하기" }).first().click();
  await guestPage.waitForURL(/\/respond$/, { timeout: 15_000 });

  // Realtime should push the new participant into the host's roster without a reload.
  await expect(page.getByText("게스트참여자").first()).toBeVisible({ timeout: 10_000 });

  await guestContext.close();
});

test("같은 여행 안에서 닉네임이 중복되면 참여가 거부된다", async ({ page, browser }) => {
  const title = uniqueName("중복테스트");
  await createTrip(page, { title, hostNickname: "중복호스트", expectedParticipants: 4 });
  const inviteLink = await getInviteLink(page);

  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await page1.goto(inviteLink);
  await page1.getByLabel("이름 또는 닉네임").first().fill("겹치는이름");
  await page1.getByRole("button", { name: "여행에 참여하기" }).first().click();
  await page1.waitForURL(/\/respond$/);

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(inviteLink);
  await page2.getByLabel("이름 또는 닉네임").first().fill("겹치는이름");
  await page2.getByRole("button", { name: "여행에 참여하기" }).first().click();

  await expect(page2.getByText("이미 사용 중인 이름이에요.").first()).toBeVisible();
  // Must not have navigated away.
  await expect(page2).toHaveURL(/\/join\//);

  await context1.close();
  await context2.close();
});

test("날짜·취향 응답은 저장 후 새로고침해도 유지된다", async ({ page }) => {
  const title = uniqueName("저장테스트");
  const tripId = await createTrip(page, { title, hostNickname: "저장호스트" });
  await page.goto(`/trip/${tripId}/respond`);

  // First tap -> tentative, second tap -> available (미정 -> 가능 cycle).
  await page.getByRole("button", { name: /^1일,/ }).first().click();
  await page.getByRole("button", { name: /^1일,/ }).first().click();
  await page.getByRole("radio", { name: "꼭 필요" }).first().click();
  await page.getByRole("radio", { name: "좋아요" }).nth(1).click();
  await page.getByRole("radio", { name: "보통" }).nth(2).click();
  await page.getByRole("radio", { name: "별로" }).nth(3).click();
  await page.getByRole("radio", { name: "여유롭게" }).first().click();
  await page.getByRole("radio", { name: "균형 있게" }).first().click();

  await page.getByRole("button", { name: "응답 저장" }).first().click();
  await expect(page.getByText("응답이 저장되었어요.").first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /^1일, 가능/ }).first()).toBeVisible();
  await expect(page.getByRole("radio", { name: "여유롭게" }).first()).toHaveAttribute("aria-checked", "true");
});
