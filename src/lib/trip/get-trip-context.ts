import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Participant, Trip } from "@/lib/supabase/database.types";

export interface TripContext {
  trip: Trip;
  participants: Participant[];
  me: Participant | null;
  isHost: boolean;
}

/* 한 번의 요청 안에서 layout 과 page 가 각자 이걸 부른다. React 의 cache 는
   렌더 한 번(=요청 한 번) 동안만 결과를 기억하므로, 같은 여행에 대한 조회가
   두 번 나가지 않으면서도 요청·사용자 사이에 값이 섞일 일은 없다.

   세 조회는 서로를 기다릴 이유가 없다 — 사용자 판별은 받아온 참여자 목록과
   맞춰보기만 하면 되고, 여행과 참여자는 tripId 만 있으면 된다. */
export const getTripContext = cache(async function getTripContext(
  tripId: string
): Promise<TripContext | null> {
  const supabase = await createClient();

  const [{ data: userData }, { data: trip }, { data: participants }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase
      .from("participants")
      .select("*")
      .eq("trip_id", tripId)
      .order("joined_at", { ascending: true }),
  ]);

  if (!trip) return null;

  const userId = userData.user?.id;
  const list = participants ?? [];
  const me = list.find((p) => p.user_id === userId) ?? null;

  return {
    trip,
    participants: list,
    me,
    isHost: me?.role === "host",
  };
});
