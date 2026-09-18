import { getTripContext } from "@/lib/trip/get-trip-context";
import { createClient } from "@/lib/supabase/server";
import { TripNotFound } from "@/components/trip/trip-not-found";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { StageLocked } from "@/components/trip/stage-locked";
import { StayCollectingView } from "@/components/trip/stay-collecting-view";
import { VotingView } from "@/components/trip/voting-view";
import { VoteResultsView } from "@/components/trip/vote-results-view";
import { StayConfirmedView } from "@/components/trip/stay-confirmed-view";
import { formatShortDateKo } from "@/lib/trip/format";
import type { ConsensusSnapshot } from "@/lib/supabase/database.types";

export default async function StayPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const ctx = await getTripContext(tripId);
  if (!ctx) return <TripNotFound />;

  const { trip, participants, me, isHost } = ctx;
  const nights = Math.max(trip.trip_days - 1, 0);

  if (trip.status === "collecting_responses") {
    return (
      <div className="flex flex-1 flex-col">
        <TripAppBar title="숙소 정하기" />
        <StageLocked message="그룹 합의가 확정되면 숙소 후보를 등록할 수 있어요." />
      </div>
    );
  }

  const supabase = await createClient();

  if (trip.status === "accommodation_collecting") {
    if (!me) return <TripNotFound />;
    const [{ data: accommodations }, { data: snapshot }] = await Promise.all([
      supabase
        .from("accommodations")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true }),
      supabase
        .from("consensus_snapshots")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<ConsensusSnapshot>(),
    ]);

    const contextChips: string[] = [];
    if (trip.confirmed_start_date && trip.confirmed_end_date) {
      contextChips.push(
        `${formatShortDateKo(trip.confirmed_start_date)} — ${formatShortDateKo(trip.confirmed_end_date)}`
      );
    }
    contextChips.push(trip.destination);
    const summary = snapshot?.preference_summary as
      | { items?: Record<string, { classification: string }>; pace?: { mode: string | null } }
      | undefined;
    const prefLabel: Record<string, string> = {
      nature: "자연 중심",
      food: "맛집 중심",
      cafe: "카페 중심",
      activity: "활동 중심",
    };
    if (summary?.items) {
      for (const [key, item] of Object.entries(summary.items)) {
        if (item.classification === "favored" && prefLabel[key]) contextChips.push(prefLabel[key]);
      }
    }
    const paceLabel: Record<string, string> = {
      relaxed: "여유로운 일정",
      balanced: "적당한 일정",
      packed: "알찬 일정",
    };
    if (summary?.pace?.mode) contextChips.push(paceLabel[summary.pace.mode]);

    return (
      <StayCollectingView
        tripId={tripId}
        myParticipantId={me.id}
        isHost={isHost}
        participants={participants}
        initialAccommodations={accommodations ?? []}
        confirmedParticipantCount={trip.confirmed_participant_count}
        nights={nights}
        contextChips={contextChips}
      />
    );
  }

  const { data: accommodations } = await supabase
    .from("accommodations")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  const list = accommodations ?? [];

  if (trip.status === "accommodation_voting") {
    return (
      <VotingView
        tripId={tripId}
        isHost={isHost}
        accommodations={list}
        confirmedParticipantCount={trip.confirmed_participant_count}
      />
    );
  }

  const { data: votes } = await supabase
    .from("accommodation_votes")
    .select("*")
    .eq("trip_id", tripId);

  if (trip.status === "vote_result") {
    return (
      <VoteResultsView
        tripId={tripId}
        isHost={isHost}
        accommodations={list}
        votes={votes ?? []}
        confirmedParticipantCount={trip.confirmed_participant_count}
      />
    );
  }

  // confirmed
  const finalAccommodation = list.find((a) => a.id === trip.final_accommodation_id);
  if (!finalAccommodation) {
    return (
      <div className="flex flex-1 flex-col">
        <TripAppBar title="숙소 정하기" />
        <StageLocked message="확정된 숙소 정보를 불러오지 못했어요." />
      </div>
    );
  }

  return (
    <StayConfirmedView
      finalAccommodation={finalAccommodation}
      otherAccommodations={list.filter((a) => a.id !== finalAccommodation.id)}
      votes={votes ?? []}
      confirmedParticipantCount={trip.confirmed_participant_count}
    />
  );
}
