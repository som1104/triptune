import { describe, expect, it } from "vitest";
import {
  BOOKING_MODE_LABEL,
  bookingLine,
  capacityCheck,
  parseRooms,
  priceLine,
  roomTotals,
  roomsSummaryLine,
  tallyVotes,
  votePercentage,
} from "@/lib/trip/stay";

const room = (name: string, count: number, capacityPerRoom: number, pricePerRoom: number) => ({
  name,
  count,
  capacityPerRoom,
  pricePerRoom,
});

describe("parseRooms", () => {
  it("jsonb 배열이 아니면 빈 배열", () => {
    expect(parseRooms(null)).toEqual([]);
    expect(parseRooms({})).toEqual([]);
    expect(parseRooms("디럭스")).toEqual([]);
  });

  it("읽을 수 있는 항목만 남기고 나머지는 버린다", () => {
    const parsed = parseRooms([
      room("디럭스 트윈", 2, 2, 120000),
      { name: "", count: 1, capacityPerRoom: 2, pricePerRoom: 100 }, // 이름 없음
      { name: "온돌", count: 0, capacityPerRoom: 4, pricePerRoom: 100 }, // 0개
      { name: "스위트", count: 1, capacityPerRoom: 0, pricePerRoom: 100 }, // 0명
      { name: "공짜방", count: 1, capacityPerRoom: 2, pricePerRoom: 0 }, // 0원
      null,
      "온돌방",
    ]);
    expect(parsed).toEqual([room("디럭스 트윈", 2, 2, 120000)]);
  });

  it("숫자가 문자열로 들어와도 읽는다 (jsonb 라 무엇이든 들어올 수 있다)", () => {
    expect(parseRooms([{ name: " 온돌 ", count: "2", capacityPerRoom: "4", pricePerRoom: "90000" }])).toEqual([
      room("온돌", 2, 4, 90000),
    ]);
  });
});

describe("roomTotals", () => {
  it("객실 수·총 수용 인원·총액을 수량만큼 곱해서 더한다", () => {
    const rooms = [room("디럭스 트윈", 2, 2, 120000), room("온돌", 1, 4, 150000)];
    expect(roomTotals(rooms)).toEqual({ roomCount: 3, capacity: 8, totalPrice: 390000 });
  });

  it("빈 구성은 0", () => {
    expect(roomTotals([])).toEqual({ roomCount: 0, capacity: 0, totalPrice: 0 });
  });
});

describe("roomsSummaryLine", () => {
  it("한 종류면 그대로", () => {
    expect(roomsSummaryLine([room("디럭스 트윈", 2, 2, 1)])).toBe("디럭스 트윈 2개");
  });
  it("여러 종류면 '외 N종'", () => {
    expect(roomsSummaryLine([room("디럭스 트윈", 2, 2, 1), room("온돌", 1, 4, 1)])).toBe(
      "디럭스 트윈 2개 외 1종"
    );
  });
  it("빈 구성은 빈 문자열", () => {
    expect(roomsSummaryLine([])).toBe("");
  });
});

describe("bookingLine", () => {
  it("전체 사용은 최대 인원만", () => {
    expect(bookingLine({ booking_mode: "whole", capacity: 6, rooms: null })).toBe(
      `${BOOKING_MODE_LABEL.whole} · 최대 6명`
    );
  });
  it("객실 모드는 객실 수를 구성에서 다시 센다", () => {
    expect(
      bookingLine({
        booking_mode: "rooms",
        capacity: 8,
        rooms: [room("디럭스 트윈", 2, 2, 1), room("온돌", 1, 4, 1)],
      })
    ).toBe("객실 3개 · 최대 8명");
  });
});

describe("priceLine", () => {
  it("확정 인원을 모르면 총액만", () => {
    expect(priceLine(840000, null)).toBe("총 840,000원");
  });
  it("확정 인원이 있으면 1인당 금액을 올림으로 붙인다", () => {
    expect(priceLine(840000, 6)).toBe("총 840,000원 · 1인 약 140,000원");
    expect(priceLine(100000, 3)).toBe("총 100,000원 · 1인 약 33,334원");
  });
});

describe("capacityCheck", () => {
  it("확정 인원을 모르면 부족분은 0이고, 인원이 있으면 통과", () => {
    expect(capacityCheck(4, null)).toEqual({ shortBy: 0, ok: true });
  });
  it("수용 인원이 0이면 아직 저장할 수 없다", () => {
    expect(capacityCheck(0, null)).toEqual({ shortBy: 0, ok: false });
    expect(capacityCheck(0, 4)).toEqual({ shortBy: 4, ok: false });
  });
  it("참여 인원보다 적으면 부족분을 알려주고 막는다", () => {
    expect(capacityCheck(4, 6)).toEqual({ shortBy: 2, ok: false });
  });
  it("참여 인원 이상이면 통과", () => {
    expect(capacityCheck(6, 6)).toEqual({ shortBy: 0, ok: true });
    expect(capacityCheck(8, 6)).toEqual({ shortBy: 0, ok: true });
  });
});

describe("tallyVotes", () => {
  const stays = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const vote = (accommodation_id: string) => ({ accommodation_id });

  it("표가 하나도 없으면 1순위도 없다", () => {
    const t = tallyVotes(stays, [], 3);
    expect(t.validVotes).toBe(0);
    expect(t.topCount).toBe(0);
    expect(t.topIds.size).toBe(0);
    expect(t.isTie).toBe(false);
    expect(t.remainingVoters).toBe(3);
  });

  it("최다 득표 하나면 동점이 아니다", () => {
    const t = tallyVotes(stays, [vote("a"), vote("a"), vote("b")], 3);
    expect(t.counts.get("a")).toBe(2);
    expect(t.counts.get("c")).toBeUndefined();
    expect(t.topCount).toBe(2);
    expect([...t.topIds]).toEqual(["a"]);
    expect(t.isTie).toBe(false);
    expect(t.ranked.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(t.remainingVoters).toBe(0);
  });

  it("동점이면 최다 득표 후보가 모두 남는다", () => {
    const t = tallyVotes(stays, [vote("a"), vote("b")], 2);
    expect(t.topCount).toBe(1);
    expect([...t.topIds].sort()).toEqual(["a", "b"]);
    expect(t.isTie).toBe(true);
  });

  it("미투표자가 있으면 남은 인원을 센다", () => {
    const t = tallyVotes(stays, [vote("a")], 4);
    expect(t.remainingVoters).toBe(3);
  });

  it("확정 인원을 모르면 남은 인원은 0으로 둔다", () => {
    expect(tallyVotes(stays, [vote("a")], null).remainingVoters).toBe(0);
  });

  it("확정 인원보다 표가 많아도 음수가 되지 않는다", () => {
    expect(tallyVotes(stays, [vote("a"), vote("b"), vote("c")], 2).remainingVoters).toBe(0);
  });

  it("삭제된 후보에 남은 표는 1순위 계산에 끼어들지 않는다", () => {
    const t = tallyVotes([{ id: "a" }], [vote("a"), vote("gone"), vote("gone")], 3);
    expect(t.topCount).toBe(1);
    expect([...t.topIds]).toEqual(["a"]);
  });
});

describe("votePercentage", () => {
  it("투표가 없으면 0%", () => {
    expect(votePercentage(0, 0)).toBe(0);
  });
  it("반올림한다", () => {
    expect(votePercentage(1, 3)).toBe(33);
    expect(votePercentage(2, 3)).toBe(67);
    expect(votePercentage(3, 3)).toBe(100);
  });
});
