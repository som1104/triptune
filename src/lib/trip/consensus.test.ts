import { describe, expect, it } from "vitest";
import {
  buildGroupSummary,
  computeDateCandidates,
  computePreferenceConsensus,
  computeStyleConsensus,
  countDateStates,
  topDateCandidates,
  type DateResponseInput,
  type PreferenceResponseInput,
} from "./consensus";

describe("computeDateCandidates", () => {
  it("enumerates every consecutive tripDays window in the candidate range", () => {
    const candidates = computeDateCandidates("2026-10-01", "2026-10-10", 3, ["p1"], []);
    // 10 days, 3-day window -> 8 possible windows (1-3 .. 8-10)
    expect(candidates).toHaveLength(8);
    expect(candidates[candidates.length - 1]).toMatchObject({
      startDate: "2026-10-08",
      endDate: "2026-10-10",
    });
  });

  it("marks a window as 합의 후보 only when nobody is unavailable", () => {
    const responses: DateResponseInput[] = [
      { participantId: "p1", date: "2026-10-01", availability: "available" },
      { participantId: "p1", date: "2026-10-02", availability: "available" },
      { participantId: "p2", date: "2026-10-01", availability: "available" },
      { participantId: "p2", date: "2026-10-02", availability: "tentative" },
    ];
    const candidates = computeDateCandidates("2026-10-01", "2026-10-02", 2, ["p1", "p2"], responses);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].label).toBe("합의 후보");
    expect(candidates[0].fullyAvailableCount).toBe(1);
    expect(candidates[0].tentativeOnlyCount).toBe(1);
    expect(candidates[0].unavailableCount).toBe(0);
  });

  it("marks a window as 조율 필요 as soon as one participant is unavailable", () => {
    const responses: DateResponseInput[] = [
      { participantId: "p1", date: "2026-10-01", availability: "available" },
      { participantId: "p2", date: "2026-10-01", availability: "unavailable" },
    ];
    const candidates = computeDateCandidates("2026-10-01", "2026-10-01", 1, ["p1", "p2"], responses);
    expect(candidates[0].label).toBe("조율 필요");
    expect(candidates[0].unavailableCount).toBe(1);
  });

  it("treats a date with no response row as unavailable for scoring", () => {
    // p2 never responded for 10-02 at all.
    const responses: DateResponseInput[] = [
      { participantId: "p1", date: "2026-10-01", availability: "available" },
      { participantId: "p1", date: "2026-10-02", availability: "available" },
      { participantId: "p2", date: "2026-10-01", availability: "available" },
    ];
    const candidates = computeDateCandidates("2026-10-01", "2026-10-02", 2, ["p1", "p2"], responses);
    expect(candidates[0].unavailableCount).toBe(1);
    expect(candidates[0].label).toBe("조율 필요");
  });

  it("still returns the best-effort top 3 when no window is fully open", () => {
    const responses: DateResponseInput[] = [
      { participantId: "p1", date: "2026-10-01", availability: "unavailable" },
      { participantId: "p1", date: "2026-10-02", availability: "unavailable" },
      { participantId: "p1", date: "2026-10-03", availability: "unavailable" },
    ];
    const candidates = computeDateCandidates("2026-10-01", "2026-10-03", 1, ["p1"], responses);
    const top = topDateCandidates(candidates, 3);
    expect(top).toHaveLength(3);
    expect(top.every((c) => c.label === "조율 필요")).toBe(true);
  });

  it("ranks fewer-unavailable and earlier-start windows higher", () => {
    const responses: DateResponseInput[] = [
      { participantId: "p1", date: "2026-10-01", availability: "unavailable" },
      { participantId: "p1", date: "2026-10-02", availability: "available" },
      { participantId: "p1", date: "2026-10-03", availability: "available" },
    ];
    const candidates = computeDateCandidates("2026-10-01", "2026-10-03", 1, ["p1"], responses);
    // 10-02 and 10-03 are both fully open for the sole participant; 10-02 should
    // sort first because it starts earlier.
    expect(candidates[0].startDate).toBe("2026-10-02");
    expect(candidates[1].startDate).toBe("2026-10-03");
    expect(candidates[2].startDate).toBe("2026-10-01");
  });

  it("returns nothing when tripDays exceeds the candidate span", () => {
    expect(computeDateCandidates("2026-10-01", "2026-10-02", 5, ["p1"], [])).toEqual([]);
  });
});

