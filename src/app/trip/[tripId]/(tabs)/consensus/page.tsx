import { getTripContext } from "@/lib/trip/get-trip-context";
import { createClient } from "@/lib/supabase/server";
import { TripNotFound } from "@/components/trip/trip-not-found";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { StageLocked } from "@/components/trip/stage-locked";
import { ConsensusView } from "@/components/trip/consensus-view";
import {
  buildGroupSummary,
  computeDateCandidates,
  computePreferenceConsensus,
  computeStyleConsensus,
  topDateCandidates,
} from "@/lib/trip/consensus";
import type { ConsensusSnapshot } from "@/lib/supabase/database.types";

export default async function ConsensusPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const ctx = await getTripContext(tripId);
  if (!ctx) return <TripNotFound />;

  const { trip, participants, isHost } = ctx;
  const shared = {
    tripId: trip.id,
    isHost,
    tripTitle: trip.title,
    destination: trip.destination,
    tripDays: trip.trip_days,
    inviteToken: trip.invite_token,
  };

  if (trip.status === "collecting_responses") {
    const supabase = await createClient();
    const submitted = participants.filter((p) => p.response_status === "submitted");
    const submittedIds = submitted.map((p) => p.id);

    const [{ data: dateRows }, { data: prefRows }] = await Promise.all([
      submittedIds.length
        ? supabase.from("date_responses").select("*").in("participant_id", submittedIds)
        : Promise.resolve({ data: [] }),
      submittedIds.length
        ? supabase.from("preference_responses").select("*").in("participant_id", submittedIds)
        : Promise.resolve({ data: [] }),
    ]);

    const dateCandidates = topDateCandidates(
      computeDateCandidates(
        trip.candidate_start_date,
        trip.candidate_end_date,
        trip.trip_days,
        submittedIds,
        (dateRows ?? []).map((r) => ({
          participantId: r.participant_id,
          date: r.date,
          availability: r.availability,
        }))
      ),
      3
    );

    const preferenceInputs = (prefRows ?? []).map((r) => ({
      participantId: r.participant_id,
      nature: r.nature,
      food: r.food,
      cafe: r.cafe,
      activity: r.activity,
      pace: r.pace,
      spendingStyle: r.spending_style,
    }));
    const preferenceResults = computePreferenceConsensus(preferenceInputs);
    const paceConsensus = computeStyleConsensus(preferenceInputs.map((r) => r.pace));
    const spendingConsensus = computeStyleConsensus(preferenceInputs.map((r) => r.spendingStyle));
    // 함께 다니는 정도는 고른 사람만 센다 — 항목이 생기기 전 응답은 null 이다.
    const togethernessConsensus = computeStyleConsensus(
      (prefRows ?? [])
        .map((r) => r.togetherness)
        .filter((t): t is NonNullable<typeof t> => t != null)
    );
    // 자유 입력은 어떤 점수에도 들어가지 않는다. 쓴 사람 것만 그대로 나른다.
    const nicknameByParticipant = new Map(participants.map((p) => [p.id, p.nickname]));
    const notes = (prefRows ?? [])
      .filter((r) => r.note && r.note.trim())
      .map((r) => ({
        participantId: r.participant_id,
        nickname: nicknameByParticipant.get(r.participant_id) ?? "참여자",
        note: r.note!.trim(),
      }));
    const summary = buildGroupSummary(preferenceResults, paceConsensus);

    const pendingParticipants = participants.filter((p) => p.response_status !== "submitted");

    return (
      <ConsensusView
        {...shared}
        totalParticipants={participants.length}
        respondedCount={submitted.length}
        pendingNicknames={pendingParticipants.map((p) => p.nickname)}
        dateCandidates={dateCandidates}
        preferenceResults={preferenceResults}
        paceConsensus={paceConsensus}
        spendingConsensus={spendingConsensus}
        togethernessConsensus={togethernessConsensus}
        notes={notes}
        summary={summary}
      />
    );
  }

  // Direction already confirmed (or further along) — show the frozen snapshot.
  const supabase = await createClient();
  const { data: snapshot } = await supabase
    .from("consensus_snapshots")
    .select("*")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ConsensusSnapshot>();

  if (!snapshot) {
    return (
      <div className="flex flex-1 flex-col">
        <TripAppBar title="그룹 합의" />
        <StageLocked message="아직 확정된 합의 내용이 없어요." />
      </div>
    );
  }

  return (
    <ConsensusView
      {...shared}
      confirmedSnapshot={snapshot}
      canReopen={isHost && trip.status === "accommodation_collecting"}
    />
  );
}
