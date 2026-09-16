"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatDateKo } from "@/lib/trip/format";
import type {
  DateWindowCandidate,
  PreferenceClassification,
  PreferenceKey,
  PreferenceItemResult,
  StyleConsensusResult,
} from "@/lib/trip/consensus";
import type { ConsensusSnapshot, SpendingStyle, TravelPace } from "@/lib/supabase/database.types";

const PREFERENCE_LABEL: Record<PreferenceKey, string> = {
  nature: "자연",
  food: "맛집",
  cafe: "카페",
  activity: "활동",
};
const CLASSIFICATION_LABEL: Record<PreferenceClassification, string> = {
  favored: "합의된 선호",
  disfavored: "그룹 비선호",
  conflict: "충돌",
  neutral: "중립",
};
const PACE_LABEL: Record<TravelPace, string> = { relaxed: "여유롭게", balanced: "적당히", packed: "알차게" };
const SPENDING_LABEL: Record<SpendingStyle, string> = {
  value: "가성비",
  balanced: "균형 있게",
  experience: "경험 우선",
};

function scoreLabel(avg: number): string {
  if (avg >= 1.5) return "꼭 필요";
  if (avg >= 0.5) return "좋아요";
  if (avg > -0.5) return "보통";
  if (avg > -1.5) return "별로";
  return "싫어요";
}

interface LiveProps {
  tripId: string;
  isHost: boolean;
  totalParticipants: number;
  respondedCount: number;
  pendingNicknames: string[];
  dateCandidates: DateWindowCandidate[];
  preferenceResults: Record<PreferenceKey, PreferenceItemResult>;
  paceConsensus: StyleConsensusResult<TravelPace>;
  spendingConsensus: StyleConsensusResult<SpendingStyle>;
  summary: string;
  confirmedSnapshot?: undefined;
  canReopen?: undefined;
}

interface FrozenProps {
  tripId: string;
  isHost: boolean;
  confirmedSnapshot: ConsensusSnapshot;
  canReopen: boolean;
  totalParticipants?: undefined;
  respondedCount?: undefined;
  pendingNicknames?: undefined;
  dateCandidates?: undefined;
  preferenceResults?: undefined;
  paceConsensus?: undefined;
  spendingConsensus?: undefined;
  summary?: undefined;
}

export function ConsensusView(props: LiveProps | FrozenProps) {
  if (props.confirmedSnapshot) return <FrozenConsensusView {...props} />;
  return <LiveConsensusView {...(props as LiveProps)} />;
}

