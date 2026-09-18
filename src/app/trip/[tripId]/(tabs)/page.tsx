import { ArrowRight, Calendar, Trees, Users } from "lucide-react";
import { getTripContext } from "@/lib/trip/get-trip-context";
import { createClient } from "@/lib/supabase/server";
import { TripNotFound } from "@/components/trip/trip-not-found";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { CoverImage } from "@/components/ui/cover-image";
import { InviteLinkCard } from "@/components/trip/invite-link-card";
import { ParticipantRoster } from "@/components/trip/participant-roster";
import { FinalTripView } from "@/components/trip/final-trip-view";
import { TripStageProgress } from "@/components/trip/trip-stage-progress";
import { Container } from "@/components/layout/container";
import { GuestNoticeModal, SaveTripCard } from "@/components/auth/guest-notice-modal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FactRow } from "@/components/ui/summary-row";
import { FooterNote, ScreenFooter } from "@/components/ui/screen-footer";
import {
  formatDateKo,
  formatMonthKo,
  formatTripLength,
  formatShortDateKo,
  TRIP_STATUS_LABEL,
} from "@/lib/trip/format";
import type { ConsensusSnapshot, TripStatus } from "@/lib/supabase/database.types";

/* What the home screen says while the group is between "방향 확정" and
   "여행 확정" — one headline, one lead line and one next action per stage. */
const STAGE_COPY: Partial<
  Record<TripStatus, { headline: string; lead: string; cta: string; href: (id: string) => string }>
> = {
  accommodation_collecting: {
    headline: "숙소를 모으는 중이에요.",
    lead: "날짜와 방향은 정해졌어요. 이제 묵고 싶은 숙소를 후보로 올려주세요.",
    cta: "숙소 후보 등록하러 가기",
    href: (id) => `/trip/${id}/stay`,
  },
  accommodation_voting: {
    headline: "숙소 투표가 열렸어요.",
    lead: "후보 중 한 곳을 골라주세요. 모두 투표하면 결과가 공개돼요.",
    cta: "투표하러 가기",
    href: (id) => `/trip/${id}/stay`,
  },
  vote_result: {
    headline: "투표가 끝났어요.",
    lead: "결과를 확인하고, 주최자가 최종 숙소를 확정하면 여행이 완성돼요.",
    cta: "투표 결과 보기",
    href: (id) => `/trip/${id}/stay`,
  },
};

