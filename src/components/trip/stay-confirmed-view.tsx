"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StayImage } from "@/components/ui/stay-image";
import { formatPrice, perPersonPrice } from "@/lib/trip/format";
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
  const [showAll, setShowAll] = useState(false);
  const validVotes = votes.length;
  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.accommodation_id, (tally.get(v.accommodation_id) ?? 0) + 1);
  const perPerson = confirmedParticipantCount
    ? perPersonPrice(finalAccommodation.total_price, confirmedParticipantCount)
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="숙소 정하기" />
      <div className="flex flex-1 flex-col gap-5 px-5 py-4">
        <div className="flex min-h-10 items-center gap-2 self-center rounded-full bg-ink px-4 text-sm font-semibold text-white">
          <Check size={16} aria-hidden="true" />
          숙소가 확정되었어요.
        </div>

        <div>
          <h2 className="m-0 mb-1 text-[24px] font-[650] leading-[1.2] text-ink">최종 숙소</h2>
          <p className="m-0 font-[300] text-[15px] leading-[1.43] text-text-muted">
            주최자가 그룹 1순위 숙소로 확정했어요.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border-2 border-primary bg-surface">
          <div className="relative h-[140px] w-full">
            <StayImage src={finalAccommodation.image_url} alt={finalAccommodation.name} />
            <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
              <Badge variant="primary">최종 숙소</Badge>
              <Badge variant="primary">그룹 1순위</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <p className="m-0 text-[18px] font-[650] text-ink">{finalAccommodation.name}</p>
            <div>
              <p className="m-0 text-[20px] font-[650] text-ink">
                총 {formatPrice(finalAccommodation.total_price)}
              </p>
              {perPerson != null && (
                <p className="m-0.5 mt-0.5 text-sm font-semibold text-ink-soft">
                  1인 약 {formatPrice(perPerson)}
                </p>
              )}
            </div>
            <p className="m-0 text-sm text-ink-soft">
              {finalAccommodation.location} · 최대 {finalAccommodation.capacity}명
            </p>
            <a href={finalAccommodation.url} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" fullWidth icon={<ExternalLink size={16} aria-hidden="true" />}>
                숙소 페이지 보기
              </Button>
            </a>
          </div>
        </div>

        {showAll && (
          <div className="flex flex-col gap-3.5 rounded-2xl border border-hairline-soft p-4">
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
                  <div className="h-2 overflow-hidden rounded-full bg-hairline-soft">
                    <div
                      className={`h-full rounded-full ${a.id === finalAccommodation.id ? "bg-primary" : "bg-text-faint"}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex min-h-11 items-center justify-center gap-1.5 self-center rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-primary-soft"
        >
          {showAll ? "접기" : "투표 결과 보기"} {showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
    </div>
  );
}
