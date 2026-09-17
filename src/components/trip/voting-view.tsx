"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
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
  const [myVote, setMyVote] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ participant_id: string; nickname: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showEndVoting, setShowEndVoting] = useState(false);
  const [endingVote, setEndingVote] = useState(false);

  async function refreshProgress() {
    const supabase = createClient();
    const [{ data: progress }, { data: completion }] = await Promise.all([
      supabase.rpc("get_voting_progress", { p_trip_id: tripId }).maybeSingle(),
      supabase.rpc("get_voting_completion", { p_trip_id: tripId }),
    ]);
    if (progress) {
      setExpected(progress.expected);
      setVoted(progress.voted);
      setMyVote(progress.my_vote_accommodation_id);
      setSelectedId((prev) => prev ?? progress.my_vote_accommodation_id);
    }
    if (completion) setCompleted(completion);
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
  const submitted = !!myVote;
  const myPick = accommodations.find((a) => a.id === myVote);

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="숙소 정하기" />
      <div className="flex flex-1 flex-col gap-5 px-5 py-4">
        {!submitted ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="m-0 mb-2 text-[24px] font-[650] leading-[1.2] text-ink">숙소 투표 중</h2>
                <p className="m-0 font-[300] text-[15px] leading-[1.43] text-text-muted">
                  마음에 드는 숙소를 선택해주세요. 한 곳에만 투표할 수 있어요.
                </p>
              </div>
              <Badge variant="primary">
                {voted} / {expected ?? "-"}명 완료
              </Badge>
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
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                      selected ? "border-primary bg-primary-soft" : "border-hairline-soft bg-surface"
                    }`}
                  >
                    <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl">
                      <StayImage src={a.image_url} alt={a.name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 mb-0.5 truncate text-[16px] font-[600] text-ink">{a.name}</p>
                      <p className="m-0 mb-0.5 truncate text-sm font-[600] text-ink">
                        총 {formatPrice(a.total_price)}
                        {perPerson != null && <> · 1인 약 {formatPrice(perPerson)}</>}
                      </p>
                      <p className="m-0 truncate text-[13px] text-text-muted">
                        {a.location} · 최대 {a.capacity}명
                      </p>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden="true">
                      <span
                        className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${
                          selected ? "border-primary bg-primary" : "border-hairline bg-surface"
                        }`}
                      >
                        {selected && <span className="h-2 w-2 rounded-full bg-on-primary" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="m-0 text-xs text-text-muted">
              투표가 끝나기 전에는 다른 사람의 선택이 공개되지 않아요.
            </p>
          </>
        ) : (
          <>
            <div>
              <h2 className="m-0 mb-2 text-[24px] font-[650] leading-[1.2] text-ink">투표를 제출했어요.</h2>
              <p className="m-0 font-[300] text-[15px] leading-[1.43] text-text-muted">
                모두 투표하면 결과가 공개돼요.
              </p>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl bg-primary-soft p-4">
              <p className="m-0 text-xs font-semibold text-ink-soft">내가 선택한 숙소</p>
              <p className="m-0 text-[18px] font-[650] text-ink">{myPick?.name}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-hairline-soft p-4 text-center">
                <p className="m-0 text-2xl font-[650] text-ink">{expected ?? "-"}</p>
                <p className="m-0.5 mt-0.5 text-[13px] text-ink-soft">전체 인원</p>
              </div>
              <div className="rounded-2xl border border-hairline-soft p-4 text-center">
                <p className="m-0 text-2xl font-[650] text-primary">{voted}</p>
                <p className="m-0.5 mt-0.5 text-[13px] text-ink-soft">투표 완료</p>
              </div>
              <div className="rounded-2xl border border-hairline-soft p-4 text-center">
                <p className="m-0 text-2xl font-[650] text-text-faint">{pending ?? "-"}</p>
                <p className="m-0.5 mt-0.5 text-[13px] text-ink-soft">미응답</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex">
                {completed.map((p, i) => (
                  <span key={p.participant_id} className={i > 0 ? "-ml-2" : ""}>
                    <Avatar nickname={p.nickname} seed={p.participant_id} size="sm" ringed />
                  </span>
                ))}
              </div>
              <span className="text-[13px] text-text-muted">완료 여부만 표시</span>
            </div>
          </>
        )}

        <div className="mt-auto pt-2">
          {!submitted ? (
            <Button size="lg" fullWidth disabled={!selectedId} loading={submitting} onClick={submitVote}>
              투표 제출하기
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => {
                setSelectedId(myVote);
                setMyVote(null);
              }}
            >
              내 투표 변경
            </Button>
          )}
          {isHost && (
            <button
              type="button"
              onClick={() => setShowEndVoting(true)}
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-ink-soft hover:bg-primary-soft"
            >
              투표 종료하기
            </button>
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