export default async function TripHomePage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const ctx = await getTripContext(tripId);
  if (!ctx) return <TripNotFound />;

  const { trip, participants, me } = ctx;

  if (trip.status === "confirmed") {
    const supabase = await createClient();
    const [{ data: finalAccommodation }, { data: snapshot }] = await Promise.all([
      trip.final_accommodation_id
        ? supabase
            .from("accommodations")
            .select("*")
            .eq("id", trip.final_accommodation_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("consensus_snapshots")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<ConsensusSnapshot>(),
    ]);

    const summary = snapshot?.preference_summary as { summarySentence?: string } | undefined;

    return (
      <FinalTripView
        trip={trip}
        finalAccommodation={finalAccommodation ?? null}
        participants={participants}
        summarySentence={summary?.summarySentence ?? null}
      />
    );
  }

  // ── Between 방향 확정 and 여행 확정 ──────────────────────────────────
  if (trip.status !== "collecting_responses") {
    const supabase = await createClient();
    const [{ data: snapshot }, { count: accommodationCount }] = await Promise.all([
      supabase
        .from("consensus_snapshots")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<ConsensusSnapshot>(),
      supabase
        .from("accommodations")
        .select("*", { count: "exact", head: true })
        .eq("trip_id", tripId),
    ]);

    const summary = snapshot?.preference_summary as { summarySentence?: string } | undefined;
    const copy = STAGE_COPY[trip.status];
    const startDate = trip.confirmed_start_date ?? snapshot?.selected_start_date ?? null;
    const endDate = trip.confirmed_end_date ?? snapshot?.selected_end_date ?? null;
    const memberCount = trip.confirmed_participant_count ?? participants.length;

    return (
      <div className="flex flex-1 flex-col">
        <TripAppBar title="TRIPTUNE" profile />
        <CoverImage height={200} padBottom={16}>
          <p className="m-0 mb-1.5 text-xs font-semibold text-white">{trip.destination}</p>
          <h2 className="m-0 text-2xl font-[650] leading-[1.2] text-white">{trip.title}</h2>
          {startDate && endDate && (
            <p className="m-0 mt-1.5 text-[13px] text-white">
              {formatShortDateKo(startDate)} — {formatShortDateKo(endDate)} ·{" "}
              {formatTripLength(trip.trip_days)} · {memberCount}명
            </p>
          )}
        </CoverImage>

        <Container className="flex flex-1 flex-col gap-5 pb-6 pt-5 desk:gap-6 desk:pb-12">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="m-0 mb-2 text-2xl font-[650] leading-[1.2] text-ink">
                {copy?.headline ?? trip.title}
              </h3>
              <p className="m-0 text-[15px] font-[300] leading-[1.43] text-text-muted">
                {copy?.lead ?? "그룹 합의가 진행되고 있어요."}
              </p>
            </div>
            <Badge variant="soft">{TRIP_STATUS_LABEL[trip.status]}</Badge>
          </div>

          <div className="grid items-start gap-5 md:grid-cols-2 md:gap-6">
          <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface">
            {startDate && endDate && (
              <FactRow
                icon={Calendar}
                label="확정된 날짜"
                value={`${formatDateKo(startDate)} – ${formatDateKo(endDate)}`}
                caption={formatTripLength(trip.trip_days)}
              />
            )}
            <FactRow
              icon={Users}
              label="참여 인원"
              value={`${memberCount}명`}
              caption={participants.map((p) => p.nickname).join(" · ")}
            />
            {summary?.summarySentence && (
              <FactRow icon={Trees} label="그룹 취향" value={summary.summarySentence} />
            )}
          </div>

          <TripStageProgress status={trip.status} />

          <section className="flex flex-col gap-3 md:col-span-2 desk:col-span-1">
            <div className="flex items-center justify-between">
              <p className="m-0 text-base font-semibold text-ink">등록된 숙소 후보</p>
              <Badge variant={accommodationCount ? "primary" : "outline"}>
                {accommodationCount ?? 0}개
              </Badge>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface">
              {participants.map((p, i) => (
                <div
                  key={p.id}
                  className="flex min-h-14 items-center gap-3 border-b border-hairline-soft px-4 py-2 last:border-b-0"
                >
                  <Avatar nickname={p.nickname} seed={p.id} colorIndex={i} ringed />
                  <p className="m-0 flex-1 truncate text-[15px] font-semibold text-ink">
                    {p.nickname}
                  </p>
                  {p.role === "host" ? (
                    <Badge variant="soft">주최자</Badge>
                  ) : (
                    <span className="text-[13px] text-text-muted">참여자</span>
                  )}
                </div>
              ))}
            </div>
          </section>
          </div>
        </Container>

        <ScreenFooter>
          <LinkButton
            href={copy?.href(trip.id) ?? `/trip/${trip.id}/stay`}
            size="lg"
            fullWidth
            icon={<ArrowRight size={16} aria-hidden="true" />}
          >
            {copy?.cta ?? "숙소 정하기로 이동"}
          </LinkButton>
          <LinkButton href={`/trip/${trip.id}/consensus`} variant="soft" fullWidth>
            그룹 합의 결과 보기
          </LinkButton>
          <FooterNote>확정된 방향이라 날짜·취향 응답은 보기만 가능해요.</FooterNote>
        </ScreenFooter>
      </div>
    );
  }

  // ── 날짜·취향 응답을 모으는 중 ────────────────────────────────────────
  const myStatus = me?.response_status ?? "not_started";

  return (
    <div className="flex flex-1 flex-col">
      <GuestNoticeModal tripId={trip.id} isHost={ctx.isHost} />
      <TripAppBar title="TRIPTUNE" profile />

      <Container className="flex flex-1 flex-col gap-5 pb-6 pt-4 desk:gap-6 desk:pb-12 desk:pt-8">
        {ctx.isHost ? (
          <div>
            <h2 className="m-0 mb-1.5 text-2xl font-[650] leading-[1.2] text-ink desk:text-[28px]">
              친구를 초대해요.
            </h2>
            <p className="m-0 text-[15px] font-[300] leading-[1.43] text-text-muted">
              가입 없이 링크로 바로 참여할 수 있어요.
            </p>
          </div>
        ) : (
          <div>
            <h2 className="m-0 mb-1.5 text-2xl font-[650] leading-[1.2] text-ink desk:text-[28px]">
              {trip.title}
            </h2>
            <p className="m-0 text-[15px] font-[300] leading-[1.43] text-text-muted">
              {trip.destination} · {formatMonthKo(trip.candidate_start_date)} 중 ·{" "}
              {formatTripLength(trip.trip_days)}
            </p>
          </div>
        )}

        {/* 768px up: sharing on the left, who has answered on the right. */}
        <div className="grid items-start gap-5 md:grid-cols-2 md:gap-6">
          <div className="flex flex-col gap-4">
            {ctx.isHost && <InviteLinkCard inviteToken={trip.invite_token} tripTitle={trip.title} />}
            {ctx.isHost && <SaveTripCard tripId={trip.id} />}
          </div>

          <div className="flex flex-col gap-4 md:rounded-2xl md:border md:border-hairline-soft md:p-5">
            <ParticipantRoster
              tripId={trip.id}
              initialParticipants={participants}
              expectedCount={trip.expected_participant_count}
            />
            <div className="hidden justify-end md:flex">
              <LinkButton
                href={`/trip/${trip.id}/respond`}
                icon={<ArrowRight size={16} aria-hidden="true" />}
              >
                {myStatus === "submitted" ? "내 날짜·취향 수정하기" : "내 날짜·취향 입력하기"}
              </LinkButton>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2 md:hidden">
          <LinkButton
            href={`/trip/${trip.id}/respond`}
            size="lg"
            fullWidth
            icon={<ArrowRight size={16} aria-hidden="true" />}
          >
            {myStatus === "submitted" ? "내 날짜·취향 수정하기" : "내 날짜·취향 입력하기"}
          </LinkButton>
        </div>
      </Container>
    </div>
  );
}
