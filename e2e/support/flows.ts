import { expect, type Page } from "@playwright/test";
import { candidateRange, nickname, tripTitle } from "./data";
import { button, text } from "./ui";

export interface CreatedTrip {
  id: string;
  title: string;
  inviteLink: string;
  range: ReturnType<typeof candidateRange>;
}

/** 여행 생성 (로그인하지 않은 상태에서 시작한다). */
export async function createTrip(
  page: Page,
  opts: {
    name: string;
    hostNickname: string;
    destination?: string;
    participants?: number;
    nights?: number;
    spanDays?: number;
  }
): Promise<CreatedTrip> {
  const title = tripTitle(opts.name);
  const range = candidateRange(opts.spanDays ?? 10);

  await page.goto("/new");
  await page.getByLabel("여행 이름").fill(title);
  await page.getByLabel("목적지").fill(opts.destination ?? "제주도");
  await page.getByLabel("주최자 닉네임").fill(nickname(opts.hostNickname));
  await page.getByLabel("시작일").fill(range.start);
  await page.getByLabel("종료일").fill(range.end);

  const nights = opts.nights ?? 2;
  await button(page, `${nights}박 ${nights + 1}일`, true).click();

  await page
    .getByRole("radiogroup", { name: "예상 인원" })
    .getByRole("radio", { name: `${opts.participants ?? 3}명`, exact: true })
    .click();

  await button(page, "여행 만들기").click();
  await page.waitForURL(/\/trip\/[0-9a-f-]{36}$/);

  const id = page.url().match(/\/trip\/([0-9a-f-]{36})/)![1];
  return { id, title, inviteLink: await inviteLink(page), range };
}

