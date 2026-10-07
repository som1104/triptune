import { describe, expect, it } from "vitest";
import { AVATAR_COLOR_COUNT, avatarColor, avatarColorAt } from "@/components/ui/avatar";

/* 한 여행의 정원은 10명이다. 좌석 번호로 색을 주므로, 정원이 가득 차도
   같은 여행 안에서 두 사람이 같은 색을 쓰면 안 된다. */
const MAX_PARTICIPANTS = 10;

describe("아바타 색 배정", () => {
  it("색이 정원만큼 준비돼 있다", () => {
    expect(AVATAR_COLOR_COUNT).toBeGreaterThanOrEqual(MAX_PARTICIPANTS);
  });

  it("정원이 가득 차도 10명 모두 다른 색이다", () => {
    const seats = Array.from({ length: MAX_PARTICIPANTS }, (_, i) => avatarColorAt(i));
    expect(new Set(seats).size).toBe(MAX_PARTICIPANTS);
  });

  it("같은 좌석이면 언제 물어도 같은 색이다", () => {
    for (let i = 0; i < MAX_PARTICIPANTS; i++) {
      expect(avatarColorAt(i)).toBe(avatarColorAt(i));
    }
  });

  it("정원을 넘는 번호가 들어와도 색은 돌아갈 뿐 깨지지 않는다", () => {
    expect(avatarColorAt(AVATAR_COLOR_COUNT)).toBe(avatarColorAt(0));
    expect(avatarColorAt(AVATAR_COLOR_COUNT + 3)).toBe(avatarColorAt(3));
    for (let i = 0; i < 50; i++) expect(avatarColorAt(i)).toBeTruthy();
  });

  it("음수 좌석에도 빈 값을 주지 않는다", () => {
    expect(avatarColorAt(-1)).toBe(avatarColorAt(AVATAR_COLOR_COUNT - 1));
    expect(avatarColorAt(-AVATAR_COLOR_COUNT)).toBe(avatarColorAt(0));
  });
});

describe("좌석을 모를 때의 대체 색 (여행 밖 아바타)", () => {
  const palette = Array.from({ length: AVATAR_COLOR_COUNT }, (_, i) => avatarColorAt(i));

  it("언제나 준비된 색 중 하나를 준다", () => {
    for (const seed of ["지원", "민서", "", "a", "00000000-0000-4000-8000-000000000000"]) {
      expect(palette).toContain(avatarColor(seed));
    }
  });

  it("같은 seed 는 같은 색, 다른 seed 는 대체로 흩어진다", () => {
    expect(avatarColor("지원")).toBe(avatarColor("지원"));
    const spread = new Set(
      Array.from({ length: 200 }, (_, i) => avatarColor(`participant-${i}`))
    );
    // 해시라 완전히 고르지는 않지만, 한두 색에 몰리면 대체 색의 뜻이 없다.
    expect(spread.size).toBeGreaterThanOrEqual(AVATAR_COLOR_COUNT - 2);
  });
});
