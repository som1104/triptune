import { createClient } from "@/lib/supabase/server";
import type { Participant, Trip } from "@/lib/supabase/database.types";

export interface TripContext {
  trip: Trip;
  participants: Participant[];
  me: Participant | null;
  isHost: boolean;
}

export async function getTripContext(tripId: string): Promise<TripContext | null> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (!trip) return null;

  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .eq("trip_id", tripId)
    .order("joined_at", { ascending: true });

  const list = participants ?? [];
  const me = list.find((p) => p.user_id === userId) ?? null;

  return {
    trip,
    participants: list,
    me,
    isHost: me?.role === "host",
  };
}
