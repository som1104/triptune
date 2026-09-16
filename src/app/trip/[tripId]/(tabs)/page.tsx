import Link from "next/link";
import { getTripContext } from "@/lib/trip/get-trip-context";
import { TripNotFound } from "@/components/trip/trip-not-found";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { CoverImage } from "@/components/ui/cover-image";
import { InviteLinkCard } from "@/components/trip/invite-link-card";
import { ParticipantRoster } from "@/components/trip/participant-roster";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMonthKo, formatTripLength, TRIP_STATUS_LABEL } from "@/lib/trip/format";

export default async function TripHomePage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const ctx = await getTripContext(tripId);
  if (!ctx) return <TripNotFound />;

  const { trip, participants, me } = ctx;

  if (trip.status !== "collecting_responses") {
    return (
      <div className="flex flex-1 flex-col">
        <TripAppBar title={trip.title} />
        <CoverImage height={200}>
          <p className="m-0 mb-1 text-xs font-semibold text-white">{trip.destination}</p>
          <h2 className="m-0 text-2xl font-bold text-white">{trip.title}</h2>
        </CoverImage>
        <div className="flex flex-1 flex-col gap-4 px-5 py-6">
          <Badge variant="primary">{TRIP_STATUS_LABEL[trip.status]}</Badge>
          <p className="text-sm text-text-muted">
            {trip.confirmed_start_date && trip.confirmed_end_date
              ? `확정 날짜: ${formatMonthKo(trip.confirmed_start_date)} · ${formatTripLength(trip.trip_days)}`
              : "그룹 합의가 진행되고 있어요."}
          </p>
          <Link href={`/trip/${trip.id}/stay`}>
            <Button variant="primary" fullWidth>
              숙소 정하기로 이동
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const myStatus = me?.response_status ?? "not_started";

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="TRIPTUNE" />
      <CoverImage height={200}>
        <p className="m-0 mb-1 text-xs font-semibold text-white">{trip.destination}</p>
        <h2 className="m-0 text-2xl font-bold text-white">{trip.title}</h2>
        <p className="m-0 mt-1 text-xs text-white/90">
          {formatMonthKo(trip.candidate_start_date)} 중 · {formatTripLength(trip.trip_days)}
        </p>
      </CoverImage>

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        {ctx.isHost && <InviteLinkCard inviteToken={trip.invite_token} tripTitle={trip.title} />}

        <ParticipantRoster
          tripId={trip.id}
          initialParticipants={participants}
          expectedCount={trip.expected_participant_count}
        />

        <div className="mt-auto pt-2">
          <Link href={`/trip/${trip.id}/respond`}>
            <Button variant="primary" size="lg" fullWidth>
              {myStatus === "submitted" ? "내 날짜·취향 수정하기" : "내 날짜·취향 입력하기"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
