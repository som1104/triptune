import { describe, expect, it } from "vitest";
import { accommodationSchema } from "@/lib/validation/accommodation";

const base = {
  url: "https://example.com/room",
  name: "테스트 스테이",
  location: "제주시",
  rooms: [] as unknown[],
};

function issuePaths(result: ReturnType<typeof accommodationSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("accommodationSchema — 숙소 전체 사용", () => {
  it("인원과 금액이 모두 있으면 통과", () => {
    const r = accommodationSchema.safeParse({
      ...base,
      bookingMode: "whole",
      capacity: 6,
      totalPrice: 840000,
    });
    expect(r.success).toBe(true);
  });

  it("인원이 0이면 막는다", () => {
    const r = accommodationSchema.safeParse({
      ...base,
      bookingMode: "whole",
      capacity: 0,
      totalPrice: 840000,
    });
    expect(issuePaths(r)).toContain("capacity");
  });

  it("금액이 0이면 막는다", () => {
    const r = accommodationSchema.safeParse({
      ...base,
      bookingMode: "whole",
      capacity: 6,
      totalPrice: 0,
    });
    expect(issuePaths(r)).toContain("totalPrice");
  });
});

describe("accommodationSchema — 객실 여러 개", () => {
  const rooms = [{ name: "디럭스 트윈", count: 2, capacityPerRoom: 2, pricePerRoom: 120000 }];

  it("객실이 한 종류 이상이면 통과 (인원·금액은 구성에서 계산)", () => {
    const r = accommodationSchema.safeParse({
      ...base,
      bookingMode: "rooms",
      capacity: 0,
      totalPrice: 0,
      rooms,
    });
    expect(r.success).toBe(true);
  });

  it("객실이 하나도 없으면 막는다", () => {
    const r = accommodationSchema.safeParse({
      ...base,
      bookingMode: "rooms",
      capacity: 0,
      totalPrice: 0,
      rooms: [],
    });
    expect(issuePaths(r)).toContain("rooms");
  });

  it("객실 이름이 비면 그 줄을 짚어준다", () => {
    const r = accommodationSchema.safeParse({
      ...base,
      bookingMode: "rooms",
      capacity: 0,
      totalPrice: 0,
      rooms: [{ name: "  ", count: 1, capacityPerRoom: 2, pricePerRoom: 100 }],
    });
    expect(issuePaths(r)).toContain("rooms.0.name");
  });

  it("객실 수·인원·금액은 1 이상이어야 한다", () => {
    const r = accommodationSchema.safeParse({
      ...base,
      bookingMode: "rooms",
      capacity: 0,
      totalPrice: 0,
      rooms: [{ name: "온돌", count: 0, capacityPerRoom: 0, pricePerRoom: 0 }],
    });
    const paths = issuePaths(r);
    expect(paths).toContain("rooms.0.count");
    expect(paths).toContain("rooms.0.capacityPerRoom");
    expect(paths).toContain("rooms.0.pricePerRoom");
  });
});

describe("accommodationSchema — 공통", () => {
  it("http(s)가 아닌 링크는 막는다", () => {
    const r = accommodationSchema.safeParse({
      ...base,
      url: "javascript:alert(1)",
      bookingMode: "whole",
      capacity: 2,
      totalPrice: 1,
    });
    expect(issuePaths(r)).toContain("url");
  });

  it("이용 방식을 고르지 않으면 막는다", () => {
    const r = accommodationSchema.safeParse({ ...base, capacity: 2, totalPrice: 1 });
    expect(issuePaths(r)).toContain("bookingMode");
  });
});
