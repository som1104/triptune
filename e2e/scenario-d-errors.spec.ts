import { expect, request, test } from "@playwright/test";
import { newActor } from "./support/actors";
import { button, text } from "./support/ui";
import { accessToken } from "./support/session";
import { loadE2eEnv } from "./support/env";
import { nickname } from "./support/data";
import { confirmDirection, createTrip, joinTrip, submitResponse } from "./support/flows";

/* 시나리오 D — 오류 상황과 권한. */

test("D1. 유효하지 않은 초대 링크는 안내 화면을 보여준다", async ({ browser }) => {
  const visitor = await newActor(browser, "visitor");
  try {
    await visitor.page.goto("/join/definitely-not-a-real-token");
    await expect(text(visitor.page, "초대 링크를 찾을 수 없어요.")).toBeVisible();
    await expect(visitor.page.getByLabel("이름 또는 닉네임")).toHaveCount(0);
  } finally {
    await visitor.close();
  }
});

test("D2. 존재하지 않는 여행은 '찾을 수 없어요'로 끝난다", async ({ browser }) => {
  const visitor = await newActor(browser, "visitor");
  try {
    await visitor.page.goto("/trip/00000000-0000-4000-8000-000000000000");
    await expect(text(visitor.page, "이 여행을 찾을 수 없어요.")).toBeVisible();
  } finally {
    await visitor.close();
  }
});

