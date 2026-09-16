import { getTripContext } from "@/lib/trip/get-trip-context";
import { createClient } from "@/lib/supabase/server";
import { TripNotFound } from "@/components/trip/trip-not-found";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { StageLocked } from "@/components/trip/stage-locked";
import { StayCollectingView } from "@/components/trip/stay-collecting-view";
import { VotingView } from "@/components/trip/voting-view";
import { VoteResultsView } from "@/components/trip/vote-results-view";
import { StayConfirmedView } from "@/components/trip/stay-confirmed-view";

export default async function StayPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const ctx = await getTripContext(tripId);
  if (!ctx) return <TripNotFound />;

  const { trip, participants, me, isHost } = ctx;

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
    const { data: accommodations } = await supabase
      .from("accommodations")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });

    return (
      <StayCollectingView
        tripId={tripId}
        myParticipantId={me.id}
        isHost={isHost}
        participants={participants}
        initialAccommodations={accommodations ?? []}
        confirmedParticipantCount={trip.confirmed_participant_count}
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

  const { data: votes } = await supabase.from("accommodation_votes").select("*").eq("trip_id", tripId);

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
