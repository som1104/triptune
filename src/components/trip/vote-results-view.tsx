"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Info, RotateCcw, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConsensusBar } from "@/components/ui/consensus-bar";
import { FooterNote, ScreenFooter } from "@/components/ui/screen-footer";
import { useToast } from "@/components/ui/toast";
import { StayImage } from "@/components/ui/stay-image";
import { formatPrice, perPersonPrice } from "@/lib/trip/format";
import { bookingLine, tallyVotes, votePercentage } from "@/lib/trip/stay";
import { RoomsDisclosure } from "@/components/trip/stay-room-details";
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
  // 되돌리기 — 표가 하나도 없거나 후보를 고쳐야 할 때의 유일한 출구다.
  const [reopenTarget, setReopenTarget] = useState<"voting" | "candidates" | null>(null);
  const [reopening, setReopening] = useState(false);

  const {
    validVotes,
    counts: tally,
    ranked,
    topIds: topAccommodationIds,
    isTie,
    remainingVoters: remaining,
  } = tallyVotes(accommodations, votes, confirmedParticipantCount);
  const winner = ranked[0];

  const lead =
    validVotes === 0
      ? "아직 투표가 없어요."
      : isTie
        ? `${validVotes}명 모두 투표했지만 표가 같아요. 주최자가 최종 선택해요.`
        : remaining > 0
          ? `${validVotes}명이 투표했어요. 남은 투표가 있어 결과가 바뀔 수 있어요.`
          : `${validVotes}명 모두 투표했어요. 가장 많은 표를 받은 숙소가 1순위예요.`;

  async function reopen() {
    if (!reopenTarget) return;
    setReopening(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(
        reopenTarget === "voting" ? "reopen_voting" : "reopen_stay_candidates",
        { p_trip_id: tripId }
      );
      if (error) throw new Error(error.message);
      setReopenTarget(null);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "되돌리지 못했어요.", "error");
    } finally {
      setReopening(false);
    }
  }

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
      <Container className="flex flex-1 flex-col gap-5 pb-6 pt-4 md:gap-6 md:pt-8 desk:pb-12">
        <div>
          <h2 className="m-0 mb-2 text-2xl font-[650] leading-[1.2] text-ink desk:mb-1.5 desk:text-[28px]">
            투표 결과
          </h2>
          <p className="m-0 text-[15px] font-[300] leading-[1.43] text-text-muted">{lead}</p>
        </div>

        {/* Results read two abreast from md up — never more, so the bars stay
            long enough to compare at a glance. */}
        <div className="grid items-start gap-5 md:grid-cols-2 md:gap-6">
        {ranked.map((a) => {
          const count = tally.get(a.id) ?? 0;
          const rate = votePercentage(count, validVotes);
          const isTop = topAccommodationIds.has(a.id);
          const perPerson = confirmedParticipantCount
            ? perPersonPrice(a.total_price, confirmedParticipantCount)
            : null;
          return (
            <div
              key={a.id}
              className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface"
            >
              <div className="relative h-[140px] w-full desk:h-[180px]">
                <StayImage src={a.image_url} alt={a.name} />
                {isTop && (
                  <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
                    <Badge variant="primary">그룹 1순위</Badge>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2.5 p-4 desk:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 mb-0.5 break-words text-base font-semibold text-ink">
                      {a.name}
                    </p>
                    {/* 등록 당시의 예약안 그대로 — 투표가 시작되면 잠긴다. */}
                    <p className="m-0 text-sm text-ink-soft">{bookingLine(a)}</p>
                    <p className="m-0 text-sm text-ink-soft">
                      {a.location}
                      {perPerson != null && <> · 1인 약 {formatPrice(perPerson)}</>}
                    </p>
                  </div>
                  <p className="m-0 whitespace-nowrap text-[18px] font-[650] text-ink">
                    {count}표 · {rate}%
                  </p>
                </div>
                <ConsensusBar percent={rate} tone={isTop ? "primary" : "faint"} />
                <RoomsDisclosure accommodation={a} className="-ml-4" />
                {/* With a tie the host has to pick between equals, so the choice
                    moves onto the cards; otherwise it stays in the footer. */}
                {isHost && isTie && isTop && (
                  <Button variant="primary" fullWidth onClick={() => setConfirmTarget(a)}>
                    이 숙소로 확정하기
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        </div>

        {!isTie && remaining > 0 && validVotes > 0 && (
          <div className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-hairline-soft px-4 py-3">
            <span className="flex shrink-0 text-text-muted">
              <Clock size={16} aria-hidden="true" />
            </span>
            <p className="m-0 text-sm leading-[1.4] text-ink-soft">
              아직 {remaining}명이 투표하지 않았어요.
            </p>
          </div>
        )}

        {isTie && validVotes > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-conflict-pill-border bg-conflict-pill-bg px-4 py-3">
            <span className="mt-px flex shrink-0 text-conflict-text">
              <Info size={16} aria-hidden="true" />
            </span>
            <p className="m-0 text-sm leading-[1.4] text-conflict-text">
              동일한 표를 받은 숙소가 있어요. 주최자의 최종 선택이 필요해요.
            </p>
          </div>
        )}
      </Container>

      <ScreenFooter>
        {isHost ? (
          <>
            {!isTie && (
              <Button
                size="lg"
                fullWidth
                disabled={validVotes === 0 || !winner}
                onClick={() => winner && setConfirmTarget(winner)}
              >
                이 숙소로 확정하기
              </Button>
            )}
            <div className="flex gap-2 desk:gap-2">
              <Button
                variant="outline"
                className="min-w-0 flex-1 desk:flex-none"
                icon={<Undo2 size={16} aria-hidden="true" />}
                iconPosition="start"
                onClick={() => setReopenTarget("voting")}
              >
                투표 다시 열기
              </Button>
              <Button
                variant="outline"
                className="min-w-0 flex-1 desk:flex-none"
                icon={<RotateCcw size={16} aria-hidden="true" />}
                iconPosition="start"
                onClick={() => setReopenTarget("candidates")}
              >
                후보 다시 모으기
              </Button>
            </div>
            {validVotes === 0 && (
              <FooterNote>
                아직 아무도 투표하지 않았어요. 투표를 다시 열거나 후보부터 다시 모을 수 있어요.
              </FooterNote>
            )}
          </>
        ) : (
          <p className="m-0 flex min-h-11 items-center justify-center text-center text-sm text-text-muted">
            주최자가 최종 숙소를 확정하고 있어요.
          </p>
        )}
      </ScreenFooter>

      <Modal
        open={reopenTarget !== null}
        onClose={() => setReopenTarget(null)}
        title={
          reopenTarget === "voting" ? "투표를 다시 열까요?" : "후보를 다시 모을까요?"
        }
        description={
          reopenTarget === "voting"
            ? "지금까지의 표는 그대로 두고 다시 투표할 수 있게 돼요."
            : "숙소 후보를 추가하거나 고칠 수 있게 되고, 지금까지의 표는 모두 지워져요."
        }
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setReopenTarget(null)}>
            취소
          </Button>
          <Button fullWidth loading={reopening} onClick={reopen}>
            {reopenTarget === "voting" ? "투표 다시 열기" : "후보 다시 모으기"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="이 숙소로 확정할까요?"
        description={
          confirmTarget
            ? `"${confirmTarget.name}"으로 여행이 최종 확정돼요. 이후에는 되돌릴 수 없어요.`
            : undefined
        }
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
