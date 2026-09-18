"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Clock,
  Gauge,
  MapPin,
  MessageSquareText,
  Pencil,
  Trees,
  Users,
  Wallet,
} from "lucide-react";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Container } from "@/components/layout/container";
import { CoverImage } from "@/components/ui/cover-image";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { ConsensusBar, toneForPercent, type BarTone } from "@/components/ui/consensus-bar";
import { SummaryRow } from "@/components/ui/summary-row";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatDateKo, formatTripLength } from "@/lib/trip/format";
import type {
  DateWindowCandidate,
  PreferenceClassification,
  PreferenceKey,
  PreferenceItemResult,
  StyleConsensusResult,
} from "@/lib/trip/consensus";
import type {
  ConsensusSnapshot,
  SpendingStyle,
  Togetherness,
  TravelPace,
} from "@/lib/supabase/database.types";

const PREFERENCE_LABEL: Record<PreferenceKey, string> = {
  nature: "자연",
  food: "맛집",
  cafe: "카페",
  activity: "활동",
};
const PACE_LABEL: Record<TravelPace, string> = {
  relaxed: "여유롭게",
  balanced: "적당히",
  packed: "알차게",
};
const PACE_THEME_LABEL: Record<TravelPace, string> = {
  relaxed: "여유로운 일정",
  balanced: "적당한 일정",
  packed: "알찬 일정",
};
const SPENDING_LABEL: Record<SpendingStyle, string> = {
  value: "가성비",
  balanced: "균형 있게",
  experience: "경험 우선",
};
const SPENDING_THEME_LABEL: Record<SpendingStyle, string> = {
  value: "가성비 소비",
  balanced: "균형 있는 소비",
  experience: "경험 우선 소비",
};
const TOGETHERNESS_LABEL: Record<Togetherness, string> = {
  mostly_together: "대부분 함께",
  core_together: "핵심 일정만 함께",
  free_time: "자유시간 선호",
};

function scoreLabel(avg: number): string {
  if (avg >= 1.5) return "꼭 필요";
  if (avg >= 0.5) return "좋아요";
  if (avg > -0.5) return "보통";
  if (avg > -1.5) return "별로";
  return "싫어요";
}

/** −2…2 mapped onto the 0–100 scale the bars are drawn against. */
function scorePercent(avg: number): number {
  return Math.round(((avg + 2) / 4) * 100);
}

/* The design fixes the reading: blue = agreed, ink = merely the majority,
   faint = ruled out. A conflict is never blue however high it averages. */
function barTone(result: PreferenceItemResult): BarTone {
  if (result.classification === "conflict" || result.classification === "disfavored") return "faint";
  return toneForPercent(scorePercent(result.average));
}

function badgeVariantFor(c: PreferenceClassification) {
  if (c === "conflict") return "conflict" as const;
  if (c === "favored") return "primary" as const;
  return "soft" as const;
}

function countsSentence(counts: Record<-2 | -1 | 0 | 1 | 2, number>): string {
  const parts: string[] = [];
  if (counts[2]) parts.push(`꼭 필요 ${counts[2]}`);
  if (counts[1]) parts.push(`좋아요 ${counts[1]}`);
  if (counts[0]) parts.push(`보통 ${counts[0]}`);
  if (counts[-1]) parts.push(`별로 ${counts[-1]}`);
  if (counts[-2]) parts.push(`싫어요 ${counts[-2]}`);
  return parts.join(" · ");
}

interface SharedProps {
  tripId: string;
  isHost: boolean;
  tripTitle: string;
  destination: string;
  tripDays: number;
}

export interface ParticipantNote {
  participantId: string;
  nickname: string;
  note: string;
}

interface LiveProps extends SharedProps {
  totalParticipants: number;
  respondedCount: number;
  pendingNicknames: string[];
  dateCandidates: DateWindowCandidate[];
  preferenceResults: Record<PreferenceKey, PreferenceItemResult>;
  paceConsensus: StyleConsensusResult<TravelPace>;
  spendingConsensus: StyleConsensusResult<SpendingStyle>;
  togethernessConsensus: StyleConsensusResult<Togetherness>;
  /** 자유 입력. 자동 계산에는 전혀 쓰지 않고 그대로 보여주기만 한다. */
  notes: ParticipantNote[];
  summary: string;
  confirmedSnapshot?: undefined;
  canReopen?: undefined;
}

