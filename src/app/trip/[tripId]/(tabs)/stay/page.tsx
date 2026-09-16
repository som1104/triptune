import { getTripContext } from "@/lib/trip/get-trip-context";
import { createClient } from "@/lib/supabase/server";
import { TripNotFound } from "@/components/trip/trip-not-found";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { StageLocked } from "@/components/trip/stage-locked";
import { StayCollectingView } from "@/components/trip/stay-collecting-view";

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

  if (trip.status === "accommodation_collecting") {
    if (!me) return <TripNotFound />;
    const supabase = await createClient();
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

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="숙소 정하기" />
      <StageLocked message="다음 단계는 곧 준비될 예정이에요." />
    </div>
  );
}
