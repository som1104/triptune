import { test, expect } from "@playwright/test";
import { createTrip, getInviteLink, uniqueName } from "./helpers";

test.setTimeout(90_000);

test("초대 참여부터 그룹 합의, 숙소 등록, 투표, 최종 확정까지 전체 흐름이 끊기지 않는다", async ({
  page: host,
  browser,
}) => {
  const title = uniqueName("전체흐름");
  const tripId = await createTrip(host, { title, hostNickname: "흐름호스트", expectedParticipants: 2 });
  const inviteLink = await getInviteLink(host);

  // Guest joins.
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(inviteLink);
  await guest.getByLabel("이름 또는 닉네임").first().fill("흐름참가자");
  await guest.getByRole("button", { name: "여행에 참여하기" }).first().click();
  await guest.waitForURL(/\/respond$/);

  async function submitResponse(page: typeof host) {
    await page.getByRole("button", { name: /^1일,/ }).first().click();
    await page.getByRole("button", { name: /^2일,/ }).first().click();
    await page.getByRole("radio", { name: "꼭 필요" }).first().click();
    await page.getByRole("radio", { name: "좋아요" }).nth(1).click();
    await page.getByRole("radio", { name: "보통" }).nth(2).click();
    await page.getByRole("radio", { name: "좋아요" }).nth(3).click();
    await page.getByRole("radio", { name: "여유롭게" }).first().click();
    await page.getByRole("radio", { name: "균형 있게" }).first().click();
    await page.getByRole("button", { name: "응답 저장" }).first().click();
    await expect(page.getByText("응답이 저장되었어요.").first()).toBeVisible();
  }

  await host.goto(`/trip/${tripId}/respond`);
  await submitResponse(host);
  await submitResponse(guest);

  // Group consensus: host confirms the direction.
  await host.goto(`/trip/${tripId}/consensus`);
  await expect(host.getByText("2/2명 응답").first()).toBeVisible();
  await host.getByRole("button", { name: "이 방향으로 확정하기" }).first().click();
  await expect(host.getByText("최종 합의 완료").first()).toBeVisible();

  // Accommodation candidates.
  await host.goto(`/trip/${tripId}/stay`);
  async function addCandidate(name: string, price: string) {
    await host.getByRole("button", { name: "숙소 후보 추가" }).first().click();
    await host.getByLabel("숙소 링크").first().fill("https://example.com/room");
    await host.getByLabel("숙소 이름").first().fill(name);
    await host.getByLabel("위치").first().fill("테스트 지역");
    await host.getByLabel("총 숙박 가격 (원)").first().fill(price);
    await host.getByLabel("최대 수용 인원").first().fill("4");
    await host.getByRole("button", { name: "추가하기" }).first().click();
    await expect(host.getByText(name).first()).toBeVisible();
  }
  await addCandidate("흐름 게스트하우스", "200000");
  await addCandidate("흐름 호텔", "400000");

  // Start voting.
  await host.getByRole("button", { name: "숙소 투표 시작하기" }).first().click();
  await host.getByRole("button", { name: "투표 시작", exact: true }).first().click();
  await expect(host.getByRole("heading", { name: "숙소 투표 중" }).first()).toBeVisible();

  // Both vote for the same candidate.
  await host.getByRole("radio", { name: /흐름 게스트하우스/ }).first().click();
  await host.getByRole("button", { name: "투표하기" }).first().click();
  await expect(host.getByText("투표했어요.").first()).toBeVisible();

  await guest.goto(`/trip/${tripId}/stay`);
  await expect(guest.getByRole("heading", { name: "숙소 투표 중" }).first()).toBeVisible();
  await guest.getByRole("radio", { name: /흐름 게스트하우스/ }).first().click();
  await guest.getByRole("button", { name: "투표하기" }).first().click();
  await expect(guest.getByText("투표했어요.").first()).toBeVisible();

  // Voting auto-closes once everyone has voted.
  await host.reload();
  await expect(host.getByText("투표 결과").first()).toBeVisible({ timeout: 10_000 });
  await expect(host.getByText("그룹 1순위").first()).toBeVisible();

  await host
    .getByRole("button", { name: "이 숙소로 확정하기" })
    .first()
    .click();
  await host.getByRole("button", { name: "확정하기", exact: true }).first().click();

  // Final trip screen.
  await host.goto(`/trip/${tripId}`);
  await expect(host.getByText("여행이 확정됐어요!").first()).toBeVisible();
  await expect(host.getByText("흐름 게스트하우스").first()).toBeVisible();

  await guestContext.close();
});
