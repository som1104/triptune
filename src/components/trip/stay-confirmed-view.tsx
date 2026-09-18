"use client";

import { useState } from "react";
import { Check, ExternalLink, Share2 } from "lucide-react";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { ConsensusBar } from "@/components/ui/consensus-bar";
import { ScreenFooter } from "@/components/ui/screen-footer";
import { StayImage } from "@/components/ui/stay-image";
import { useToast } from "@/components/ui/toast";
import { formatPrice, perPersonPrice } from "@/lib/trip/format";
import { BOOKING_MODE_LABEL, parseRooms, roomTotals } from "@/lib/trip/stay";
import type { Accommodation, AccommodationVote } from "@/lib/supabase/database.types";

export function StayConfirmedView({
  finalAccommodation,
  otherAccommodations,
  votes,
  confirmedParticipantCount,
}: {
  finalAccommodation: Accommodation;
  otherAccommodations: Accommodation[];
  votes: AccommodationVote[];
  confirmedParticipantCount: number | null;
}) {
  const { showToast } = useToast();
  const [showAll, setShowAll] = useState(false);
  const validVotes = votes.length;
  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.accommodation_id, (tally.get(v.accommodation_id) ?? 0) + 1);
  const perPerson = confirmedParticipantCount
    ? perPersonPrice(finalAccommodation.total_price, confirmedParticipantCount)
    : null;
  const finalRooms =
    finalAccommodation.booking_mode === "rooms" ? parseRooms(finalAccommodation.rooms) : [];
  const finalTotals = roomTotals(finalRooms);

  async function shareSummary() {
    const text = `확정 숙소: ${finalAccommodation.name} (${finalAccommodation.location})\n${finalAccommodation.url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: finalAccommodation.name, text });
        return;
      } catch {
        return; // user cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("확정 정보를 복사했어요.");
    } catch {
      showToast("복사에 실패했어요.", "error");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="숙소 정하기" />
      <Container className="flex flex-1 flex-col gap-5 pb-6 pt-4 md:gap-6 md:pt-8 desk:pb-12">
        <span className="inline-flex h-10 items-center gap-2 self-center rounded-full bg-ink px-4 text-sm font-semibold text-white">
          <Check size={16} aria-hidden="true" />
          숙소가 확정되었어요.
        </span>

        <div>
          <h2 className="m-0 mb-2 text-2xl font-[650] leading-[1.2] text-ink">최종 숙소</h2>
          <p className="m-0 text-[15px] font-[300] leading-[1.43] text-text-muted">
            주최자가 그룹 1순위 숙소로 확정했어요.
          </p>
        </div>

        {/* The confirmed stay is one card, not a column of them — capped so it
            does not stretch across the full desktop measure. */}
        <div className="overflow-hidden rounded-2xl border-2 border-primary bg-surface md:max-w-[560px]">
          <div className="relative h-[140px] w-full desk:h-[220px]">
            <StayImage src={finalAccommodation.image_url} alt={finalAccommodation.name} />
            <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
              <Badge variant="primary">최종 숙소</Badge>
              <Badge variant="primary">그룹 1순위</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-3 p-4 desk:p-5">
            <div>
              <p className="m-0 text-[18px] font-[650] text-ink">{finalAccommodation.name}</p>
              <p className="m-0 mt-0.5 text-sm text-ink-soft">{finalAccommodation.location}</p>
            </div>

            {/* 확정된 예약안 — 객실을 잡은 경우에는 구성을 그대로 펼쳐 보여준다. */}
            {finalRooms.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-2xl bg-primary-soft px-4 py-3">
                <p className="m-0 text-xs font-semibold leading-[1.33] text-text-muted">
                  확정된 객실
                </p>
                {finalRooms.map((r, i) => (
                  <p key={`${r.name}-${i}`} className="m-0 text-[15px] font-semibold text-ink">
                    {r.name} {r.count}개
                    <span className="ml-1.5 text-[13px] font-[450] text-ink-soft">
                      객실당 {r.capacityPerRoom}명 · {formatPrice(r.pricePerRoom)}
                    </span>
                  </p>
                ))}
                <p className="m-0 text-[13px] text-ink-soft">
                  총 {finalTotals.roomCount}개 객실 · 최대 {finalAccommodation.capacity}명
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-primary-soft px-4 py-3">
                <p className="m-0 text-[15px] font-semibold text-ink">
                  {BOOKING_MODE_LABEL.whole}
                </p>
                <p className="m-0 text-[13px] text-ink-soft">
                  최대 {finalAccommodation.capacity}명
                </p>
              </div>
            )}

            <div>
              <p className="m-0 text-xl font-[650] text-ink">
                총 {formatPrice(finalAccommodation.total_price)}
              </p>
              {perPerson != null && (
                <p className="m-0 mt-0.5 text-sm font-semibold text-ink-soft">
                  1인 약 {formatPrice(perPerson)}
                </p>
              )}
            </div>
            <LinkButton
              href={finalAccommodation.url}
              external
              variant="primary"
              fullWidth
              className="desk:h-11 desk:w-auto desk:self-start"
              icon={<ExternalLink size={16} aria-hidden="true" />}
            >
              숙소 페이지 보기
            </LinkButton>
          </div>
        </div>

        {showAll && (
          <div className="flex flex-col gap-3.5 rounded-2xl border border-hairline-soft p-4 md:max-w-[560px] desk:p-5">
            <p className="m-0 text-sm font-semibold text-ink">전체 투표 결과 · {validVotes}표</p>
            {[finalAccommodation, ...otherAccommodations].map((a) => {
              const count = tally.get(a.id) ?? 0;
              const rate = validVotes === 0 ? 0 : Math.round((count / validVotes) * 100);
              return (
                <div key={a.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">{a.name}</span>
                    <span className="text-sm font-[650] text-ink">
                      {count}표 · {rate}%
                    </span>
                  </div>
                  <ConsensusBar
                    percent={rate}
                    tone={a.id === finalAccommodation.id ? "primary" : "faint"}
                  />
                </div>
              );
            })}
          </div>
        )}

        <Button variant="ghost" className="self-center md:self-start" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "투표 결과 접기" : "투표 결과 보기"}
        </Button>
      </Container>

      <ScreenFooter>
        <Button
          variant="outline"
          size="lg"
          fullWidth
          icon={<Share2 size={16} aria-hidden="true" />}
          onClick={shareSummary}
        >
          확정 정보 공유
        </Button>
      </ScreenFooter>
    </div>
  );
}