interface FrozenProps extends SharedProps {
  confirmedSnapshot: ConsensusSnapshot;
  canReopen: boolean;
  totalParticipants?: undefined;
  respondedCount?: undefined;
  pendingNicknames?: undefined;
  dateCandidates?: undefined;
  preferenceResults?: undefined;
  paceConsensus?: undefined;
  spendingConsensus?: undefined;
  togethernessConsensus?: undefined;
  notes?: undefined;
  summary?: undefined;
}

export function ConsensusView(props: LiveProps | FrozenProps) {
  if (props.confirmedSnapshot) return <FrozenConsensusView {...props} />;
  return <LiveConsensusView {...(props as LiveProps)} />;
}

function ConsensusCover({
  title,
  caption,
  badge,
}: {
  title: string;
  caption: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="desk:hidden">
    <CoverImage height={150} scrimTop={48} padBottom={16} scrimEnd={0.7}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 mb-0.5 truncate text-[22px] font-[650] leading-[1.2] text-white">
            {title}
          </h2>
          <p className="m-0 text-[13px] text-white">{caption}</p>
        </div>
        {badge}
      </div>
    </CoverImage>
    </div>
  );
}

function FrozenConsensusView({
  tripId,
  tripTitle,
  destination,
  tripDays,
  confirmedSnapshot,
  canReopen,
}: FrozenProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [reopening, setReopening] = useState(false);
  const summary = confirmedSnapshot.preference_summary as {
    summarySentence?: string;
    pace?: { mode: TravelPace | null };
    spendingStyle?: { mode: SpendingStyle | null };
    togetherness?: { mode: Togetherness | null };
    items?: Record<string, { classification: string }>;
  };

  const theme = summary.items
    ? Object.entries(summary.items)
        .filter(([, v]) => v.classification === "favored")
        .map(([k]) => PREFERENCE_LABEL[k as PreferenceKey])
        .filter(Boolean)
        .join(" · ")
    : "";

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
      <ConsensusCover
        title={tripTitle}
        caption={`${destination} · ${formatTripLength(tripDays)} · ${confirmedSnapshot.participant_count}명`}
        badge={<Badge variant="overlay">합의 완료</Badge>}
      />

      <Container className="flex flex-1 flex-col gap-6 pb-6 pt-5 desk:gap-6 desk:pb-12 desk:pt-8">
        <div className="hidden items-end justify-between gap-6 desk:flex">
          <div className="min-w-0">
            <h3 className="m-0 mb-1.5 text-[28px] font-[650] leading-[1.2] text-ink">그룹 합의</h3>
            <p className="m-0 text-[15px] text-text-muted">
              {tripTitle} · {destination} · {formatTripLength(tripDays)}
            </p>
          </div>
          <Badge variant="primary">합의 완료</Badge>
        </div>
        {summary.summarySentence && (
          <div className="rounded-3xl bg-primary p-6 text-white md:px-7 md:py-6 desk:px-10 desk:py-8">
            <p className="m-0 mb-2 text-xs font-semibold leading-[1.33] text-on-primary-faint">
              한 줄 요약
            </p>
            <h2 className="m-0 max-w-[720px] text-2xl font-[650] leading-[1.2] text-balance md:text-[26px] desk:text-[32px] desk:leading-[1.15]">
              {summary.summarySentence}
            </h2>
          </div>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="m-0 text-base font-semibold text-ink">최종 합의</p>
            <Badge variant="primary">{confirmedSnapshot.participant_count}명 응답 반영</Badge>
          </div>
          <div className="flex flex-col gap-1 rounded-3xl bg-primary-soft px-5 pb-4 pt-5">
            <SummaryRow
              icon={Calendar}
              label="날짜"
              value={`${formatDateKo(confirmedSnapshot.selected_start_date)} – ${formatDateKo(
                confirmedSnapshot.selected_end_date
              )}`}
            />
            <SummaryRow icon={MapPin} label="지역" value={destination} />
            {theme && <SummaryRow icon={Trees} label="테마" value={theme} />}
            {summary.pace?.mode && (
              <SummaryRow
                icon={Gauge}
                label="일정"
                value={PACE_THEME_LABEL[summary.pace.mode]}
              />
            )}
            {summary.spendingStyle?.mode && (
              <SummaryRow
                icon={Wallet}
                label="소비"
                value={SPENDING_THEME_LABEL[summary.spendingStyle.mode]}
              />
            )}
            {summary.togetherness?.mode && (
              <SummaryRow
                icon={Users}
                label="함께"
                value={TOGETHERNESS_LABEL[summary.togetherness.mode]}
              />
            )}
          </div>

          <div className="flex flex-col gap-2 desk:flex-row desk:justify-end">
            <LinkButton
              href={`/trip/${tripId}/respond`}
              variant="outline"
              fullWidth
              className="desk:h-11 desk:w-auto"
              icon={<Pencil size={16} aria-hidden="true" />}
              iconPosition="start"
            >
              내 응답 보기
            </LinkButton>
            {canReopen && (
              <Button
                variant="soft"
                fullWidth
                className="desk:h-11 desk:w-auto"
                onClick={() => setShowReopenConfirm(true)}
              >
                합의 다시 열기
              </Button>
            )}
          </div>
          <p className="m-0 text-center text-xs text-text-muted desk:text-right">
            방향이 확정되어 응답은 보기 전용이에요.
          </p>
        </section>
      </Container>

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
  tripTitle,
  destination,
  tripDays,
  totalParticipants,
  respondedCount,
  pendingNicknames,
  dateCandidates,
  preferenceResults,
  paceConsensus,
  spendingConsensus,
  togethernessConsensus,
  notes,
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
  const favored = rankedPreferences.filter((r) => r.classification === "favored");
  const selectedCandidate = dateCandidates[selectedIndex];

  // The blue card's second line explains, in the design's own voice, what the
  // numbers above it add up to.
  const summaryDetail = (() => {
    if (respondedCount === 0) return "아직 응답이 없어요. 멤버들이 응답하면 여기에 정리돼요.";
    const parts: string[] = [];
    if (favored.length > 0) {
      parts.push(
        `${respondedCount}명이 ${favored.map((f) => PREFERENCE_LABEL[f.key]).join("·")}에 '좋아요' 이상`
      );
    }
    if (paceConsensus.mode) parts.push(`속도는 '${PACE_LABEL[paceConsensus.mode]}'로 모였습니다`);
    const head = parts.length > 0 ? parts.join(", ") + "." : `${respondedCount}명이 응답했어요.`;
    const tail =
      conflictItems.length > 0
        ? ` ${conflictItems.map((c) => PREFERENCE_LABEL[c.key]).join("과 ")}은 의견이 갈립니다.`
        : "";
    return head + tail;
  })();

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
          togetherness: togethernessConsensus,
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
      <ConsensusCover
        title={tripTitle}
        caption={`${destination} · ${formatTripLength(tripDays)} · ${totalParticipants}명`}
        badge={
          <Badge variant="overlay">
            {respondedCount}/{totalParticipants}명 응답
          </Badge>
        }
      />

      <Container className="flex flex-1 flex-col gap-6 pb-6 pt-5 desk:pb-12 desk:pt-8">
        <div className="hidden items-end justify-between gap-6 desk:flex">
          <div className="min-w-0">
            <h3 className="m-0 mb-1.5 text-[28px] font-[650] leading-[1.2] text-ink">그룹 합의</h3>
            <p className="m-0 text-[15px] text-text-muted">우리 그룹의 날짜와 취향을 모았어요.</p>
          </div>
          <Badge variant="primary">
            {respondedCount}/{totalParticipants}명 응답
          </Badge>
        </div>
        <p className="m-0 text-sm leading-[1.43] text-ink-soft desk:hidden">
          우리 그룹의 날짜와 취향을 모았어요.
        </p>

        <div className="rounded-3xl bg-primary p-6 text-white md:px-7 md:py-6 desk:px-10 desk:py-8">
          <p className="m-0 mb-2 text-xs font-semibold leading-[1.33] text-on-primary-faint">
            한 줄 요약
          </p>
          <h2 className="m-0 mb-3 max-w-[720px] text-2xl font-[650] leading-[1.2] text-balance md:text-[26px] desk:text-[32px] desk:leading-[1.15]">
            {summary}
          </h2>
          <p className="m-0 max-w-[640px] text-sm font-[300] leading-[1.43] text-primary-soft desk:text-base desk:leading-[1.45]">
            {summaryDetail}
          </p>
        </div>

        {/* Two reading columns from 768 up: what the group chose on the left,
            how they travel and what still clashes on the right. */}
        <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="m-0 text-base font-semibold text-ink">날짜 후보</p>
            <span className="text-xs text-text-muted">
              {isHost ? "하나를 골라 확정해요" : "주최자가 고릅니다"}
            </span>
          </div>
          {dateCandidates.length === 0 ? (
            <div className="rounded-2xl border border-hairline-soft px-4 py-3">
              <p className="m-0 text-[13px] text-text-muted">
                아직 계산할 수 있는 날짜 후보가 없어요.
              </p>
            </div>
          ) : (
            <div role="radiogroup" aria-label="날짜 후보" className="flex flex-col gap-2">
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
                      selected
                        ? "border-primary bg-primary-soft"
                        : "border-hairline-soft bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="m-0 text-[15px] font-semibold text-ink">
                        {formatDateKo(c.startDate)} – {formatDateKo(c.endDate)}
                      </p>
                      <Badge variant={c.label === "합의 후보" ? "primary" : "conflict"}>
                        {c.label}
                      </Badge>
                    </div>
                    <p className="m-0 text-[13px] text-ink-soft">
                      완전 가능 {c.fullyAvailableCount}명 · 참여 불가 {c.unavailableCount}명 · 미정{" "}
                      {c.tentativeDayInstances}건
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="m-0 text-base font-semibold text-ink">선호도 순위</p>
            <span className="text-xs text-text-muted">응답 {respondedCount}명 · 5단계 평균</span>
          </div>

          {pendingNicknames.length > 0 && (
            <div className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-hairline-soft px-4 py-3">
              <p className="m-0 flex-1 text-[13px] text-ink-soft">
                {pendingNicknames.join(", ")}님이 아직 응답하지 않았어요.
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface">
            {rankedPreferences.map((r) => {
              const pct = scorePercent(r.average);
              return (
                <div
                  key={r.key}
                  className="flex flex-col gap-2 border-b border-hairline-soft px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[15px] font-semibold text-ink">
                      {PREFERENCE_LABEL[r.key]}
                    </span>
                    <Badge variant={badgeVariantFor(r.classification)}>
                      {scoreLabel(r.average)} · {pct}%
                      {r.classification === "conflict" ? " · 충돌" : ""}
                    </Badge>
                  </div>
                  <ConsensusBar percent={pct} tone={barTone(r)} />
                  <p className="m-0 text-[13px] text-ink-soft">{countsSentence(r.counts)}</p>
                </div>
              );
            })}
          </div>
        </section>
        </div>

        <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="m-0 text-base font-semibold text-ink">여행 리듬</p>
            <span className="text-[13px] text-text-muted">가장 많이 고른 것</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RhythmCard
              label="일정 속도"
              mode={paceConsensus.mode ? PACE_LABEL[paceConsensus.mode] : null}
              counts={paceConsensus.counts as Record<string, number>}
              labels={PACE_LABEL as Record<string, string>}
              total={respondedCount}
            />
            <RhythmCard
              label="소비 성향"
              mode={spendingConsensus.mode ? SPENDING_LABEL[spendingConsensus.mode] : null}
              counts={spendingConsensus.counts as Record<string, number>}
              labels={SPENDING_LABEL as Record<string, string>}
              total={respondedCount}
            />
          </div>

          <TogethernessCard consensus={togethernessConsensus} />
        </section>

        {conflictItems.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="m-0 text-base font-semibold text-ink">
              조율이 필요한 {conflictItems.length}건
            </p>
            <div className="flex flex-col gap-3 rounded-2xl border border-conflict-border bg-conflict-bg p-4">
              {conflictItems.map((item, i) => (
                <div key={item.key} className="flex flex-col gap-3">
                  {i > 0 && <div className="h-px bg-hairline-soft" aria-hidden="true" />}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 mb-0.5 text-[15px] font-semibold text-ink">
                        {PREFERENCE_LABEL[item.key]}
                      </p>
                      <p className="m-0 text-sm leading-[1.45] text-ink-soft">
                        {countsSentence(item.counts)} — 의견이 양쪽으로 갈려요.
                      </p>
                    </div>
                    <Badge variant="conflict">충돌</Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 자유 입력은 취향 충돌과 섞지 않고 따로 세운다. 점수에 들어가지 않고,
            확정 전에 한 번 읽히도록 최종 합의 바로 위에 둔다. */}
        {notes.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex text-text-muted">
                <MessageSquareText size={18} aria-hidden="true" />
              </span>
              <p className="m-0 text-base font-semibold text-ink">개별 요청 {notes.length}건</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface">
              {notes.map((n) => (
                <div
                  key={n.participantId}
                  className="flex flex-col gap-1 border-b border-hairline-soft px-4 py-3 last:border-b-0"
                >
                  <p className="m-0 text-[13px] font-semibold text-text-muted">{n.nickname}</p>
                  <p className="m-0 whitespace-pre-wrap text-[15px] leading-[1.5] text-ink">
                    {n.note}
                  </p>
                </div>
              ))}
            </div>
            <p className="m-0 text-xs text-text-muted">
              참여자가 직접 적은 내용이에요. 취향 점수나 날짜 추천에는 반영되지 않아요.
            </p>
          </section>
        )}
        </div>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between desk:hidden">
            <p className="m-0 text-base font-semibold text-ink">최종 합의</p>
            <Badge variant="primary">
              {respondedCount}/{totalParticipants}명 응답 반영
            </Badge>
          </div>

          {/* Desktop: the decided facts read across one wide bar, actions hard
              right — the board's closing row, not a stacked card. */}
          <div className="hidden flex-wrap items-center justify-between gap-8 rounded-3xl bg-primary-soft px-8 py-6 desk:flex">
            <div className="flex flex-wrap gap-10">
              <FactPair
                label="날짜"
                value={
                  selectedCandidate
                    ? `${formatDateKo(selectedCandidate.startDate)} – ${formatDateKo(selectedCandidate.endDate)}`
                    : "후보 계산 중"
                }
              />
              <FactPair label="지역" value={destination} />
              <FactPair
                label="테마"
                value={
                  favored.length > 0
                    ? favored.map((f) => PREFERENCE_LABEL[f.key]).join(" · ") + " 중심"
                    : "아직 갈림"
                }
              />
              <FactPair
                label="리듬"
                value={[
                  paceConsensus.mode ? PACE_LABEL[paceConsensus.mode] : "아직 갈림",
                  spendingConsensus.mode ? SPENDING_LABEL[spendingConsensus.mode] : "아직 갈림",
                ].join(" · ")}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <LinkButton
                href={`/trip/${tripId}/respond`}
                variant="outline"
                className="h-11"
                icon={<Pencil size={16} aria-hidden="true" />}
                iconPosition="start"
              >
                내 응답 수정
              </LinkButton>
              {isHost && (
                <Button
                  className="h-11"
                  icon={<ArrowRight size={16} aria-hidden="true" />}
                  disabled={dateCandidates.length === 0}
                  loading={confirming}
                  onClick={handleConfirmClick}
                >
                  이 방향으로 확정하기
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-3xl bg-primary-soft px-5 pb-4 pt-5 desk:hidden">
            <SummaryRow
              icon={Calendar}
              label="날짜"
              value={
                selectedCandidate
                  ? `${formatDateKo(selectedCandidate.startDate)} – ${formatDateKo(selectedCandidate.endDate)}`
                  : "후보 계산 중"
              }
            />
            <SummaryRow icon={MapPin} label="지역" value={destination} />
            <SummaryRow
              icon={Trees}
              label="테마"
              value={
                favored.length > 0
                  ? favored.map((f) => PREFERENCE_LABEL[f.key]).join(" · ") + " 중심"
                  : "아직 갈림"
              }
            />
            <SummaryRow
              icon={Gauge}
              label="일정"
              value={paceConsensus.mode ? PACE_THEME_LABEL[paceConsensus.mode] : "아직 갈림"}
            />
            <SummaryRow
              icon={Wallet}
              label="소비"
              value={
                spendingConsensus.mode
                  ? SPENDING_THEME_LABEL[spendingConsensus.mode]
                  : "아직 갈림"
              }
            />
            <SummaryRow
              icon={Users}
              label="함께"
              value={
                togethernessConsensus.mode
                  ? TOGETHERNESS_LABEL[togethernessConsensus.mode]
                  : "아직 갈림"
              }
            />
          </div>

          <div className="flex flex-col gap-3 desk:hidden">
          {isHost ? (
            <>
              <Button
                size="lg"
                fullWidth
                icon={<ArrowRight size={16} aria-hidden="true" />}
                disabled={dateCandidates.length === 0}
                loading={confirming}
                onClick={handleConfirmClick}
              >
                이 방향으로 확정하기
              </Button>
              <p className="m-0 text-center text-xs text-text-muted">
                확정하면 숙소 후보 등록이 열려요. 주최자만 확정할 수 있어요.
              </p>
            </>
          ) : (
            <div className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-hairline-soft px-4 py-3">
              <span className="flex text-text-muted">
                <Clock size={18} aria-hidden="true" />
              </span>
              <p className="m-0 text-sm text-ink-soft">주최자가 여행 방향을 확정하고 있어요.</p>
            </div>
          )}

          <LinkButton
            href={`/trip/${tripId}/respond`}
            variant="outline"
            fullWidth
            icon={<Pencil size={16} aria-hidden="true" />}
            iconPosition="start"
          >
            내 응답 수정
          </LinkButton>
          <p className="m-0 text-center text-xs text-text-muted">
            방향이 확정되면 응답은 보기 전용으로 바뀌어요.
          </p>
          </div>
        </section>
      </Container>

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

/* 함께 다니는 방식. 단독 최다가 있으면 그것을 그룹 성향으로 쓰고, 동률이면
   임의로 하나를 고르지 않고 갈렸다는 사실과 표 수를 그대로 남긴다. */
function TogethernessCard({ consensus }: { consensus: StyleConsensusResult<Togetherness> }) {
  const entries = (Object.entries(consensus.counts) as [Togetherness, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col gap-1.5 rounded-2xl border border-hairline-soft bg-surface p-4">
        <p className="m-0 text-xs font-semibold leading-[1.33] text-text-muted">함께 다니는 방식</p>
        <p className="m-0 text-[15px] text-text-muted">아직 고른 사람이 없어요.</p>
      </div>
    );
  }

  if (consensus.mode) {
    const top = entries[0];
    return (
      <div className="flex flex-col gap-1.5 rounded-2xl border border-hairline-soft bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="flex text-text-muted">
            <Users size={16} aria-hidden="true" />
          </span>
          <p className="m-0 text-xs font-semibold leading-[1.33] text-text-muted">
            함께 다니는 방식
          </p>
        </div>
        <p className="m-0 text-[18px] font-[650] text-ink">{TOGETHERNESS_LABEL[consensus.mode]}</p>
        <p className="m-0 text-[13px] text-ink-soft">
          {total}명 중 {top[1]}명이 선택했어요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-conflict-border bg-conflict-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-[15px] font-semibold text-ink">함께 다니는 방식이 나뉘었어요.</p>
        <Badge variant="conflict">충돌</Badge>
      </div>
      <div className="flex flex-col gap-0.5">
        {entries.map(([key, count]) => (
          <p key={key} className="m-0 text-[13px] text-ink-soft">
            {TOGETHERNESS_LABEL[key]} {count}명
          </p>
        ))}
      </div>
    </div>
  );
}

/* One label/value pair in the desktop 최종 합의 bar. */
function FactPair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="m-0 mb-0.5 text-[13px] text-text-muted">{label}</p>
      <p className="m-0 text-[18px] font-[650] text-ink">{value}</p>
    </div>
  );
}

function RhythmCard({
  label,
  mode,
  counts,
  labels,
  total,
}: {
  label: string;
  mode: string | null;
  counts: Record<string, number>;
  labels: Record<string, string>;
  total: number;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topCount = entries[0]?.[1] ?? 0;
  const rest = entries
    .slice(1)
    .map(([k, c]) => `${labels[k] ?? k} ${c}`)
    .join(" · ");

  if (!mode) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-conflict-border bg-conflict-bg p-4">
        <p className="m-0 text-xs font-semibold leading-[1.33] text-text-muted">{label}</p>
        <p className="m-0 text-[18px] font-[650] text-ink">아직 갈림</p>
        <Badge variant="conflict" className="self-start">
          {entries.map(([, c]) => c).join(" · ") || "0"}
        </Badge>
        <p className="m-0 text-xs text-text-muted">
          {entries.map(([k]) => labels[k] ?? k).join(" · ") || "응답 없음"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-hairline-soft bg-surface p-4">
      <p className="m-0 text-xs font-semibold leading-[1.33] text-text-muted">{label}</p>
      <p className="m-0 text-[18px] font-[650] text-ink">{mode}</p>
      <Badge variant="primary" className="self-start">
        {total}명 중 {topCount}명
      </Badge>
      <p className="m-0 text-xs text-text-muted">{rest || " "}</p>
    </div>
  );
}