test("D3. 같은 여행에서 닉네임이 겹치면 참여가 거부되고 화면에 머문다", async ({ browser }) => {
  const host = await newActor(browser, "host");
  const first = await newActor(browser, "first");
  const second = await newActor(browser, "second");
  try {
    const trip = await createTrip(host.page, { name: "중복", hostNickname: "호스트", participants: 4 });
    await joinTrip(first.page, trip.inviteLink, "같은이름");

    await second.page.goto(trip.inviteLink);
    await second.page.getByLabel("이름 또는 닉네임").fill(nickname("같은이름"));
    await button(second.page, "여행에 참여하기").click();

    await expect(text(second.page, /이미 사용 중인 이름이에요/)).toBeVisible();
    await expect(second.page).toHaveURL(/\/join\//);
  } finally {
    await Promise.all([host.close(), first.close(), second.close()]);
  }
});

test("D4. 저장이 실패하면 화면에 머물고 입력한 내용이 사라지지 않는다", async ({ browser }) => {
  const host = await newActor(browser, "host");
  try {
    const trip = await createTrip(host.page, { name: "저장실패", hostNickname: "호스트", participants: 2 });
    await host.page.goto(`/trip/${trip.id}/respond`);

    const day = trip.range.days[0];
    await host.page
      .getByRole("radiogroup", { name: "표시할 상태" })
      .getByRole("radio", { name: "가능", exact: true })
      .click();
    await button(host.page, new RegExp(`^${day}일, `)).click();
    for (const [group, label] of [
      ["자연", "좋아요"],
      ["맛집", "좋아요"],
      ["카페", "보통"],
      ["활동", "보통"],
      ["일정 속도", "여유롭게"],
      ["소비 성향", "가성비"],
      ["함께 다니는 정도", "자유시간 선호"],
    ] as const) {
      await host.page.getByRole("radiogroup", { name: group }).getByRole("radio", { name: label, exact: true }).click();
    }
    await host.page.getByLabel("꼭 반영할 점").fill("네트워크가 끊겨도 남아 있어야 해요");

    // 저장 요청만 끊는다.
    await host.context.route("**/rest/v1/rpc/save_my_response", (route) => route.abort("failed"));
    await button(host.page, "응답 저장").click();

    await expect(text(host.page, /저장하지 못했어요/)).toBeVisible({ timeout: 20_000 });
    await expect(host.page).toHaveURL(new RegExp(`/trip/${trip.id}/respond$`));
    await expect(button(host.page, `${day}일, 가능`, true)).toBeVisible();
    await expect(host.page.getByLabel("꼭 반영할 점")).toHaveValue("네트워크가 끊겨도 남아 있어야 해요");

    // 연결이 돌아오면 그대로 다시 저장된다.
    await host.context.unroute("**/rest/v1/rpc/save_my_response");
    await button(host.page, "응답 저장").click();
    await host.page.waitForURL(new RegExp(`/trip/${trip.id}/consensus$`), { timeout: 20_000 });
  } finally {
    await host.close();
  }
});

test("D5. 참여자가 주최자 전용 RPC 를 직접 호출해도 서버가 막는다", async ({ browser }) => {
  const result = loadE2eEnv();
  test.skip(!result.ok, "E2E 환경변수가 없습니다.");
  const { supabaseUrl, supabaseAnonKey } = (result as { ok: true; env: { supabaseUrl: string; supabaseAnonKey: string } }).env;

  const host = await newActor(browser, "host");
  const guest = await newActor(browser, "guest");
  try {
    const trip = await createTrip(host.page, { name: "권한", hostNickname: "호스트", participants: 2 });
    await joinTrip(guest.page, trip.inviteLink, "손님");

    const token = await accessToken(guest.context);
    const api = await request.newContext({
      baseURL: supabaseUrl,
      extraHTTPHeaders: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    // 그룹 합의 확정 — 주최자만 할 수 있어야 한다.
    const confirmRes = await api.post("/rest/v1/rpc/confirm_group_direction", {
      data: {
        p_trip_id: trip.id,
        p_selected_start_date: trip.range.start,
        p_selected_end_date: trip.range.end,
        p_preference_summary: {},
        p_conflict_summary: {},
        p_participant_count: 2,
      },
    });
    expect(confirmRes.ok()).toBe(false);

    // 여행 삭제 — 주최자만 할 수 있어야 한다.
    const deleteRes = await api.post("/rest/v1/rpc/delete_trip", { data: { p_trip_id: trip.id } });
    expect(deleteRes.ok()).toBe(false);

    await api.dispose();

    // 서버가 막았으니 여행은 그대로 살아 있다.
    await host.page.reload();
    await expect(text(host.page, trip.title)).toBeVisible();
  } finally {
    await Promise.all([host.close(), guest.close()]);
  }
});

test("D6. 참여자는 여행에서 나가고, 주최자는 여행을 삭제한다", async ({ browser }) => {
  const host = await newActor(browser, "host");
  const guest = await newActor(browser, "guest");
  try {
    const trip = await createTrip(host.page, { name: "나가기", hostNickname: "호스트", participants: 3 });
    await joinTrip(guest.page, trip.inviteLink, "손님");

    await test.step("참여자가 나가면 내 목록에서 사라진다", async () => {
      await guest.page.goto("/");
      await expect(text(guest.page, trip.title)).toBeVisible();
      await guest.page.getByRole("button", { name: `${trip.title} 메뉴` }).first().click();
      await guest.page.getByRole("menuitem", { name: /여행 나가기/ }).click();
      await button(guest.page, "나가기", true).click();
      await expect(guest.page.getByText(trip.title)).toHaveCount(0, { timeout: 20_000 });
    });

    await test.step("주최자가 삭제하면 모두에게서 사라진다", async () => {
      await host.page.goto("/");
      await host.page.getByRole("button", { name: `${trip.title} 메뉴` }).first().click();
      await host.page.getByRole("menuitem", { name: /여행 삭제/ }).click();
      await button(host.page, "삭제", true).click();
      await expect(host.page.getByText(trip.title)).toHaveCount(0, { timeout: 20_000 });

      await host.page.goto(`/trip/${trip.id}`);
      await expect(text(host.page, "이 여행을 찾을 수 없어요.")).toBeVisible();
    });
  } finally {
    await Promise.all([host.close(), guest.close()]);
  }
});

test("D7. 직접 URL 진입·새로고침·뒤로가기에도 상태가 유지된다", async ({ browser }) => {
  const host = await newActor(browser, "host");
  const guest = await newActor(browser, "guest");
  try {
    const trip = await createTrip(host.page, { name: "이동", hostNickname: "호스트", participants: 2, nights: 2 });
    await joinTrip(guest.page, trip.inviteLink, "손님");

    const days = trip.range.days;
    await host.page.goto(`/trip/${trip.id}/respond`);
    await submitResponse(host.page, trip.id, { availableDays: [days[0], days[1], days[2]] });
    await guest.page.goto(`/trip/${trip.id}/respond`);
    await submitResponse(guest.page, trip.id, { availableDays: [days[0], days[1], days[2]] });

    await test.step("새로고침해도 합의 화면이 그대로다", async () => {
      await host.page.reload();
      await expect(text(host.page, /2\/2명 응답/)).toBeVisible();
    });

    await test.step("뒤로가기·앞으로가기가 화면을 깨뜨리지 않는다", async () => {
      await host.page.goto(`/trip/${trip.id}`);
      await host.page.goBack();
      await expect(host.page).toHaveURL(new RegExp(`/trip/${trip.id}/consensus$`));
      await expect(text(host.page, /2\/2명 응답/)).toBeVisible();

      await host.page.goForward();
      await expect(host.page).toHaveURL(new RegExp(`/trip/${trip.id}$`));
      await expect(text(host.page, trip.title)).toBeVisible();
    });

    await test.step("확정 이후 참여자가 직접 응답 URL 로 들어가면 보기 전용이다", async () => {
      await host.page.goto(`/trip/${trip.id}/consensus`);
      await confirmDirection(host.page);

      await guest.page.goto(`/trip/${trip.id}/respond`);
      await expect(guest.page.getByRole("button", { name: "응답 저장" })).toHaveCount(0, { timeout: 20_000 });
    });
  } finally {
    await Promise.all([host.close(), guest.close()]);
  }
});