describe("computePreferenceConsensus", () => {
  const base: Omit<PreferenceResponseInput, "participantId" | "nature"> = {
    food: 0,
    cafe: 0,
    activity: 0,
    pace: "balanced",
    spendingStyle: "balanced",
  };

  it("classifies a strong positive lean as 합의된 선호 (favored)", () => {
    const responses: PreferenceResponseInput[] = [2, 2, 1].map((nature, i) => ({
      participantId: `p${i}`,
      nature,
      ...base,
    }));
    const result = computePreferenceConsensus(responses);
    expect(result.nature.classification).toBe("favored");
    expect(result.nature.average).toBeCloseTo(5 / 3);
  });

  it("classifies a strong negative lean as 그룹 비선호 (disfavored)", () => {
    const responses: PreferenceResponseInput[] = [-2, -1, -1].map((nature, i) => ({
      participantId: `p${i}`,
      nature,
      ...base,
    }));
    const result = computePreferenceConsensus(responses);
    expect(result.nature.classification).toBe("disfavored");
  });

  it("classifies a +2/-2 split as 충돌 (conflict) even if the average looks fine", () => {
    const responses: PreferenceResponseInput[] = [2, 2, 2, -2].map((nature, i) => ({
      participantId: `p${i}`,
      nature,
      ...base,
    }));
    const result = computePreferenceConsensus(responses);
    expect(result.nature.average).toBeGreaterThanOrEqual(0.75); // would otherwise read as "favored"
    expect(result.nature.classification).toBe("conflict");
  });

  it("classifies mild, non-polarized scores as neutral", () => {
    const responses: PreferenceResponseInput[] = [0, 0, 1].map((nature, i) => ({
      participantId: `p${i}`,
      nature,
      ...base,
    }));
    const result = computePreferenceConsensus(responses);
    expect(result.nature.classification).toBe("neutral");
  });
});

describe("computeStyleConsensus", () => {
  it("picks the clear majority", () => {
    const result = computeStyleConsensus(["relaxed", "relaxed", "packed"]);
    expect(result.mode).toBe("relaxed");
    expect(result.isSplit).toBe(false);
  });

  it("reports a split when there is no unique majority", () => {
    const result = computeStyleConsensus(["relaxed", "balanced", "packed"]);
    expect(result.mode).toBeNull();
    expect(result.isSplit).toBe(true);
  });
});

describe("buildGroupSummary", () => {
  const neutral = { average: 0, classification: "neutral" as const, counts: { [-2]: 0, [-1]: 0, 0: 1, 1: 0, 2: 0 }, responseCount: 1 };

  it("matches the spec's worked example", () => {
    const prefs = {
      nature: { ...neutral, key: "nature" as const, average: 1.6, classification: "favored" as const },
      food: { ...neutral, key: "food" as const, average: 1.2, classification: "favored" as const },
      cafe: { ...neutral, key: "cafe" as const },
      activity: { ...neutral, key: "activity" as const },
    };
    const pace = computeStyleConsensus(["relaxed", "relaxed", "balanced"]);
    expect(buildGroupSummary(prefs, pace)).toBe("자연과 맛집을 중심으로, 여유롭게 즐기는 여행이에요.");
  });

  it("falls back to the neutral phrase when nothing is strongly favored", () => {
    const prefs = {
      nature: { ...neutral, key: "nature" as const },
      food: { ...neutral, key: "food" as const },
      cafe: { ...neutral, key: "cafe" as const },
      activity: { ...neutral, key: "activity" as const },
    };
    const pace = computeStyleConsensus(["relaxed"]);
    expect(buildGroupSummary(prefs, pace)).toBe("다양한 취향을 조율하고 있어요.");
  });

  it("uses a single-item phrase when only one preference is strongly favored", () => {
    const prefs = {
      nature: { ...neutral, key: "nature" as const },
      food: { ...neutral, key: "food" as const, average: 1.5, classification: "favored" as const },
      cafe: { ...neutral, key: "cafe" as const },
      activity: { ...neutral, key: "activity" as const },
    };
    const pace = computeStyleConsensus(["packed", "packed"]);
    expect(buildGroupSummary(prefs, pace)).toBe("맛집을 중심으로, 알차게 즐기는 여행이에요.");
  });
});

// ============================================================
// 날짜별 상태 집계 (내 응답 화면 요약)
// ============================================================

describe("countDateStates", () => {
  const range = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];

  it("손대지 않은 날짜는 모두 미정으로 센다", () => {
    expect(countDateStates(range, {})).toEqual({ available: 0, tentative: 4, unavailable: 0 });
  });

  it("칠한 날짜만 바뀌고 합은 언제나 후보 기간 전체와 같다", () => {
    const counts = countDateStates(range, {
      "2026-10-01": "available",
      "2026-10-02": "available",
      "2026-10-04": "unavailable",
    });
    expect(counts).toEqual({ available: 2, tentative: 1, unavailable: 1 });
    expect(counts.available + counts.tentative + counts.unavailable).toBe(range.length);
  });

  it("후보 기간 밖의 날짜는 세지 않는다", () => {
    expect(countDateStates(range, { "2026-11-01": "available" })).toEqual({
      available: 0,
      tentative: 4,
      unavailable: 0,
    });
  });
});

