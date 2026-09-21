"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { ScreenFooter } from "@/components/ui/screen-footer";
import { useToast } from "@/components/ui/toast";
import { StayImage } from "@/components/ui/stay-image";
import { formatPrice, perPersonPrice } from "@/lib/trip/format";
import { bookingLine } from "@/lib/trip/stay";
import { RoomsDisclosure } from "@/components/trip/stay-room-details";
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
  // 너무 일찍 투표를 시작했을 때 후보 단계로 물러설 길.
  const [showReopenCandidates, setShowReopenCandidates] = useState(false);
  const [reopening, setReopening] = useState(false);

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
      const { error } = await supabase.rpc("cast_vote", {
        p_trip_id: tripId,
        p_accommodation_id: selectedId,
      });
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

  async function reopenCandidates() {
    setReopening(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("reopen_stay_candidates", { p_trip_id: tripId });
      if (error) throw new Error(error.message);
      setShowReopenCandidates(false);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "되돌리지 못했어요.", "error");
    } finally {
      setReopening(false);
    }
  }

  const pending = expected != null ? Math.max(expected - voted, 0) : null;
  const submitted = !!myVote;
  const myPick = accommodations.find((a) => a.id === myVote);

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="숙소 정하기" />
      <Container className="grid flex-1 items-start gap-5 pb-6 pt-4 md:gap-6 md:pt-8 desk:grid-cols-[minmax(0,1fr)_320px] desk:pb-12">
        <div className="flex flex-col gap-5 md:gap-6">
        {!submitted ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="m-0 mb-2 text-2xl font-[650] leading-[1.2] text-ink desk:mb-1.5 desk:text-[28px]">숙소 투표 중</h2>
                <p className="m-0 text-[15px] font-[300] leading-[1.43] text-text-muted">
                  마음에 드는 숙소를 선택해주세요. 한 곳에만 투표할 수 있어요.
                </p>
              </div>
              <Badge variant="soft" className="desk:hidden">
                {voted} / {expected ?? "-"}명 완료
              </Badge>
            </div>

            {/* One ballot, two shapes: a compact row on the phone, the
                board's 180px-image card in two columns from md up. */}
            <div
              role="radiogroup"
              aria-label="숙소 후보"
              className="grid gap-3 md:grid-cols-2 md:gap-6"
            >
              {accommodations.map((a) => {
                const selected = selectedId === a.id;
                const perPerson = confirmedParticipantCount
                  ? perPersonPrice(a.total_price, confirmedParticipantCount)
                  : null;
                const radio = (
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? "border-primary bg-primary text-white" : "border-hairline bg-surface"
                    }`}
                  >
                    {selected && <Check size={16} strokeWidth={3.4} />}
                  </span>
                );
                return (
                  // 라디오 버튼 안에는 다른 버튼을 넣을 수 없어서 "객실 구성
                  // 보기"는 카드 바로 아래에 둔다.
                  <div key={a.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedId(a.id)}
                    className={`grid grid-cols-[88px_1fr_44px] items-center gap-3 overflow-hidden rounded-2xl text-left transition-colors md:flex md:flex-col md:items-stretch md:gap-0 md:p-0 ${
                      selected
                        ? "border-2 border-primary bg-[#f4f6ff] p-[11px]"
                        : "border border-hairline-soft bg-surface p-3"
                    }`}
                  >
                    <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl md:h-[180px] md:w-full md:rounded-none">
                      <StayImage src={a.image_url} alt={a.name} />
                    </div>
                    <div className="min-w-0 md:flex md:flex-col md:gap-2.5 md:p-5">
                      <div className="md:flex md:items-start md:justify-between md:gap-3">
                        <p className="m-0 mb-[3px] truncate text-base font-semibold text-ink md:mb-0 md:text-[18px] md:font-[650]">
                          {a.name}
                        </p>
                        <span className="hidden md:flex" aria-hidden="true">
                          {radio}
                        </span>
                      </div>
                      <p className="m-0 mb-[3px] truncate text-sm font-semibold text-ink md:mb-0 md:text-base">
                        총 {formatPrice(a.total_price)}
                        {perPerson != null && <> · 1인 약 {formatPrice(perPerson)}</>}
                      </p>
                      {/* 예약안 요약은 읽히되, 선택 자체보다 세지 않게 둔다. */}
                      <p className="m-0 truncate text-[13px] text-text-muted md:text-sm md:text-ink-soft">
                        {bookingLine(a)}
                      </p>
                      <p className="m-0 truncate text-[13px] text-text-muted md:text-sm md:text-ink-soft">
                        {a.location}
                      </p>
                    </div>
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center md:hidden"
                      aria-hidden="true"
                    >
                      {radio}
                    </span>
                  </button>
                  <RoomsDisclosure accommodation={a} className="-ml-2 self-start" />
                  </div>
                );
              })}
            </div>
            <p className="m-0 text-xs text-text-muted md:hidden">
              투표가 끝나기 전에는 다른 사람의 선택이 공개되지 않아요.
            </p>
            {/* From md up the submit button leaves the sticky bar and closes
                the ballot column, right-aligned next to its note. */}
            <div className="hidden items-center justify-end gap-3 md:flex">
              <p className="m-0 text-[13px] text-text-muted">
                투표가 끝나기 전에는 다른 사람의 선택이 공개되지 않아요.
              </p>
              <Button
                className="h-11"
                disabled={!selectedId}
                loading={submitting}
                onClick={submitVote}
              >
                투표 제출하기
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="m-0 mb-2 text-2xl font-[650] leading-[1.2] text-ink desk:mb-1.5 desk:text-[28px]">
                투표를 제출했어요.
              </h2>
              <p className="m-0 text-[15px] font-[300] leading-[1.43] text-text-muted">
                모두 투표하면 결과가 공개돼요.
              </p>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl bg-primary-soft p-4">
              <p className="m-0 text-xs font-semibold leading-[1.33] text-ink-soft">
                내가 선택한 숙소
              </p>
              <p className="m-0 text-[18px] font-[650] text-ink">{myPick?.name}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatTile value={expected ?? "-"} label="전체 인원" />
              <StatTile value={voted} label="투표 완료" tone="primary" />
              <StatTile value={pending ?? "-"} label="미응답" tone="faint" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex">
                {completed.map((p, i) => (
                  <span key={p.participant_id} className={i > 0 ? "-ml-2" : ""}>
                    <Avatar nickname={p.nickname} seed={p.participant_id} size="md" ringed />
                  </span>
                ))}
              </div>
              <span className="text-[13px] text-text-muted">완료 여부만 표시</span>
            </div>
            <div className="hidden justify-end md:flex">
              <Button
                variant="outline"
                className="h-11"
                onClick={() => {
                  setSelectedId(myVote);
                  setMyVote(null);
                }}
              >
                내 투표 변경
              </Button>
            </div>
          </>
        )}
        </div>

        {/* 투표 현황 — a side panel on desktop only; on narrower screens the
            same numbers already live in the header badge and the stat tiles. */}
        <aside className="hidden flex-col gap-4 rounded-2xl border border-hairline-soft p-6 desk:flex">
          <p className="m-0 text-base font-semibold text-ink">투표 현황</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-soft">완료</span>
              <span className="text-[20px] font-[650] text-ink">
                {voted} / {expected ?? "-"}명
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-hairline">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: expected ? `${Math.round((voted / expected) * 100)}%` : "0%" }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {completed.map((p) => (
              <div key={p.participant_id} className="flex min-h-11 items-center gap-2.5">
                <Avatar nickname={p.nickname} seed={p.participant_id} size="md" />
                <span className="flex-1 truncate text-sm font-semibold text-ink">{p.nickname}</span>
                <span className="text-[13px] text-ink-soft">완료</span>
              </div>
            ))}
          </div>
          <p className="m-0 text-[13px] text-text-muted">
            누가 무엇을 골랐는지는 결과 공개 후에 보여요.
          </p>
          {isHost && (
            <div className="flex flex-col gap-2">
              <Button variant="outline" fullWidth onClick={() => setShowEndVoting(true)}>
                지금 투표 마감
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setShowReopenCandidates(true)}>
                후보 다시 모으기
              </Button>
            </div>
          )}
        </aside>
      </Container>

      <ScreenFooter className="md:hidden">
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
          <>
            <Button variant="ghost" fullWidth onClick={() => setShowEndVoting(true)}>
              투표 종료하기
            </Button>
            <Button
              variant="ghost"
              fullWidth
              icon={<RotateCcw size={16} aria-hidden="true" />}
              iconPosition="start"
              onClick={() => setShowReopenCandidates(true)}
            >
              후보 다시 모으기
            </Button>
          </>
        )}
      </ScreenFooter>

      <Modal
        open={showReopenCandidates}
        onClose={() => setShowReopenCandidates(false)}
        title="후보를 다시 모을까요?"
        description="숙소 후보를 추가하거나 고칠 수 있게 되고, 지금까지의 표는 모두 지워져요."
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setShowReopenCandidates(false)}>
            취소
          </Button>
          <Button fullWidth loading={reopening} onClick={reopenCandidates}>
            후보 다시 모으기
          </Button>
        </div>
      </Modal>

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

function StatTile({
  value,
  label,
  tone,
}: {
  value: React.ReactNode;
  label: string;
  tone?: "primary" | "faint";
}) {
  const color =
    tone === "primary" ? "text-primary" : tone === "faint" ? "text-text-faint" : "text-ink";
  return (
    <div className="rounded-2xl border border-hairline-soft bg-surface p-4 text-center">
      <p className={`m-0 text-2xl font-[650] ${color}`}>{value}</p>
      <p className="m-0 mt-0.5 text-[13px] text-ink-soft">{label}</p>
    </div>
  );
}
