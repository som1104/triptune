import { expect, test } from "@playwright/test";
import { newActor } from "./support/actors";
import { button, text } from "./support/ui";
import { Shots } from "./support/shots";
import { cleanupTripIds } from "./support/cleanup";
import {
  addStay,
  castVote,
  confirmDirection,
  confirmFinalStay,
  createTrip,
  fillPreferences,
  fillResponse,
  fillStaySheet,
  joinTrip,
  paintDays,
  saveResponse,
  startVoting,
} from "./support/flows";

/* ------------------------------------------------------------------
   서비스 화면 투어.

   테스트가 아니라 "진행 과정을 그대로 담은 캡처"가 목적이다. 흐름은
   시나리오 A~C 와 같지만, 제목·닉네임·숙소 이름을 실제처럼 채워서
   그대로 보여줘도 되는 화면을 만든다.

   npm run screenshots
   → screenshots/flow/<뷰포트>/       모든 단계
     screenshots/portfolio/<뷰포트>/  대표 화면만
   ------------------------------------------------------------------ */

const TRIP = { title: "제주도 가을 여행", destination: "제주도" };
const HOST = "지원";
const GUESTS = ["민서", "태훈"] as const;

const STAY_WHOLE = "애월 돌담 독채";
const STAY_ROOMS = "중문 오션뷰 호텔";

test.describe.configure({ mode: "serial" });

