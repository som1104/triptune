import { expect, test } from "@playwright/test";
import { newActor, type Actor } from "./support/actors";
import { button, text } from "./support/ui";
import {
  addStay,
  castVote,
  confirmDirection,
  confirmFinalStay,
  createTrip,
  fillStaySheet,
  joinTrip,
  startVoting,
  submitResponse,
  type CreatedTrip,
} from "./support/flows";

/* 시나리오 B — 숙소 후보 등록과 투표, 최종 확정.
   각 테스트가 스스로 필요한 상태를 만든다 (실행 순서에 기대지 않는다). */

async function seedConfirmedDirection(
  browser: Parameters<typeof newActor>[0],
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

  return { host, guest, trip };
}

test("B. 예약안 등록 → 투표 → 실시간 반영 → 주최자 확정", async ({ browser }) => {
  const { host, guest, trip } = await seedConfirmedDirection(browser, "숙소");

  try {
    await test.step("숙소 전체 사용 예약안을 등록한다", async () => {
      await addStay(host.page, {
        mode: "whole",
        name: "통째로 빌리는 집",
        capacity: 4,
        totalPrice: 400000,
      });
      await expect(text(host.page, /숙소 전체 사용 · 최대 4명/)).toBeVisible();
    });

    await test.step("객실 여러 개 예약안은 객실 수·인원·금액을 스스로 계산한다", async () => {
      await fillStaySheet(host.page, {
        mode: "rooms",
        name: "객실 나눠쓰는 호텔",
        rooms: [
          { name: "디럭스 트윈", count: 2, capacityPerRoom: 2, pricePerRoom: 120000 },
          { name: "온돌", count: 1, capacityPerRoom: 4, pricePerRoom: 150000 },
        ],
      });

      // 객실 3개 · 최대 8명 · 총 390,000원 · 1인 약 195,000원 (확정 인원 2명)
      await expect(text(host.page, "객실 3개 · 최대 8명")).toBeVisible();
      await expect(text(host.page, /총 390,000원/)).toBeVisible();
      await expect(text(host.page, /1인 약 195,000원/)).toBeVisible();

      await button(host.page, "후보로 등록하기").click();
      await expect(text(host.page, "객실 나눠쓰는 호텔")).toBeVisible({ timeout: 15_000 });
    });

    await test.step("수용 인원이 참여 인원보다 적으면 등록할 수 없다", async () => {
      await fillStaySheet(host.page, { mode: "whole", name: "너무 작은 집", capacity: 1, totalPrice: 50000 });
      await expect(text(host.page, /1명을 더 수용할 수 있는 객실이 필요해요/)).toBeVisible();
      await expect(button(host.page, "후보로 등록하기")).toBeDisabled();
      await host.page.keyboard.press("Escape");
      await expect(host.page.getByText("너무 작은 집")).toHaveCount(0);
    });

    await test.step("투표를 시작하고 두 사람이 서로 다른 숙소에 투표한다", async () => {
      await startVoting(host.page);
      await castVote(host.page, "통째로 빌리는 집");

      await guest.page.goto(`/trip/${trip.id}/stay`);
      await expect(guest.page.getByRole("heading", { name: "숙소 투표 중" })).toBeVisible();
      await castVote(guest.page, "객실 나눠쓰는 호텔");
    });

    await test.step("모두 투표하면 결과가 새로고침 없이 열린다", async () => {
      await expect(text(host.page, "투표 결과")).toBeVisible({ timeout: 25_000 });
      await expect(text(host.page, /표가 같아요/)).toBeVisible();
    });

    await test.step("참여자에게는 최종 확정 버튼이 없다", async () => {
      await guest.page.reload();
      await expect(text(guest.page, "투표 결과")).toBeVisible({ timeout: 20_000 });
      await expect(guest.page.getByRole("button", { name: "이 숙소로 확정하기" })).toHaveCount(0);
    });

    await test.step("주최자가 확정하면 최종 여행 정보가 보인다", async () => {
      await confirmFinalStay(host.page);
      await host.page.goto(`/trip/${trip.id}`);
      await expect(text(host.page, /여행이 확정됐어요!/)).toBeVisible();
      await expect(text(host.page, "확정된 숙소")).toBeVisible();
    });
  } finally {
    await Promise.all([host.close(), guest.close()]);
  }
});

test("B2. 표가 하나도 없으면 확정할 수 없고 되돌릴 길이 있다", async ({ browser }) => {
  const { host, guest } = await seedConfirmedDirection(browser, "무표");

  try {
    await addStay(host.page, { mode: "whole", name: "아무도 안 뽑은 집", capacity: 4, totalPrice: 300000 });
    await startVoting(host.page);
    await button(host.page, /지금 투표 마감|투표 종료하기/).click();
    await button(host.page, "투표 종료", true).click();

    await expect(text(host.page, "아직 투표가 없어요.")).toBeVisible({ timeout: 20_000 });
    await expect(host.page.getByRole("button", { name: "이 숙소로 확정하기" })).toHaveCount(0);
    await expect(button(host.page, "투표 다시 열기")).toBeVisible();
    await expect(button(host.page, "후보 다시 모으기")).toBeVisible();
  } finally {
    await Promise.all([host.close(), guest.close()]);
  }
});
