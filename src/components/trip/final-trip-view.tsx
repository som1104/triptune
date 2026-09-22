"use client";

import { Calendar, ExternalLink, Eye, Link as LinkIcon, List, Plus, Trees, Users } from "lucide-react";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Container } from "@/components/layout/container";
import { CoverImage } from "@/components/ui/cover-image";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { FactRow } from "@/components/ui/summary-row";
import { FooterNote, ScreenFooter } from "@/components/ui/screen-footer";
import { StayImage } from "@/components/ui/stay-image";
import { SaveTripCard } from "@/components/auth/guest-notice-modal";
import { ReopenTripSheet } from "@/components/trip/reopen-trip-sheet";
import { BOOKING_MODE_LABEL, parseRooms, roomTotals } from "@/lib/trip/stay";
import { useToast } from "@/components/ui/toast";
import {
  formatDateKo,
  formatPrice,
  formatShortDateKo,
  formatTripLength,
  perPersonPrice,
} from "@/lib/trip/format";
import type { Accommodation, Participant, Trip } from "@/lib/supabase/database.types";

export function FinalTripView({
  trip,
  finalAccommodation,
  participants,
  summarySentence,
  isHost,
}: {
  trip: Trip;
  finalAccommodation: Accommodation | null;
  participants: Participant[];
  summarySentence: string | null;
  isHost: boolean;
}) {
  const { showToast } = useToast();
  const perPerson =
    finalAccommodation && trip.confirmed_participant_count
      ? perPersonPrice(finalAccommodation.total_price, trip.confirmed_participant_count)
      : null;
  const nights = Math.max(trip.trip_days - 1, 0);
  const finalRooms =
    finalAccommodation?.booking_mode === "rooms" ? parseRooms(finalAccommodation.rooms) : [];
  const finalRoomCount = roomTotals(finalRooms).roomCount;

  const coverCaption = [
    trip.confirmed_start_date && trip.confirmed_end_date
      ? `${formatShortDateKo(trip.confirmed_start_date)} — ${formatShortDateKo(trip.confirmed_end_date)}`
      : null,
    finalAccommodation?.name ?? null,
    trip.confirmed_participant_count ? `${trip.confirmed_participant_count}명` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  async function shareTrip() {
    const url = `${window.location.origin}/join/${trip.invite_token}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.title, text: `${trip.title} 여행 일정이에요.`, url });
        return;
      } catch {
        return; // user cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("여행 링크를 복사했어요.");
    } catch {
      showToast("링크 복사에 실패했어요.", "error");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title={trip.title} profile />
      <div className="desk:hidden">
        <CoverImage height={300} scrimTop={96} padX={24} padBottom={24} scrimEnd={0.75}>
          <p className="m-0 mb-2 text-xs font-semibold text-white">{trip.destination}</p>
          <h2 className="m-0 mb-2 text-[32px] font-[650] leading-[1.13] text-white">{trip.title}</h2>
          {coverCaption && <p className="m-0 text-sm text-white">{coverCaption}</p>}
        </CoverImage>
      </div>

      <Container className="flex flex-1 flex-col gap-5 pb-6 pt-5 desk:gap-6 desk:pb-12 desk:pt-8">
        {/* Desktop keeps the same photo, but as a rounded card inside the
            1200px column rather than a full-bleed banner. */}
        <div className="relative hidden h-[280px] overflow-hidden rounded-3xl desk:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/trip-cover.jpg" alt="" className="h-full w-full object-cover" />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 px-10 pb-8 pt-24"
            style={{
              background: "linear-gradient(180deg, rgba(20,20,20,0) 0%, rgba(20,20,20,.75) 100%)",
            }}
          >
            <div>
              <p className="m-0 mb-2 text-xs font-semibold text-white">{trip.destination}</p>
              <h3 className="m-0 mb-1.5 text-4xl font-[650] leading-[1.1] text-white">
                {trip.destination} 여행이 확정됐어요!
              </h3>
              {coverCaption && <p className="m-0 text-base text-white">{coverCaption}</p>}
            </div>
            <Badge variant="overlay">확정 완료</Badge>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 desk:hidden">
          <h3 className="m-0 text-2xl font-[650] leading-[1.2] text-ink">
            {trip.destination} 여행이 확정됐어요!
          </h3>
          <Badge variant="primary">확정 완료</Badge>
        </div>

        {/* Left column is the stay that was chosen; the facts, the roster and
            the save card stack on the right. Explicit row/column placement
            keeps the phone's reading order (facts → stay → 참여자) intact. */}
        <div className="grid items-start gap-5 md:grid-cols-2 md:gap-6">
        <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface md:col-start-2 md:row-start-1">
          {trip.confirmed_start_date && trip.confirmed_end_date && (
            <FactRow
              icon={Calendar}
              label="여행 날짜"
              value={`${formatDateKo(trip.confirmed_start_date)} – ${formatDateKo(trip.confirmed_end_date)}`}
              caption={formatTripLength(trip.trip_days)}
            />
          )}
          <FactRow
            icon={Users}
            label="참여 인원"
            value={`${trip.confirmed_participant_count ?? participants.length}명`}
            caption={participants.map((p) => p.nickname).join(" · ")}
          />
          {summarySentence && <FactRow icon={Trees} label="그룹 취향" value={summarySentence} />}
        </div>

        {finalAccommodation && (
          <section className="flex flex-col gap-3 md:col-start-1 md:row-span-3 md:row-start-1">
            <div className="flex items-center justify-between">
              <p className="m-0 text-base font-semibold text-ink">확정된 숙소</p>
              <Badge variant="soft">그룹 1순위</Badge>
            </div>
            <div className="overflow-hidden rounded-2xl border-2 border-primary bg-surface md:max-w-[560px]">
              <div className="h-40 w-full desk:h-[220px]">
                <StayImage src={finalAccommodation.image_url} alt={finalAccommodation.name} />
              </div>
              <div className="flex flex-col gap-3 p-4 desk:p-6">
                <div>
                  <p className="m-0 mb-0.5 text-base font-semibold text-ink desk:text-xl desk:font-[650]">
                    {finalAccommodation.name}
                  </p>
                  <p className="m-0 text-[13px] text-text-muted">
                    {finalAccommodation.location} · {nights}박
                  </p>
                </div>

                {/* 확정된 예약안 */}
                <div className="rounded-2xl bg-primary-soft px-4 py-3">
                  {finalRooms.length > 0 ? (
                    <>
                      {finalRooms.map((r, i) => (
                        <p
                          key={`${r.name}-${i}`}
                          className="m-0 text-[15px] font-semibold text-ink"
                        >
                          {r.name} {r.count}개
                        </p>
                      ))}
                      <p className="m-0 text-[13px] text-ink-soft">
                        총 {finalRoomCount}개 객실 · 최대 {finalAccommodation.capacity}명
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="m-0 text-[15px] font-semibold text-ink">
                        {BOOKING_MODE_LABEL.whole}
                      </p>
                      <p className="m-0 text-[13px] text-ink-soft">
                        최대 {finalAccommodation.capacity}명
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <p className="m-0 text-[18px] font-[650] text-ink">
                    총 {formatPrice(finalAccommodation.total_price)}
                  </p>
                  {perPerson != null && (
                    <p className="m-0 mt-0.5 text-[13px] text-text-muted">
                      1인 약 {formatPrice(perPerson)}
                    </p>
                  )}
                </div>
                <LinkButton
                  href={finalAccommodation.url}
                  external
                  variant="outline"
                  fullWidth
                  className="desk:h-11 desk:w-auto desk:self-start"
                  icon={<ExternalLink size={16} aria-hidden="true" />}
                >
                  숙소 페이지 보기
                </LinkButton>
              </div>
            </div>
            <p className="m-0 text-xs text-text-muted">
              예약과 결제는 숙소 페이지에서 각자 진행해요.
            </p>
          </section>
        )}

        <section className="flex flex-col gap-3 md:col-start-2 md:row-start-2">
          <p className="m-0 text-base font-semibold text-ink">참여자</p>
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

        <div className="md:col-start-2 md:row-start-3">
          <SaveTripCard tripId={trip.id} />
        </div>

        {/* 주최자용 보조 관리. 주요 CTA(공유·새 여행)와 섞이지 않게 목록 끝에
            조용히 둔다. */}
        {isHost && (
          <div className="flex flex-col gap-1.5 md:col-start-2 md:row-start-4">
            <div className="h-px bg-hairline-soft" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-[13px] text-text-muted">
                일정이나 인원이 바뀌었나요?
              </p>
              <ReopenTripSheet tripId={trip.id} />
            </div>
          </div>
        )}
        </div>
      </Container>

      <ScreenFooter>
        <Button
          size="lg"
          fullWidth
          icon={<LinkIcon size={16} aria-hidden="true" />}
          onClick={shareTrip}
        >
          여행 링크 공유
        </Button>
        <LinkButton
          href="/new"
          variant="soft"
          fullWidth
          icon={<Plus size={16} aria-hidden="true" />}
          iconPosition="start"
        >
          새 여행 만들기
        </LinkButton>
        <div className="flex gap-2">
          <LinkButton
            href="/"
            variant="outline"
            className="min-w-0 flex-1"
            icon={<List size={16} aria-hidden="true" />}
            iconPosition="start"
          >
            내 여행으로
          </LinkButton>
          <LinkButton
            href={`/trip/${trip.id}/respond`}
            variant="outline"
            className="min-w-0 flex-1"
            icon={<Eye size={16} aria-hidden="true" />}
            iconPosition="start"
          >
            내 응답 보기
          </LinkButton>
        </div>
        <FooterNote>
          새 여행을 만들어도 이 여행은 그대로 남아요. 확정된 여행이라 응답은 보기만 가능해요.
        </FooterNote>
      </ScreenFooter>
    </div>
  );
}
