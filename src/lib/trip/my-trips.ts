import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { activeReopening, reopenStatusLabel } from "@/lib/trip/reopen";
import type { Participant, Trip, TripStatus } from "@/lib/supabase/database.types";

export interface MyTrip {
  trip: Trip;
  memberCount: number;
  pendingCount: number;
  isHost: boolean;
  /** avatars for the card footer */
  members: { id: string; nickname: string }[];
  /** one line telling the user what this trip is waiting on */
  nextAction: string;
  /** 재조율 중이면 '확정' 대신 보여줄 라벨 */
  reopenLabel: string | null;
}

/* RLS on `trips` is `is_trip_participant(id)`, so a plain select already
   returns exactly the trips this browser's session takes part in — guest or
   signed in. No extra table, no localStorage list, nothing to migrate when a
   guest later saves the account. */
export const getMyTrips = cache(async function getMyTrips(): Promise<MyTrip[]> {
  const supabase = await createClient();

  // 누구인지 확인하는 일과 여행 목록을 받아오는 일은 서로를 기다릴 필요가 없다.
  // 목록은 어차피 RLS 가 이 세션의 여행으로만 좁혀서 돌려준다.
  const [{ data: userData }, { data: trips }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("trips").select("*").order("created_at", { ascending: false }),
  ]);

  const userId = userData.user?.id ?? null;
  if (!userId) return [];

  const list = trips ?? [];
  if (list.length === 0) return [];

  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .in(
      "trip_id",
      list.map((t) => t.id)
    )
    // 참여 순서가 아바타 색을 정하므로 정렬이 곧 표시 규칙이다.
    .order("joined_at", { ascending: true });

  const byTrip = new Map<string, Participant[]>();
  for (const p of participants ?? []) {
    const arr = byTrip.get(p.trip_id) ?? [];
    arr.push(p);
    byTrip.set(p.trip_id, arr);
  }

  return list.map((trip) => {
    const members = byTrip.get(trip.id) ?? [];
    const me = members.find((p) => p.user_id === userId);
    const pending = members.filter((p) => p.response_status !== "submitted").length;

    return {
      trip,
      memberCount: members.length,
      pendingCount: pending,
      isHost: me?.role === "host",
      members: members.map((m) => ({ id: m.id, nickname: m.nickname })),
      nextAction: nextActionFor(trip.status, pending),
      reopenLabel: reopenStatusLabel(trip.status, activeReopening(trip)),
    };
  });
});

export function nextActionFor(status: TripStatus, pendingCount: number): string {
  switch (status) {
    case "collecting_responses":
      return pendingCount > 0
        ? `${pendingCount}명이 아직 응답하지 않았어요.`
        : "그룹 합의를 확인해 주세요.";
    case "accommodation_collecting":
      return "숙소 후보를 모으는 중이에요.";
    case "accommodation_voting":
      return "숙소 투표가 진행 중이에요.";
    case "vote_result":
      return "최종 숙소를 확정해 주세요.";
    case "confirmed":
      return "여행이 확정됐어요.";
  }
}
