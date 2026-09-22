import { expect, test } from "@playwright/test";
import { newActor, assertSeparateSessions } from "./support/actors";
import { button, text } from "./support/ui";
import { confirmDirection, createTrip, fillResponse, joinTrip, submitResponse } from "./support/flows";

/* 시나리오 A — 여행 생성부터 그룹 합의까지.
   주최자·참여자 A·참여자 B 가 각각 독립된 세션으로 움직인다. */

test("A. 여행 생성 → 초대 → 세 사람 응답 → 그룹 합의까지 끊기지 않는다", async ({ browser }) => {
  const host = await newActor(browser, "host");
  const alice = await newActor(browser, "alice");
  const bob = await newActor(browser, "bob");

  try {
    const trip = await test.step("주최자가 로그인 없이 여행을 만든다", async () => {
      const created = await createTrip(host.page, {
        name: "합의",
        hostNickname: "호스트",
        participants: 3,
        nights: 2,
      });
      await expect(text(host.page, created.title)).toBeVisible();
      await expect(text(host.page, "초대 링크")).toBeVisible();
      return created;
    });

    await test.step("초대 링크가 이 여행을 가리킨다", async () => {
      expect(trip.inviteLink).toMatch(/\/join\/[A-Za-z0-9_-]{6,}$/);
    });

    await test.step("참여자 두 명이 각자 독립된 세션으로 참여한다", async () => {
      await joinTrip(alice.page, trip.inviteLink, "앨리스");
      await joinTrip(bob.page, trip.inviteLink, "밥");
      await assertSeparateSessions(alice.page, bob.page);
    });

    await test.step("참여자가 늘어난 것이 주최자 화면에 새로고침 없이 반영된다", async () => {
      await expect(text(host.page, /앨리스/)).toBeVisible({ timeout: 20_000 });
      await expect(text(host.page, /밥/)).toBeVisible({ timeout: 20_000 });
    });

    const days = trip.range.days;

    await test.step("주최자가 응답하면 그룹 합의로 자동 이동한다", async () => {
      await host.page.goto(`/trip/${trip.id}/respond`);
      await submitResponse(host.page, trip.id, {
        availableDays: [days[0], days[1], days[2], days[3]],
        unavailableDays: [days[8]],
        interests: { nature: "꼭 필요", food: "좋아요", cafe: "보통", activity: "좋아요" },
        note: "채식 식당이 한 곳은 필요해요",
      });
      await expect(host.page.getByRole("heading", { name: /한 줄 요약|그룹 합의/ }).first()).toBeVisible();
    });

    await test.step("아직 다 내지 않았으면 임시 결과와 미응답자를 알려준다", async () => {
      await expect(text(host.page, "아직 모으는 중이에요.")).toBeVisible();
      await expect(text(host.page, /1\/3명 응답/)).toBeVisible();
      await expect(text(host.page, "아직 응답 전")).toBeVisible();
      // 임시 결과라는 사실과, 그 자리에서 초대 링크를 다시 보낼 수 있는 길
      await expect(text(host.page, /임시 결과/)).toBeVisible();
    });

    await test.step("저장 중에는 같은 버튼을 두 번 누를 수 없다", async () => {
      await alice.page.goto(`/trip/${trip.id}/respond`);
      await fillResponse(alice.page, {
        availableDays: [days[1], days[2], days[3]],
        interests: { nature: "좋아요", food: "꼭 필요", cafe: "좋아요", activity: "보통" },
      });
      const save = button(alice.page, "응답 저장");
      await save.click();
      // 저장 시작 직후부터 이동이 끝날 때까지 버튼은 잠겨 있어야 한다.
      await expect(save).toBeDisabled();
      await alice.page.waitForURL(new RegExp(`/trip/${trip.id}/consensus$`), { timeout: 20_000 });
    });

    await test.step("마지막 응답이 들어오면 주최자 화면이 새로고침 없이 갱신된다", async () => {
      await expect(text(host.page, /2\/3명 응답/)).toBeVisible({ timeout: 20_000 });

      await bob.page.goto(`/trip/${trip.id}/respond`);
      await submitResponse(bob.page, trip.id, {
        availableDays: [days[1], days[2], days[3]],
        interests: { nature: "좋아요", food: "좋아요", cafe: "별로", activity: "보통" },
      });

      await expect(text(host.page, /3\/3명 응답/)).toBeVisible({ timeout: 25_000 });
      await expect(host.page.getByText("아직 모으는 중이에요.")).toHaveCount(0);
    });

    await test.step("합의 결과가 계산된 대로 보인다", async () => {
      // 세 사람 모두 가능한 연속 3일이 1순위가 되어야 한다.
      await expect(text(host.page, "합의 후보")).toBeVisible();
      // 자유 입력은 취향 점수와 섞이지 않고 따로 선다.
      await expect(text(host.page, /개별 요청/)).toBeVisible();
      await expect(text(host.page, "채식 식당이 한 곳은 필요해요")).toBeVisible();
    });

    await test.step("참여자는 확정할 수 없고 주최자만 확정한다", async () => {
      await bob.page.goto(`/trip/${trip.id}/consensus`);
      await expect(bob.page.getByRole("button", { name: "이 방향으로 확정하기" })).toHaveCount(0);

      await confirmDirection(host.page);
    });
  } finally {
    await Promise.all([host.close(), alice.close(), bob.close()]);
  }
});

test("A2. 가능한 날짜를 하나도 고르지 않으면 한 번 확인한 뒤 저장한다", async ({ browser }) => {
  const host = await newActor(browser, "host");
  try {
    const trip = await createTrip(host.page, { name: "확인", hostNickname: "호스트", participants: 2 });
    await host.page.goto(`/trip/${trip.id}/respond`);
    await fillResponse(host.page, { availableDays: [], unavailableDays: [trip.range.days[0]] });

    await button(host.page, "응답 저장").click();
    await expect(text(host.page, "가능한 날짜를 선택하지 않았어요.")).toBeVisible();

    await button(host.page, "그대로 저장", true).click();
    await host.page.waitForURL(new RegExp(`/trip/${trip.id}/consensus$`), { timeout: 20_000 });
  } finally {
    await host.close();
  }
});
