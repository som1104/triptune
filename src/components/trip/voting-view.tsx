"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { StayImage } from "@/components/ui/stay-image";
import { formatPrice, perPersonPrice } from "@/lib/trip/format";
import type { Accommodation } from "@/lib/supabase/database.types";

const POLL_INTERVAL_MS = 4000;

export function VotingView({
  tripId,
  isHost,
  accommodations,
  confirmedParticipantCount,
}: {
  tripId: string;
  isHost: boolean;
  accommodations: Accommodation[];
  confirmedParticipantCount: number | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [expected, setExpected] = useState<number | null>(null);
  const [voted, setVoted] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEndVoting, setShowEndVoting] = useState(false);
  const [endingVote, setEndingVote] = useState(false);

  async function refreshProgress() {
    const supabase = createClient();
    const { data } = await supabase.rpc("get_voting_progress", { p_trip_id: tripId }).maybeSingle();
    if (data) {
      setExpected(data.expected);
      setVoted(data.voted);
      setSelectedId((prev) => prev ?? data.my_vote_accommodation_id);
    }
  }

  useEffect(() => {
    // Polling an external system (server-aggregated vote progress) on an
    // interval, not state derivable from props — a legitimate effect use.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProgress();
    const interval = setInterval(refreshProgress, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function submitVote() {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("cast_vote", { p_trip_id: tripId, p_accommodation_id: selectedId });
      if (error) throw new Error(error.message);
      showToast("투표했어요.");
      refreshProgress();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "투표하지 못했어요.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function endVoting() {
    setEndingVote(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("end_voting_early", { p_trip_id: tripId });
      if (error) throw new Error(error.message);
      setShowEndVoting(false);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "투표를 종료하지 못했어요.", "error");
    } finally {
      setEndingVote(false);
    }
  }

  const pending = expected != null ? Math.max(expected - voted, 0) : null;

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="숙소 정하기" />
      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <div>
          <h2 className="m-0 mb-1 text-xl font-bold text-ink">숙소 투표 중</h2>
          <p className="m-0 text-sm text-text-muted">마음에 드는 숙소 하나를 골라주세요.</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="primary">
            투표 완료 {voted}/{expected ?? "-"}명
          </Badge>
          {pending != null && pending > 0 && <Badge variant="muted">미응답 {pending}명</Badge>}
        </div>

        <div role="radiogroup" aria-label="숙소 후보" className="flex flex-col gap-3">
          {accommodations.map((a) => {
            const selected = selectedId === a.id;
            const perPerson = confirmedParticipantCount
              ? perPersonPrice(a.total_price, confirmedParticipantCount)
              : null;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedId(a.id)}
                className={`flex items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-colors ${
                  selected ? "border-primary bg-primary-soft" : "border-hairline-soft bg-surface"
                }`}
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  <StayImage src={a.image_url} alt={a.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{a.name}</p>
                  <p className="truncate text-xs text-text-muted">
                    {a.location} · 총 {formatPrice(a.total_price)}
                    {perPerson != null && <> · 1인 약 {formatPrice(perPerson)}</>}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? "border-primary bg-primary text-on-primary" : "border-hairline bg-surface"
                  }`}
                >
                  {selected && <Check size={14} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button size="lg" fullWidth disabled={!selectedId} loading={submitting} onClick={submitVote}>
            투표하기
          </Button>
          {isHost && (
            <Button variant="outline" fullWidth onClick={() => setShowEndVoting(true)}>
              투표 종료하기
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={showEndVoting}
        onClose={() => setShowEndVoting(false)}
        title={pending ? `아직 ${pending}명이 투표하지 않았어요.` : "투표를 종료할까요?"}
        description="지금 종료하면 현재까지의 투표만 집계됩니다."
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setShowEndVoting(false)}>
            계속 기다리기
          </Button>
          <Button fullWidth loading={endingVote} onClick={endVoting}>
            투표 종료
          </Button>
        </div>
      </Modal>
    </div>
  );
}