/** 초대 링크 카드는 마운트 후 효과에서 origin 을 채운다 — 그 전에 읽으면 "..." 이다. */
export async function inviteLink(page: Page): Promise<string> {
  const locator = page.getByText(/^https?:\/\/.*\/join\//).first();
  await expect(locator).toBeVisible();
  return (await locator.innerText()).trim();
}

/** 초대 링크로 참여. 성공하면 내 날짜·취향 입력으로 이동한다. */
export async function joinTrip(page: Page, link: string, name: string): Promise<string> {
  await page.goto(link);
  const nick = nickname(name);
  await page.getByLabel("이름 또는 닉네임").fill(nick);
  await button(page, "여행에 참여하기").click();
  await page.waitForURL(/\/respond$/);
  return nick;
}

export interface ResponseChoice {
  /** 가능으로 칠할 날짜 (달력 칸의 '일' 숫자). */
  availableDays: number[];
  /** 불가로 칠할 날짜. */
  unavailableDays?: number[];
  interests?: { nature: string; food: string; cafe: string; activity: string };
  pace?: string;
  spending?: string;
  togetherness?: string;
  note?: string;
}

const DEFAULT_INTERESTS = { nature: "좋아요", food: "꼭 필요", cafe: "보통", activity: "좋아요" };

/** 날짜·취향 입력 화면을 채운다 (저장은 하지 않는다). */
export async function fillResponse(page: Page, choice: ResponseChoice): Promise<void> {
  await expect(page.getByRole("radiogroup", { name: "표시할 상태" })).toBeVisible();

  await paintDays(page, "가능", choice.availableDays);
  if (choice.unavailableDays?.length) await paintDays(page, "불가", choice.unavailableDays);

  const interests = { ...DEFAULT_INTERESTS, ...choice.interests };
  for (const [key, label] of [
    ["자연", interests.nature],
    ["맛집", interests.food],
    ["카페", interests.cafe],
    ["활동", interests.activity],
  ] as const) {
    await page.getByRole("radiogroup", { name: key }).getByRole("radio", { name: label, exact: true }).click();
  }

  await pickStyle(page, "일정 속도", choice.pace ?? "여유롭게");
  await pickStyle(page, "소비 성향", choice.spending ?? "균형 있게");
  await pickStyle(page, "함께 다니는 정도", choice.togetherness ?? "핵심 일정만 함께");

  if (choice.note) await page.getByLabel("꼭 반영할 점").fill(choice.note);
}

async function paintDays(page: Page, mode: string, days: number[]): Promise<void> {
  if (days.length === 0) return;
  await page
    .getByRole("radiogroup", { name: "표시할 상태" })
    .getByRole("radio", { name: mode, exact: true })
    .click();
  for (const day of days) {
    await button(page, new RegExp(`^${day}일, `)).click();
    await expect(button(page, `${day}일, ${mode}`, true)).toBeVisible();
  }
}

async function pickStyle(page: Page, group: string, label: string): Promise<void> {
  await page.getByRole("radiogroup", { name: group }).getByRole("radio", { name: label, exact: true }).click();
}

/** 응답을 저장하고 그룹 합의 화면으로 넘어갈 때까지 기다린다. */
export async function saveResponse(page: Page, tripId: string): Promise<void> {
  await button(page, "응답 저장").click();
  await page.waitForURL(new RegExp(`/trip/${tripId}/consensus$`), { timeout: 20_000 });
}

export async function submitResponse(
  page: Page,
  tripId: string,
  choice: ResponseChoice
): Promise<void> {
  await fillResponse(page, choice);
  await saveResponse(page, tripId);
}

/** 주최자가 그룹 합의를 확정한다. 미응답자가 있으면 확인 모달이 한 번 뜬다. */
export async function confirmDirection(page: Page): Promise<void> {
  await button(page, "이 방향으로 확정하기").click();
  const warning = button(page, "그래도 확정", true);
  if (await warning.isVisible().catch(() => false)) await warning.click();
  await expect(text(page, "최종 합의", true)).toBeVisible({ timeout: 15_000 });
}

export interface WholeStay {
  mode: "whole";
  name: string;
  capacity: number;
  totalPrice: number;
}

export interface RoomsStay {
  mode: "rooms";
  name: string;
  rooms: { name: string; count: number; capacityPerRoom: number; pricePerRoom: number }[];
}

export type StayInput = WholeStay | RoomsStay;

/** 숙소 후보 등록 시트를 열어 한 건 채운다 (저장 버튼은 누르지 않는다). */
export async function fillStaySheet(page: Page, stay: StayInput): Promise<void> {
  await button(page, "숙소 후보 추가").click();
  await expect(page.getByLabel("숙소 링크")).toBeVisible();

  await page.getByLabel("숙소 링크").fill("https://example.com/stay");
  await page.getByLabel("숙소 이름").fill(stay.name);
  await page.getByLabel("위치", { exact: true }).fill("제주시");

  const modes = page.getByRole("radiogroup", { name: "숙소 이용 방식" });
  if (stay.mode === "whole") {
    await modes.getByRole("radio", { name: "숙소 전체 사용" }).click();
    await page.getByLabel("최대 수용 인원").fill(String(stay.capacity));
    await page.getByLabel("숙박 전체 금액 (원)").fill(String(stay.totalPrice));
    return;
  }

  await modes.getByRole("radio", { name: "객실 여러 개" }).click();
  for (const [i, room] of stay.rooms.entries()) {
    if (i > 0) await button(page, "다른 객실 유형 추가").click();
    await page.getByLabel("객실 이름").nth(i).fill(room.name);
    await page.getByLabel(`객실 ${i + 1} 수`, { exact: true }).fill(String(room.count));
    await page.getByLabel("객실당 수용 인원").nth(i).fill(String(room.capacityPerRoom));
    await page.getByLabel("객실 1개 전체 금액 (원)").nth(i).fill(String(room.pricePerRoom));
  }
}

export async function addStay(page: Page, stay: StayInput): Promise<void> {
  await fillStaySheet(page, stay);
  await button(page, "후보로 등록하기").click();
  await expect(text(page, stay.name)).toBeVisible({ timeout: 15_000 });
}

export async function startVoting(page: Page): Promise<void> {
  await button(page, "숙소 투표 시작하기").click();
  await button(page, "투표 시작", true).click();
  await expect(page.getByRole("heading", { name: "숙소 투표 중" })).toBeVisible({ timeout: 15_000 });
}

export async function castVote(page: Page, stayName: string): Promise<void> {
  await page
    .getByRole("radiogroup", { name: "숙소 후보" })
    .getByRole("radio", { name: new RegExp(stayName) })
    .filter({ visible: true })
    .first()
    .click();
  await button(page, "투표 제출하기").click();
  await expect(text(page, "투표를 제출했어요.")).toBeVisible({ timeout: 15_000 });
}

export async function confirmFinalStay(page: Page): Promise<void> {
  await button(page, "이 숙소로 확정하기").click();
  await button(page, "확정하기", true).click();
  await expect(text(page, /여행이 확정됐어요!/)).toBeVisible({ timeout: 15_000 });
}

/** 확정된 여행에서 주최자가 조율을 다시 연다. */
export async function reopen(
  page: Page,
  option: "숙소 투표만 다시 열기" | "날짜·취향 조율부터 다시 열기",
  reason?: string
): Promise<void> {
  await button(page, "조율 다시 열기").click();
  await button(page, new RegExp(option)).click();
  if (reason) await page.getByLabel(/변경 사유/).fill(reason);
  const cta = option.startsWith("숙소") ? "숙소 투표 다시 열기" : "날짜·취향 다시 열기";
  await button(page, cta, true).click();
}