// ============================================================
// 날짜별 충돌 인원 — tripDays=1 이면 창 하나가 곧 하루다.
// ============================================================

describe("날짜별 충돌 인원", () => {
  const byDate = (rows: DateResponseInput[], ids: string[]) => {
    const perDay = computeDateCandidates("2026-10-01", "2026-10-03", 1, ids, rows);
    return new Map(perDay.map((c) => [c.startDate, c]));
  };

  it("하루마다 가능·미정·불가 인원을 따로 센다", () => {
    const map = byDate(
      [
        { participantId: "p1", date: "2026-10-01", availability: "available" },
        { participantId: "p2", date: "2026-10-01", availability: "unavailable" },
        { participantId: "p3", date: "2026-10-01", availability: "tentative" },
        { participantId: "p1", date: "2026-10-02", availability: "available" },
        { participantId: "p2", date: "2026-10-02", availability: "available" },
        { participantId: "p3", date: "2026-10-02", availability: "available" },
      ],
      ["p1", "p2", "p3"]
    );

    expect(map.get("2026-10-01")).toMatchObject({
      fullyAvailableCount: 1,
      tentativeOnlyCount: 1,
      unavailableCount: 1,
      label: "조율 필요",
    });
    expect(map.get("2026-10-02")).toMatchObject({
      fullyAvailableCount: 3,
      unavailableCount: 0,
      label: "합의 후보",
    });
    // 아무도 응답하지 않은 날은 전원 불가로 본다.
    expect(map.get("2026-10-03")).toMatchObject({ unavailableCount: 3, fullyAvailableCount: 0 });
  });

  it("충돌이 적은 날이 앞에 온다", () => {
    const ranked = computeDateCandidates(
      "2026-10-01",
      "2026-10-02",
      1,
      ["p1", "p2"],
      [
        { participantId: "p1", date: "2026-10-01", availability: "unavailable" },
        { participantId: "p2", date: "2026-10-01", availability: "available" },
        { participantId: "p1", date: "2026-10-02", availability: "available" },
        { participantId: "p2", date: "2026-10-02", availability: "available" },
      ]
    );
    expect(ranked[0].startDate).toBe("2026-10-02");
    expect(ranked[0].unavailableCount).toBe(0);
    expect(ranked[1].unavailableCount).toBe(1);
  });
});

// ============================================================
// 자유 입력(꼭 반영할 점)은 어떤 자동 계산에도 들어가지 않는다.
// ============================================================

describe("직접 입력 의견은 자동 점수에서 제외된다", () => {
  const responses: PreferenceResponseInput[] = [
    { participantId: "p1", nature: 2, food: 1, cafe: 0, activity: 1, pace: "relaxed", spendingStyle: "value" },
    { participantId: "p2", nature: 1, food: 2, cafe: 0, activity: 1, pace: "relaxed", spendingStyle: "value" },
  ];

  /* 화면에서는 note 가 같은 행에 실려 오지만, 계산 함수의 입력 타입에는 없다.
     혹시 섞여 들어오더라도 결과가 달라지지 않아야 한다. */
  const withNotes = responses.map((r, i) => ({
    ...r,
    note: i === 0 ? "채식 식당이 꼭 필요해요" : "저는 카페를 정말 좋아합니다",
  })) as PreferenceResponseInput[];

  it("취향 평균과 분류가 그대로다", () => {
    expect(computePreferenceConsensus(withNotes)).toEqual(computePreferenceConsensus(responses));
  });

  it("여행 스타일 합의도 그대로다", () => {
    expect(computeStyleConsensus(withNotes.map((r) => r.pace))).toEqual(
      computeStyleConsensus(responses.map((r) => r.pace))
    );
  });

  it("한 줄 요약도 그대로다", () => {
    const pace = computeStyleConsensus(responses.map((r) => r.pace));
    expect(buildGroupSummary(computePreferenceConsensus(withNotes), pace)).toBe(
      buildGroupSummary(computePreferenceConsensus(responses), pace)
    );
  });

  it("자유 입력만 다르고 점수가 같은 두 응답은 완전히 같은 결과를 낸다", () => {
    const a = computePreferenceConsensus(withNotes);
    const b = computePreferenceConsensus(
      responses.map((r) => ({ ...r, note: "전혀 다른 내용" })) as PreferenceResponseInput[]
    );
    expect(a).toEqual(b);
  });
});
