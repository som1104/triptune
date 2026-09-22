import { describe, expect, it } from "vitest";
import {
  formatDateRangeKo,
  formatMonthHintKo,
  formatPrice,
  formatShortDateKo,
  formatTripLength,
  perPersonPrice,
} from "@/lib/trip/format";

describe("formatTripLength", () => {
  it("N일은 N-1박", () => {
    expect(formatTripLength(3)).toBe("2박 3일");
    expect(formatTripLength(1)).toBe("0박 1일");
  });
});

describe("formatPrice / perPersonPrice", () => {
  it("천 단위 구분", () => {
    expect(formatPrice(840000)).toBe("840,000원");
    expect(formatPrice(0)).toBe("0원");
  });

  it("1인당 금액은 올림해서 모자라지 않게 한다", () => {
    expect(perPersonPrice(840000, 6)).toBe(140000);
    expect(perPersonPrice(100000, 3)).toBe(33334);
    expect(perPersonPrice(1, 3)).toBe(1);
  });
});

describe("formatDateRangeKo", () => {
  it("같은 달이면 일자만 잇는다", () => {
    expect(formatDateRangeKo("2026-10-17", "2026-10-19")).toBe("10월 17일–19일");
  });
  it("달을 넘기면 월까지 쓴다", () => {
    expect(formatDateRangeKo("2026-10-30", "2026-11-02")).toBe("10월 30일–11월 2일");
  });
});

describe("formatShortDateKo / formatMonthHintKo", () => {
  it("짧은 날짜는 일자를 두 자리로 맞춘다", () => {
    expect(formatShortDateKo("2026-10-05")).toBe("10.05");
  });
  it("달만 정해진 여행은 '월 중'", () => {
    expect(formatMonthHintKo("2026-10-05")).toBe("10월 중");
  });
});
