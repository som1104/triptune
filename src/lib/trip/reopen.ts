import type { ReopenScope, Trip, TripStatus } from "@/lib/supabase/database.types";

/** 지금 열려 있는 재조율. 다시 확정되면 필드가 비워지므로 null 이 된다. */
export interface ActiveReopening {
  scope: ReopenScope;
  reason: string | null;
  at: string;
  byParticipantId: string | null;
}

export function activeReopening(
  trip: Pick<
    Trip,
    "reopened_scope" | "reopened_reason" | "reopened_at" | "reopened_by_participant_id" | "status"
  >
): ActiveReopening | null {
  // 다시 확정된 여행에는 배너를 띄우지 않는다. RPC 가 필드를 비우지만,
  // 혹시 남아 있더라도 상태를 함께 보고 판단한다.
  if (trip.status === "confirmed") return null;
  if (!trip.reopened_scope || !trip.reopened_at) return null;
  return {
    scope: trip.reopened_scope,
    reason: trip.reopened_reason,
    at: trip.reopened_at,
    byParticipantId: trip.reopened_by_participant_id,
  };
}

export const REOPEN_HEADLINE: Record<ReopenScope, string> = {
  stay_vote: "주최자가 숙소 투표를 다시 열었어요.",
  group_direction: "주최자가 날짜와 취향 조율을 다시 열었어요.",
};

export const REOPEN_DETAIL: Record<ReopenScope, string> = {
  stay_vote:
    "확정된 날짜와 취향은 그대로예요. 기존 숙소 후보와 투표도 남아 있고, 투표를 다시 고를 수 있어요.",
  group_direction:
    "기존 응답과 숙소 후보는 그대로 남아 있어요. 날짜·취향 응답을 수정하면 그룹 합의에 바로 반영돼요.",
};

/** 배너의 이동 버튼이 가리킬 곳 — 다시 열린 단계. */
export function reopenTarget(scope: ReopenScope, tripId: string): { href: string; label: string } {
  return scope === "stay_vote"
    ? { href: `/trip/${tripId}/stay`, label: "숙소 투표하러 가기" }
    : { href: `/trip/${tripId}/respond`, label: "내 날짜·취향 수정하기" };
}

/* 내 여행 목록의 라벨. 재조율 중인 여행이 '확정'으로 보이면 안 되고, 처음
   진행 중인 여행과도 구분돼야 한다. */
export function reopenStatusLabel(
  status: TripStatus,
  reopening: ActiveReopening | null
): string | null {
  if (!reopening) return null;
  if (reopening.scope === "stay_vote") return "숙소 재투표 중";
  // 날짜부터 다시 연 경우, 날짜가 다시 확정되면 숙소 재검토 단계로 넘어간다.
  return status === "collecting_responses" ? "날짜·취향 재조율 중" : "숙소 재검토 중";
}
