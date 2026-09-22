import { describe, expect, it } from "vitest";
import { getMonthGrid } from "@/lib/trip/calendar";

describe("getMonthGrid", () => {
  const grid = getMonthGrid(2026, 9 /* 10월 */, "2026-10-05", "2026-10-20");

  it("월요일로 시작하고 7의 배수 칸을 만든다", () => {
    expect(grid.length % 7).toBe(0);
    // 2026-10-01은 목요일 -> 앞에 월·화·수 세 칸이 9월에서 채워진다.
    expect(grid[0].iso).toBe("2026-09-28");
    expect(grid[3].iso).toBe("2026-10-01");
  });

  it("해당 월인지 표시한다", () => {
    expect(grid[0].inCurrentMonth).toBe(false);
    expect(grid[3].inCurrentMonth).toBe(true);
    expect(grid.filter((c) => c.inCurrentMonth)).toHaveLength(31);
  });

  it("후보 기간 안팎을 구분한다 (경계 포함)", () => {
    const byIso = new Map(grid.map((c) => [c.iso, c]));
    expect(byIso.get("2026-10-04")!.inCandidateRange).toBe(false);
    expect(byIso.get("2026-10-05")!.inCandidateRange).toBe(true);
    expect(byIso.get("2026-10-20")!.inCandidateRange).toBe(true);
    expect(byIso.get("2026-10-21")!.inCandidateRange).toBe(false);
  });

  it("칸 안에서 날짜가 중복되지 않는다", () => {
    expect(new Set(grid.map((c) => c.iso)).size).toBe(grid.length);
  });

  it("다음 달로만 채워지는 마지막 주는 잘라낸다", () => {
    const last7 = grid.slice(-7);
    expect(last7.some((c) => c.inCurrentMonth)).toBe(true);
  });
});