function FrozenConsensusView({ tripId, confirmedSnapshot, canReopen }: FrozenProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [reopening, setReopening] = useState(false);
  const summary = confirmedSnapshot.preference_summary as { summarySentence?: string };

  async function reopen() {
    setReopening(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("reopen_group_direction", { p_trip_id: tripId });
      if (error) throw new Error(error.message);
      setShowReopenConfirm(false);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "다시 열지 못했어요.", "error");
    } finally {
      setReopening(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="그룹 합의" />
      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <Badge variant="primary">최종 합의 완료</Badge>
        {summary.summarySentence && (
          <div className="rounded-3xl bg-primary p-6 text-on-primary">
            <p className="mb-2 text-xs font-semibold text-white/80">한 줄 요약</p>
            <h2 className="m-0 text-xl font-bold leading-snug">{summary.summarySentence}</h2>
          </div>
        )}
        <div className="rounded-2xl border border-hairline-soft p-5">
          <p className="mb-1 text-xs font-semibold text-text-muted">확정 날짜</p>
          <p className="text-[17px] font-bold text-ink">
            {formatDateKo(confirmedSnapshot.selected_start_date)} – {formatDateKo(confirmedSnapshot.selected_end_date)}
          </p>
          <p className="mt-3 mb-1 text-xs font-semibold text-text-muted">참여 인원</p>
          <p className="text-[17px] font-bold text-ink">{confirmedSnapshot.participant_count}명</p>
        </div>

        {canReopen && (
          <div className="mt-auto pt-4">
            <Button variant="outline" fullWidth onClick={() => setShowReopenConfirm(true)}>
              합의 다시 열기
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={showReopenConfirm}
        onClose={() => setShowReopenConfirm(false)}
        title="그룹 합의를 다시 열까요?"
        description="확정된 날짜가 해제되고, 참여자들이 다시 날짜·취향을 수정할 수 있어요. 등록된 숙소 후보는 유지돼요."
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setShowReopenConfirm(false)}>
            취소
          </Button>
          <Button fullWidth loading={reopening} onClick={reopen}>
            다시 열기
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function LiveConsensusView({
  tripId,
  isHost,
  totalParticipants,
  respondedCount,
  pendingNicknames,
  dateCandidates,
  preferenceResults,
  paceConsensus,
  spendingConsensus,
  summary,
}: LiveProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showConfirmWarning, setShowConfirmWarning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const rankedPreferences = (Object.values(preferenceResults) as PreferenceItemResult[]).sort(
    (a, b) => b.average - a.average
  );
  const conflictItems = rankedPreferences.filter((r) => r.classification === "conflict");

  async function doConfirm() {
    const candidate = dateCandidates[selectedIndex];
    if (!candidate) return;
    setConfirming(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("confirm_group_direction", {
        p_trip_id: tripId,
        p_selected_start_date: candidate.startDate,
        p_selected_end_date: candidate.endDate,
        p_preference_summary: {
          items: preferenceResults,
          pace: paceConsensus,
          spendingStyle: spendingConsensus,
          summarySentence: summary,
        },
        p_conflict_summary: { items: conflictItems.map((c) => c.key) },
        p_participant_count: totalParticipants,
      });
      if (error) throw new Error(error.message);
      setShowConfirmWarning(false);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "확정하지 못했어요.", "error");
    } finally {
      setConfirming(false);
    }
  }

  function handleConfirmClick() {
    if (pendingNicknames.length > 0) {
      setShowConfirmWarning(true);
      return;
    }
    doConfirm();
  }

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="그룹 합의" />
      <div className="flex flex-1 flex-col gap-6 px-5 py-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">우리 그룹의 날짜와 취향을 모았어요.</p>
          <Badge variant="primary">
            {respondedCount}/{totalParticipants}명 응답
          </Badge>
        </div>
        {pendingNicknames.length > 0 && (
          <p className="text-xs text-text-muted">
            아직 응답하지 않았어요: {pendingNicknames.join(", ")}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <p className="text-base font-semibold text-ink">추천 날짜 후보</p>
          {dateCandidates.length === 0 && (
            <p className="text-sm text-text-muted">아직 계산할 수 있는 날짜 후보가 없어요.</p>
          )}
          {dateCandidates.map((c, i) => {
            const selected = i === selectedIndex;
            return (
              <button
                key={c.startDate}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedIndex(i)}
                disabled={!isHost}
                className={`flex flex-col gap-2 rounded-2xl border p-4 text-left disabled:cursor-default ${
                  selected ? "border-primary bg-primary-soft" : "border-hairline-soft bg-surface"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold text-ink">
                    {formatDateKo(c.startDate)} – {formatDateKo(c.endDate)}
                  </p>
                  <Badge variant={c.label === "합의 후보" ? "primary" : "conflict"}>{c.label}</Badge>
                </div>
                <p className="text-xs text-text-muted">
                  완전 가능 {c.fullyAvailableCount}명 · 참여 불가 {c.unavailableCount}명 · 미정{" "}
                  {c.tentativeDayInstances}건
                </p>
              </button>
            );
          })}
        </section>

        <div className="rounded-3xl bg-primary p-6 text-on-primary">
          <p className="mb-2 text-xs font-semibold text-white/80">한 줄 요약</p>
          <h2 className="m-0 text-xl font-bold leading-snug">{summary}</h2>
        </div>

        <section className="flex flex-col gap-3">
          <p className="text-base font-semibold text-ink">선호도 순위</p>
          <div className="overflow-hidden rounded-2xl border border-hairline-soft">
            {rankedPreferences.map((r) => (
              <div key={r.key} className="flex flex-col gap-1.5 border-b border-hairline-soft p-4 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-ink">{PREFERENCE_LABEL[r.key]}</span>
                  <Badge variant={r.classification === "conflict" ? "conflict" : r.classification === "favored" ? "primary" : "muted"}>
                    {scoreLabel(r.average)} · {CLASSIFICATION_LABEL[r.classification]}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted">
                  꼭 필요 {r.counts[2]} · 좋아요 {r.counts[1]} · 보통 {r.counts[0]} · 별로 {r.counts[-1]} · 싫어요{" "}
                  {r.counts[-2]}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl border border-hairline-soft p-4">
            <p className="text-xs font-semibold text-text-muted">일정 속도</p>
            <p className="text-lg font-bold text-ink">
              {paceConsensus.mode ? PACE_LABEL[paceConsensus.mode] : "의견이 나뉘었어요"}
            </p>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-hairline-soft p-4">
            <p className="text-xs font-semibold text-text-muted">소비 성향</p>
            <p className="text-lg font-bold text-ink">
              {spendingConsensus.mode ? SPENDING_LABEL[spendingConsensus.mode] : "의견이 나뉘었어요"}
            </p>
          </div>
        </section>

        {conflictItems.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="text-base font-semibold text-ink">조율이 필요한 {conflictItems.length}건</p>
            <div className="flex flex-col gap-2 rounded-2xl border border-conflict-border bg-conflict-bg p-4">
              {conflictItems.map((item) => (
                <div key={item.key}>
                  <p className="text-[15px] font-semibold text-ink">{PREFERENCE_LABEL[item.key]}</p>
                  <p className="text-sm text-ink-soft">
                    꼭 필요 {item.counts[2]} · 좋아요 {item.counts[1]} · 보통 {item.counts[0]} · 별로{" "}
                    {item.counts[-1]} · 싫어요 {item.counts[-2]}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {isHost && (
          <div className="mt-auto pt-2">
            <Button
              size="lg"
              fullWidth
              disabled={dateCandidates.length === 0}
              loading={confirming}
              onClick={handleConfirmClick}
            >
              이 방향으로 확정하기
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={showConfirmWarning}
        onClose={() => setShowConfirmWarning(false)}
        title="아직 응답하지 않은 참여자가 있어요."
        description="지금 확정하면 해당 참여자의 의견은 반영되지 않습니다."
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setShowConfirmWarning(false)}>
            계속 기다리기
          </Button>
          <Button fullWidth loading={confirming} onClick={doConfirm}>
            그래도 확정
          </Button>
        </div>
      </Modal>
    </div>
  );
}
