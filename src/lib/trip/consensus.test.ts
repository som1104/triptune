import { describe, expect, it } from "vitest";
import {
  buildGroupSummary,
  computeDateCandidates,
  computePreferenceConsensus,
  computeStyleConsensus,
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
