import { expect, test, type Browser } from "@playwright/test";
import { newActor, type Actor } from "./support/actors";
import { button, text } from "./support/ui";
import {
  addStay,
  castVote,
  confirmDirection,
  confirmFinalStay,
  createTrip,
  joinTrip,
  reopen,
  startVoting,
  submitResponse,
  type CreatedTrip,
} from "./support/flows";

/* 시나리오 C — 최종 확정 이후 주최자가 필요한 단계만 다시 연다. */

const STAY_A = "재개용 게스트하우스";
const STAY_B = "재개용 호텔";

async function seedConfirmedTrip(
  browser: Browser,
  name: string
): Promise<{ host: Actor; guest: Actor; trip: CreatedTrip }> {
  const host = await newActor(browser, "host");
  const guest = await newActor(browser, "guest");

  const trip = await createTrip(host.page, { name, hostNickname: "호스트", participants: 2, nights: 2 });
  await joinTrip(guest.page, trip.inviteLink, "손님");

  const days = trip.range.days;
  await host.page.goto(`/trip/${trip.id}/respond`);
  await submitResponse(host.page, trip.id, { availableDays: [days[0], days[1], days[2]] });
  await guest.page.goto(`/trip/${trip.id}/respond`);
  await submitResponse(guest.page, trip.id, { availableDays: [days[0], days[1], days[2]] });

  await host.page.goto(`/trip/${trip.id}/consensus`);
  await confirmDirection(host.page);

  await host.page.goto(`/trip/${trip.id}/stay`);
  await addStay(host.page, { mode: "whole", name: STAY_A, capacity: 4, totalPrice: 300000 });
  await addStay(host.page, { mode: "whole", name: STAY_B, capacity: 4, totalPrice: 500000 });
  await startVoting(host.page);
  await castVote(host.page, STAY_A);

  await guest.page.goto(`/trip/${trip.id}/stay`);
  await castVote(guest.page, STAY_A);

  await expect(text(host.page, "투표 결과")).toBeVisible({ timeout: 25_000 });
  await confirmFinalStay(host.page);

  return { host, guest, trip };
}

test("C1. 숙소 투표만 다시 열면 날짜·취향 합의는 그대로 남는다", async ({ browser }) => {
  const { host, guest, trip } = await seedConfirmedTrip(browser, "재개1");

  try {
    await test.step("참여자에게는 재개 버튼이 보이지 않는다", async () => {
      await guest.page.goto(`/trip/${trip.id}`);
      await expect(guest.page.getByText(/여행이 확정됐어요!/).first()).toBeVisible();
      await expect(guest.page.getByRole("button", { name: "조율 다시 열기" })).toHaveCount(0);
    });

    await test.step("주최자가 숙소 투표만 다시 연다", async () => {
      await host.page.goto(`/trip/${trip.id}`);
      await expect(button(host.page, "조율 다시 열기")).toBeVisible();
      await reopen(host.page, "숙소 투표만 다시 열기", "예약이 취소됐어요");
      await host.page.waitForURL(new RegExp(`/trip/${trip.id}/stay$`), { timeout: 20_000 });
    });

    await test.step("숙소 확정만 풀리고 후보와 투표는 그대로다", async () => {
      await expect(host.page.getByRole("heading", { name: "숙소 투표 중" })).toBeVisible({ timeout: 20_000 });
      await expect(text(host.page, STAY_A)).toBeVisible();
      await expect(text(host.page, STAY_B)).toBeVisible();
      // 기존 투표가 남아 있으므로 '내 투표 변경'이 보인다.
      await expect(button(host.page, "내 투표 변경")).toBeVisible();
    });

    await test.step("날짜·취향 합의는 확정된 그대로 남아 있다", async () => {
      await host.page.goto(`/trip/${trip.id}/consensus`);
      await expect(text(host.page, "최종 합의", true)).toBeVisible();
    });

    await test.step("다른 브라우저에도 새로고침 없이 반영된다", async () => {
      await expect(text(guest.page, /다시 열렸어요|재조율|다시 열기/)).toBeVisible({ timeout: 25_000 });
    });
  } finally {
    await Promise.all([host.close(), guest.close()]);
  }
});

test("C2. 날짜·취향부터 다시 열면 응답은 남고 숙소는 재검토 상태가 된다", async ({ browser }) => {
  const { host, guest, trip } = await seedConfirmedTrip(browser, "재개2");

  try {
    await test.step("주최자가 날짜·취향부터 다시 연다", async () => {
      await host.page.goto(`/trip/${trip.id}`);
      await reopen(host.page, "날짜·취향 조율부터 다시 열기", "일정이 바뀌었어요");
      await host.page.waitForURL(new RegExp(`/trip/${trip.id}/consensus$`), { timeout: 20_000 });
    });

    await test.step("합의 화면이 다시 수집 상태로 돌아온다", async () => {
      await expect(text(host.page, /명 응답/)).toBeVisible({ timeout: 20_000 });
      await expect(button(host.page, "이 방향으로 확정하기")).toBeVisible();
    });

    await test.step("기존 응답은 지워지지 않고 수정할 수 있다", async () => {
      await guest.page.goto(`/trip/${trip.id}/respond`);
      const day = trip.range.days[0];
      await expect(button(guest.page, `${day}일, 가능`, true)).toBeVisible({ timeout: 20_000 });

      // 다른 날짜를 불가로 바꿔 다시 저장한다.
      await guest.page
        .getByRole("radiogroup", { name: "표시할 상태" })
        .getByRole("radio", { name: "불가", exact: true })
        .click();
      await button(guest.page, new RegExp(`^${trip.range.days[2]}일, `)).click();
      await button(guest.page, "응답 저장").click();
      await guest.page.waitForURL(new RegExp(`/trip/${trip.id}/consensus$`), { timeout: 20_000 });
    });

    await test.step("바뀐 응답이 주최자 화면에 새로고침 없이 반영된다", async () => {
      await expect(text(host.page, "조율 필요")).toBeVisible({ timeout: 25_000 });
    });

    await test.step("숙소 후보는 삭제되지 않고 남아 있다", async () => {
      await host.page.goto(`/trip/${trip.id}/stay`);
      await expect(text(host.page, STAY_A)).toBeVisible({ timeout: 20_000 });
      await expect(text(host.page, STAY_B)).toBeVisible();
    });

    await test.step("참여자에게 재개 안내와 사유가 보인다", async () => {
      await guest.page.reload();
      await expect(text(guest.page, /일정이 바뀌었어요/)).toBeVisible({ timeout: 20_000 });
    });
  } finally {
    await Promise.all([host.close(), guest.close()]);
  }
});
