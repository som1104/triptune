import { describe, expect, it } from "vitest";
import { activeReopening, reopenStatusLabel, reopenTarget } from "./reopen";
import type { Trip } from "@/lib/supabase/database.types";

const base = {
  reopened_scope: null,
  reopened_reason: null,
  reopened_at: null,
  reopened_by_participant_id: null,
  status: "confirmed",
} as Pick<
  Trip,
  "reopened_scope" | "reopened_reason" | "reopened_at" | "reopened_by_participant_id" | "status"
>;

describe("activeReopening", () => {
  it("확정된 여행에는 재조율 배너가 뜨지 않는다", () => {
    expect(activeReopening(base)).toBeNull();
  });

  it("되돌린 적 없는 여행에도 뜨지 않는다", () => {
    expect(activeReopening({ ...base, status: "collecting_responses" })).toBeNull();
  });

  it("재개 기록이 있고 아직 확정 전이면 배너가 뜬다", () => {
    const r = activeReopening({
      ...base,
      status: "accommodation_voting",
      reopened_scope: "stay_vote",
      reopened_at: "2026-09-22T00:00:00Z",
      reopened_reason: "예약이 어려워졌어요.",
      reopened_by_participant_id: "p1",
    });
    expect(r).toEqual({
      scope: "stay_vote",
      reason: "예약이 어려워졌어요.",
      at: "2026-09-22T00:00:00Z",
      byParticipantId: "p1",
    });
  });

  it("다시 확정되면(status=confirmed) 기록이 남아 있어도 배너는 사라진다", () => {
    expect(
      activeReopening({
        ...base,
        status: "confirmed",
        reopened_scope: "stay_vote",
        reopened_at: "2026-09-22T00:00:00Z",
      })
    ).toBeNull();
  });
});

describe("reopenStatusLabel", () => {
  const stay = { scope: "stay_vote", reason: null, at: "", byParticipantId: null } as const;
  const dates = { scope: "group_direction", reason: null, at: "", byParticipantId: null } as const;

  it("재조율 중이 아니면 라벨이 없다", () => {
    expect(reopenStatusLabel("confirmed", null)).toBeNull();
  });

  it("숙소만 다시 연 경우", () => {
    expect(reopenStatusLabel("accommodation_voting", stay)).toBe("숙소 재투표 중");
  });

  it("날짜부터 다시 연 직후", () => {
    expect(reopenStatusLabel("collecting_responses", dates)).toBe("날짜·취향 재조율 중");
  });

  it("날짜를 다시 확정한 뒤에는 숙소 재검토 중", () => {
    expect(reopenStatusLabel("accommodation_collecting", dates)).toBe("숙소 재검토 중");
    expect(reopenStatusLabel("accommodation_voting", dates)).toBe("숙소 재검토 중");
  });
});

describe("reopenTarget", () => {
  it("숙소 재투표는 숙소 화면으로", () => {
    expect(reopenTarget("stay_vote", "t1").href).toBe("/trip/t1/stay");
  });
  it("날짜·취향 재조율은 응답 화면으로", () => {
    expect(reopenTarget("group_direction", "t1").href).toBe("/trip/t1/respond");
  });
});
