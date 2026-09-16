"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { StayImage } from "@/components/ui/stay-image";
import { formatPrice, perPersonPrice } from "@/lib/trip/format";
import type { Accommodation, AccommodationVote } from "@/lib/supabase/database.types";

export function VoteResultsView({
  tripId,
  isHost,
  accommodations,
  votes,
  confirmedParticipantCount,
}: {
  tripId: string;
  isHost: boolean;
  accommodations: Accommodation[];
  votes: AccommodationVote[];
  confirmedParticipantCount: number | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [confirmTarget, setConfirmTarget] = useState<Accommodation | null>(null);
  const [confirming, setConfirming] = useState(false);

  const validVotes = votes.length;
  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.accommodation_id, (tally.get(v.accommodation_id) ?? 0) + 1);
  const topCount = validVotes === 0 ? 0 : Math.max(0, ...accommodations.map((a) => tally.get(a.id) ?? 0));
  const topAccommodationIds = new Set(
    accommodations.filter((a) => topCount > 0 && (tally.get(a.id) ?? 0) === topCount).map((a) => a.id)
  );
  const isTie = topAccommodationIds.size > 1;

  const ranked = [...accommodations].sort((a, b) => (tally.get(b.id) ?? 0) - (tally.get(a.id) ?? 0));

  async function confirmFinal() {
    if (!confirmTarget) return;
    setConfirming(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("confirm_final_accommodation", {
        p_trip_id: tripId,
        p_accommodation_id: confirmTarget.id,
      });
      if (error) throw new Error(error.message);
      setConfirmTarget(null);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "확정하지 못했어요.", "error");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="숙소 정하기" />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div>
          <h2 className="m-0 mb-1 text-xl font-bold text-ink">투표 결과</h2>
          <p className="m-0 text-sm text-text-muted">
            {validVotes === 0 ? "아직 투표가 없어요." : `${validVotes}명이 투표했어요.`}
          </p>
        </div>

        {isTie && validVotes > 0 && (
          <div className="rounded-2xl bg-conflict-bg border border-conflict-border p-4">
            <p className="text-sm text-conflict-text">
              동일한 표를 받은 숙소가 있어요. 주최자의 최종 선택이 필요해요.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {ranked.map((a) => {
            const count = tally.get(a.id) ?? 0;
            const rate = validVotes === 0 ? 0 : Math.round((count / validVotes) * 100);
            const isTop = topAccommodationIds.has(a.id);
            const perPerson = confirmedParticipantCount
              ? perPersonPrice(a.total_price, confirmedParticipantCount)
              : null;
            return (
              <div key={a.id} className="overflow-hidden rounded-2xl border border-hairline-soft">
                <div className="relative h-32 w-full">
                  <StayImage src={a.image_url} alt={a.name} />
                  {isTop && (
                    <span className="absolute left-3 top-3">
                      <Badge variant="primary">그룹 1순위</Badge>
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[16px] font-semibold text-ink">{a.name}</p>
                      <p className="text-sm text-text-muted">
                        {a.location}
                        {perPerson != null && <> · 1인 약 {formatPrice(perPerson)}</>}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-lg font-bold text-ink">
                      {count}표 · {rate}%
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-hairline-soft">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
                  </div>
                  {isHost && (
                    <Button
                      variant={isTop ? "primary" : "soft"}
                      size="md"
                      fullWidth
                      disabled={!isTop || validVotes === 0}
                      onClick={() => setConfirmTarget(a)}
                    >
                      이 숙소로 확정하기
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="이 숙소로 확정할까요?"
        description={confirmTarget ? `"${confirmTarget.name}"으로 여행이 최종 확정돼요. 이후에는 되돌릴 수 없어요.` : undefined}
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setConfirmTarget(null)}>
            취소
          </Button>
          <Button fullWidth loading={confirming} onClick={confirmFinal}>
            확정하기
          </Button>
        </div>
      </Modal>
    </div>
  );
}
