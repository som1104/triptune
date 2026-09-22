import { describe, expect, it } from "vitest";
import { MAX_CANDIDATE_SPAN_DAYS, candidateSpanDays, createTripSchema } from "@/lib/validation/trip";

/** 오늘에 의존하지 않도록, 언제 돌려도 미래인 기준일을 만들어 쓴다. */
function futureIso(offsetDays: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 30 + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const base = {
  title: "제주도 여행",
  destination: "제주도",
  nights: 2,
  expectedParticipantCount: 4,
  hostNickname: "호스트",
};

function paths(result: ReturnType<typeof createTripSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("candidateSpanDays", () => {
  it("양끝을 모두 포함해서 센다", () => {
    expect(candidateSpanDays("2026-10-01", "2026-10-01")).toBe(1);
    expect(candidateSpanDays("2026-10-01", "2026-10-10")).toBe(10);
  });

  it("달을 넘겨도 날짜 수로만 센다", () => {
    expect(candidateSpanDays("2026-10-20", "2026-11-10")).toBe(22);
  });

  it("서머타임이 있는 지역에서도 어긋나지 않는다 (반올림)", () => {
    expect(candidateSpanDays("2026-03-01", "2026-04-30")).toBe(61);
  });
});

describe("createTripSchema", () => {
  it("후보 기간이 한 달을 넘어도 통과한다", () => {
    const r = createTripSchema.safeParse({
      ...base,
      candidateStartDate: futureIso(0),
      candidateEndDate: futureIso(44),
    });
    expect(r.success).toBe(true);
  });

  it(`${MAX_CANDIDATE_SPAN_DAYS}일까지는 통과하고 그 다음 날부터 막는다`, () => {
    const ok = createTripSchema.safeParse({
      ...base,
      candidateStartDate: futureIso(0),
      candidateEndDate: futureIso(MAX_CANDIDATE_SPAN_DAYS - 1),
    });
    expect(ok.success).toBe(true);

    const tooLong = createTripSchema.safeParse({
      ...base,
      candidateStartDate: futureIso(0),
      candidateEndDate: futureIso(MAX_CANDIDATE_SPAN_DAYS),
    });
    expect(paths(tooLong)).toContain("candidateEndDate");
  });

  it("지난 날짜는 시작일로 쓸 수 없다", () => {
    const r = createTripSchema.safeParse({
      ...base,
      candidateStartDate: "2020-01-01",
      candidateEndDate: futureIso(5),
    });
    expect(paths(r)).toContain("candidateStartDate");
  });

  it("종료일이 시작일보다 빠르면 막는다", () => {
    const r = createTripSchema.safeParse({
      ...base,
      candidateStartDate: futureIso(10),
      candidateEndDate: futureIso(3),
    });
    expect(paths(r)).toContain("candidateEndDate");
  });

  it("여행 기간이 후보 기간보다 길면 막는다", () => {
    const r = createTripSchema.safeParse({
      ...base,
      nights: 5, // 6일
      candidateStartDate: futureIso(0),
      candidateEndDate: futureIso(2), // 3일
    });
    expect(paths(r)).toContain("nights");
  });

  it("여행 기간이 후보 기간과 정확히 같으면 통과", () => {
    const r = createTripSchema.safeParse({
      ...base,
      nights: 2, // 3일
      candidateStartDate: futureIso(0),
      candidateEndDate: futureIso(2), // 3일
    });
    expect(r.success).toBe(true);
  });

  it("인원은 2~10명", () => {
    expect(
      paths(
        createTripSchema.safeParse({
          ...base,
          expectedParticipantCount: 11,
          candidateStartDate: futureIso(0),
          candidateEndDate: futureIso(9),
        })
      )
    ).toContain("expectedParticipantCount");
  });
});