test("서비스 화면 투어", async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  Shots.reset(testInfo.project.name.replace(/^shots-/, ""));
  const shots = new Shots(testInfo);

  const host = await newActor(browser, "host");
  const minseo = await newActor(browser, "minseo");
  const taehun = await newActor(browser, "taehun");
  const created: string[] = [];

  try {
    // ── 1. 시작 ─────────────────────────────────────────────
    await host.page.goto("/");
    await shots.take(host.page, "내-여행-비어있음");

    const trip = await test.step("여행 만들기", async () => {
      await host.page.goto("/new");
      await host.page.getByLabel("여행 이름").fill(TRIP.title);
      await host.page.getByLabel("목적지").fill(TRIP.destination);
      await host.page.getByLabel("주최자 닉네임").fill(HOST);
      await shots.take(host.page, "새-여행-만들기", true);
      return createTrip(host.page, {
        name: "투어",
        rawTitle: TRIP.title,
        hostNickname: HOST,
        rawNickname: true,
        destination: TRIP.destination,
        participants: 3,
        nights: 2,
      });
    });
    created.push(trip.id);

    await shots.take(host.page, "친구-초대하기", true);

    // ── 2. 참여 ─────────────────────────────────────────────
    await minseo.page.goto(trip.inviteLink);
    await shots.take(minseo.page, "초대-링크로-참여", true);
    await joinTrip(minseo.page, trip.inviteLink, GUESTS[0], { raw: true });
    await joinTrip(taehun.page, trip.inviteLink, GUESTS[1], { raw: true });

    await host.page.reload();
    await shots.takeAt(host.page, text(host.page, "참여 현황"), "참여자가-모이는-중", true);

    // ── 3. 날짜·취향 응답 ────────────────────────────────────
    const d = trip.range.days;

    await test.step("주최자 응답 — 달력을 단계별로 담는다", async () => {
      await host.page.goto(`/trip/${trip.id}/respond`);

      /* 달력은 화면 위쪽에 있고 취향은 아래에 있다. 다 채운 뒤에 찍으면
         화면이 아래로 내려가 있어 정작 달력이 안 보인다. 그래서 달력
         구간을 먼저, 칠하기 전과 후로 나눠 담는다. */
      const paintModes = host.page.getByRole("radiogroup", { name: "표시할 상태" });
      await expect(paintModes).toBeVisible();
      await shots.takeAt(host.page, paintModes, "날짜-고르기-전-전체-미정", true);

      await paintDays(host.page, "가능", [d[0], d[1], d[2], d[3], d[4]]);
      await shots.takeAt(host.page, paintModes, "가능한-날짜-칠하기", true);

      await paintDays(host.page, "불가", [d[8], d[9]]);
      await shots.takeAt(host.page, paintModes, "불가능한-날짜까지-표시", true);
      // 달력 아래의 "가능 N일 · 미정 N일 · 불가 N일" 요약과 초기화 버튼
      await shots.takeAt(host.page, text(host.page, /가능 \d+일/), "날짜-요약과-초기화", true);

      await fillPreferences(host.page, {
        availableDays: [],
        interests: { nature: "꼭 필요", food: "좋아요", cafe: "보통", activity: "좋아요" },
        pace: "여유롭게",
        spending: "균형 있게",
        togetherness: "핵심 일정만 함께",
        note: "비 오면 실내 일정도 하나 있으면 좋겠어요",
      });
      await shots.takeAt(host.page, host.page.getByRole("radiogroup", { name: "자연" }), "여행-취향-입력", true);
      await shots.takeAt(host.page, host.page.getByLabel("꼭 반영할 점"), "꼭-반영할-점", true);
      await saveResponse(host.page, trip.id);
    });

    await shots.take(host.page, "그룹-합의-임시-결과");

    await test.step("참여자 응답", async () => {
      await minseo.page.goto(`/trip/${trip.id}/respond`);
      await fillResponse(minseo.page, {
        availableDays: [d[1], d[2], d[3], d[4], d[5]],
        unavailableDays: [d[0]],
        interests: { nature: "좋아요", food: "꼭 필요", cafe: "좋아요", activity: "보통" },
        pace: "여유롭게",
        spending: "가성비",
        togetherness: "핵심 일정만 함께",
        note: "해산물 못 먹어요",
      });
      await saveResponse(minseo.page, trip.id);

      /* 세 사람의 진행 상태가 서로 다른 순간 — 주최자와 민서는 응답 완료,
         태훈은 아직. 참여 현황이 가장 보여줄 게 많을 때다. */
      await host.page.goto(`/trip/${trip.id}`);
      await expect(text(host.page, /2\/3명 응답/)).toBeVisible({ timeout: 35_000 });
      await shots.takeAt(host.page, text(host.page, "참여 현황"), "누가-어디까지-진행했나", true);

      await taehun.page.goto(`/trip/${trip.id}/respond`);
      await fillResponse(taehun.page, {
        availableDays: [d[2], d[3], d[4]],
        unavailableDays: [d[0], d[1]],
        interests: { nature: "좋아요", food: "좋아요", cafe: "별로", activity: "꼭 필요" },
        pace: "알차게",
        spending: "경험 우선",
        togetherness: "자유시간 선호",
      });
      await saveResponse(taehun.page, trip.id);
    });

    // ── 4. 그룹 합의 ─────────────────────────────────────────
    await host.page.goto(`/trip/${trip.id}`);
    await expect(text(host.page, /3\/3명 응답/)).toBeVisible({ timeout: 35_000 });
    await shots.takeAt(host.page, text(host.page, "참여 현황"), "전원-응답-완료", true);

    await host.page.goto(`/trip/${trip.id}/consensus`);
    await expect(text(host.page, /3\/3명 응답/)).toBeVisible({ timeout: 35_000 });
    await shots.take(host.page, "그룹-합의-한-줄-요약", true);
    await shots.takeAt(host.page, host.page.getByRole("radiogroup", { name: "날짜 후보" }), "날짜-후보", true);
    await shots.takeAt(host.page, text(host.page, /개별 요청/), "취향-충돌과-개별-요청", true);

    await confirmDirection(host.page);
    await shots.take(host.page, "최종-합의");

    // ── 5. 숙소 후보 ────────────────────────────────────────
    await host.page.goto(`/trip/${trip.id}/stay`);
    await shots.take(host.page, "숙소-후보-모으는-중");

    await addStay(host.page, {
      mode: "whole",
      name: STAY_WHOLE,
      capacity: 4,
      totalPrice: 420000,
    });

    await fillStaySheet(host.page, {
      mode: "rooms",
      name: STAY_ROOMS,
      rooms: [
        { name: "디럭스 트윈", count: 1, capacityPerRoom: 2, pricePerRoom: 180000 },
        { name: "스탠다드", count: 1, capacityPerRoom: 2, pricePerRoom: 140000 },
      ],
    });
    await shots.take(host.page, "객실-여러-개-예약안", true);
    await button(host.page, "후보로 등록하기").click();
    await expect(text(host.page, STAY_ROOMS)).toBeVisible({ timeout: 15_000 });
    await shots.take(host.page, "숙소-후보-목록", true);

    // ── 6. 투표 ─────────────────────────────────────────────
    await startVoting(host.page);
    await shots.take(host.page, "숙소-투표-중", true);
    await castVote(host.page, STAY_WHOLE);
    await shots.take(host.page, "내-투표-제출함");

    await minseo.page.goto(`/trip/${trip.id}/stay`);
    await castVote(minseo.page, STAY_WHOLE);

    // 2명 완료 · 1명 미응답 — 누가 투표를 마쳤는지 아바타로 보이는 순간
    await host.page.goto(`/trip/${trip.id}/stay`);
    await expect(text(host.page, "투표 완료")).toBeVisible({ timeout: 35_000 });
    await shots.takeAt(host.page, text(host.page, "투표 완료"), "누가-투표를-마쳤나", true);

    await taehun.page.goto(`/trip/${trip.id}/stay`);
    await castVote(taehun.page, STAY_ROOMS);

    await host.page.goto(`/trip/${trip.id}/stay`);
    await expect(text(host.page, "투표 결과")).toBeVisible({ timeout: 35_000 });
    await shots.take(host.page, "투표-결과", true);

    // ── 7. 확정 ─────────────────────────────────────────────
    await confirmFinalStay(host.page);
    await shots.take(host.page, "최종-숙소");

    await host.page.goto(`/trip/${trip.id}`);
    await expect(text(host.page, /여행이 확정됐어요!/)).toBeVisible();
    await shots.take(host.page, "여행이-확정됐어요", true);

    await host.page.goto("/");
    await shots.take(host.page, "내-여행-확정된-카드", true);

    // ── 8. 조율 다시 열기 ────────────────────────────────────
    await host.page.goto(`/trip/${trip.id}`);
    await button(host.page, "조율 다시 열기").click();
    await shots.take(host.page, "조율-다시-열기", true);
    await button(host.page, /숙소 투표만 다시 열기/).click();
    await host.page.getByLabel(/변경 사유/).fill("예약하려니 그 날짜가 이미 찼어요");
    await shots.take(host.page, "다시-열기-확인");
    await button(host.page, "숙소 투표 다시 열기", true).click();
    await host.page.waitForURL(new RegExp(`/trip/${trip.id}/stay$`), { timeout: 20_000 });

    await minseo.page.goto(`/trip/${trip.id}`);
    await shots.take(minseo.page, "참여자가-보는-재개-안내", true);
  } finally {
    await Promise.all([host.close(), minseo.close(), taehun.close()]);
    await cleanupTripIds(created);
  }
});
