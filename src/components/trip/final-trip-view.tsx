import { TripAppBar } from "@/components/layout/trip-app-bar";
import { CoverImage } from "@/components/ui/cover-image";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { InviteLinkCard } from "@/components/trip/invite-link-card";
import { formatDateKo, formatPrice, formatTripLength, perPersonPrice } from "@/lib/trip/format";
import type { Accommodation, Participant, Trip } from "@/lib/supabase/database.types";

export function FinalTripView({
  trip,
  finalAccommodation,
  participants,
  summarySentence,
}: {
  trip: Trip;
  finalAccommodation: Accommodation | null;
  participants: Participant[];
  summarySentence: string | null;
}) {
  const perPerson =
    finalAccommodation && trip.confirmed_participant_count
      ? perPersonPrice(finalAccommodation.total_price, trip.confirmed_participant_count)
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title={trip.title} />
      <CoverImage height={260}>
        <p className="m-0 mb-1.5 text-xs font-semibold text-white">{trip.destination}</p>
        <h2 className="m-0 text-[32px] font-[650] leading-[1.13] text-white">{trip.title}</h2>
        {trip.confirmed_start_date && trip.confirmed_end_date && (
          <p className="m-0 mt-2 text-sm text-white/90">
            {formatDateKo(trip.confirmed_start_date)} – {formatDateKo(trip.confirmed_end_date)} ·{" "}
            {formatTripLength(trip.trip_days)} · {trip.confirmed_participant_count}명
          </p>
        )}
      </CoverImage>

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <h3 className="m-0 text-2xl font-[650] leading-[1.2] text-ink">여행이 확정됐어요!</h3>

        {summarySentence && (
          <div className="rounded-2xl bg-primary-soft p-4">
            <p className="m-0 text-[15px] leading-relaxed text-ink-soft">{summarySentence}</p>
          </div>
        )}

        {finalAccommodation && (
          <section className="flex flex-col gap-2">
            <p className="text-base font-semibold text-ink">최종 숙소</p>
            <div className="rounded-2xl border border-hairline-soft p-4">
              <p className="text-[16px] font-semibold text-ink">{finalAccommodation.name}</p>
              <p className="mt-1 text-sm text-ink-soft">
                총 {formatPrice(finalAccommodation.total_price)}
                {perPerson != null && <> · 1인 약 {formatPrice(perPerson)}</>}
              </p>
              <p className="text-sm text-text-muted">{finalAccommodation.location}</p>
              <a
                href={finalAccommodation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center rounded-full border border-hairline px-4 text-sm font-semibold text-ink-soft hover:bg-primary-soft"
              >
                숙소 페이지 보기
              </a>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <p className="text-base font-semibold text-ink">참여자 {participants.length}명</p>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-hairline-soft px-2.5 py-1.5"
              >
                <Avatar nickname={p.nickname} seed={p.id} size="sm" />
                <span className="text-sm font-medium text-ink-soft">{p.nickname}</span>
              </span>
            ))}
          </div>
        </section>

        <InviteLinkCard inviteToken={trip.invite_token} tripTitle={trip.title} />

        <div className="mt-auto pt-2">
          <LinkButton href={`/trip/${trip.id}/respond`} variant="outline" fullWidth>
            내 응답 보기
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
