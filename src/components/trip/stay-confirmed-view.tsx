"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <Badge variant="primary">숙소 확정 완료</Badge>
        <div className="overflow-hidden rounded-2xl border border-hairline-soft">
          <div className="h-40 w-full">
            <StayImage src={finalAccommodation.image_url} alt={finalAccommodation.name} />
          </div>
          <div className="flex flex-col gap-2 p-4">
            <p className="text-[18px] font-bold text-ink">{finalAccommodation.name}</p>
            <p className="text-sm text-ink-soft">
              총 {formatPrice(finalAccommodation.total_price)}
              {perPerson != null && <> · 1인 약 {formatPrice(perPerson)}</>}
            </p>
            <p className="text-sm text-text-muted">
              {finalAccommodation.location} · 최대 {finalAccommodation.capacity}명
            </p>
            <a
              href={finalAccommodation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex min-h-11 w-fit items-center rounded-full border border-hairline px-4 text-sm font-semibold text-ink-soft hover:bg-primary-soft"
            >
              숙소 페이지 보기
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-ink-soft"
        >
          투표 결과 보기 {showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAll && (
          <div className="flex flex-col gap-2">
            {[finalAccommodation, ...otherAccommodations].map((a) => {
              const count = tally.get(a.id) ?? 0;
              const rate = validVotes === 0 ? 0 : Math.round((count / validVotes) * 100);
              return (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-hairline-soft px-4 py-3">
                  <p className="truncate text-sm font-semibold text-ink-soft">{a.name}</p>
                  <p className="whitespace-nowrap text-sm font-semibold text-text-muted">
                    {count}표 · {rate}%
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
