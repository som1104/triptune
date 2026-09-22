"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonSession } from "@/lib/supabase/ensure-session";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { TripTopNav } from "@/components/layout/trip-top-nav";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { getMonthGrid } from "@/lib/trip/calendar";
import { countDateStates } from "@/lib/trip/consensus";
import { formatShortDateKo, formatTripLength } from "@/lib/trip/format";
import type {
  DateAvailability,
  PreferenceResponse,
  SpendingStyle,
  Togetherness,
  TravelPace,
} from "@/lib/supabase/database.types";

type PreferenceKey = "nature" | "food" | "cafe" | "activity";

const PREFERENCE_FIELDS: { key: PreferenceKey; label: string }[] = [
  { key: "nature", label: "자연" },
  { key: "food", label: "맛집" },
  { key: "cafe", label: "카페" },
  { key: "activity", label: "활동" },
];

const PREFERENCE_OPTIONS = [
  { value: -2, label: "싫어요" },
  { value: -1, label: "별로" },
  { value: 0, label: "보통" },
  { value: 1, label: "좋아요" },
  { value: 2, label: "꼭 필요" },
];

const PACE_OPTIONS: { value: TravelPace; label: string }[] = [
  { value: "relaxed", label: "여유롭게" },
  { value: "balanced", label: "적당히" },
  { value: "packed", label: "알차게" },
];

const SPENDING_OPTIONS: { value: SpendingStyle; label: string }[] = [
  { value: "value", label: "가성비" },
  { value: "balanced", label: "균형 있게" },
  { value: "experience", label: "경험 우선" },
];

const TOGETHERNESS_OPTIONS: { value: Togetherness; label: string; description: string }[] = [
  {
    value: "mostly_together",
    label: "대부분 함께",
    description: "여행 일정을 거의 같이 보내고 싶어요.",
  },
  {
    value: "core_together",
    label: "핵심 일정만 함께",
    description: "중요한 일정은 같이하고 일부는 자유롭게 보내고 싶어요.",
  },
  {
    value: "free_time",
    label: "자유시간 선호",
    description: "각자 원하는 시간을 충분히 갖고 싶어요.",
  },
];

const NOTE_MAX = 100;

/* 상태를 먼저 고르고 날짜를 눌러 칠한다 — 한 번 누를 때마다 값이 도는
   방식은 쓰지 않는다. 같은 상태를 다시 눌러도 해제되지 않는다. */
const PAINT_MODES: { value: DateAvailability; label: string; mark: string }[] = [
  { value: "available", label: "가능", mark: "●" },
  { value: "tentative", label: "미정", mark: "○" },
  { value: "unavailable", label: "불가", mark: "－" },
];

const CELL_BASE =
  "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border p-0";

const CELL_STATE: Record<DateAvailability, string> = {
  available: "border-primary bg-primary text-on-primary",
  tentative: "border-dashed border-text-muted bg-surface text-ink-soft",
  unavailable: "border-hairline bg-surface text-text-faint line-through",
};

const CELL_LABEL: Record<DateAvailability, string> = {
  available: "가능",
  tentative: "미정",
  unavailable: "불가",
};

const CELL_MARK: Record<DateAvailability, string> = {
  available: "●",
  tentative: "○",
  unavailable: "－",
};

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 후보 기간에 포함된 모든 날짜. 달이 바뀌어도 하나의 연속 범위로 다룬다. */
function datesInRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const d = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  while (d <= end) {
    out.push(toIso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function RespondForm({
  tripId,
  candidateStartDate,
  candidateEndDate,
  tripDays,
  initialDates,
  initialPreference,
}: {
  tripId: string;
  candidateStartDate: string;
  candidateEndDate: string;
  tripDays: number;
  initialDates: Record<string, DateAvailability>;
  initialPreference: Pick<
    PreferenceResponse,
    "nature" | "food" | "cafe" | "activity" | "pace" | "spending_style" | "togetherness" | "note"
  > | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pendingNav, startTransition] = useTransition();

  const allDates = useMemo(
    () => datesInRange(candidateStartDate, candidateEndDate),
    [candidateStartDate, candidateEndDate]
  );

  /* 후보 기간의 모든 날짜는 미정에서 출발한다. 사용자는 확실한 날짜만
     가능/불가로 바꾸면 되고, 저장할 때도 전부 명시적으로 보낸다. */
  const blankDates = useMemo(() => {
    const map: Record<string, DateAvailability> = {};
    for (const iso of allDates) map[iso] = "tentative";
    return map;
  }, [allDates]);

  const [dates, setDates] = useState<Record<string, DateAvailability>>(() => ({
    ...blankDates,
    ...initialDates,
  }));
  const [paintMode, setPaintMode] = useState<DateAvailability>("available");

  const [nature, setNature] = useState<number | undefined>(initialPreference?.nature);
  const [food, setFood] = useState<number | undefined>(initialPreference?.food);
  const [cafe, setCafe] = useState<number | undefined>(initialPreference?.cafe);
  const [activity, setActivity] = useState<number | undefined>(initialPreference?.activity);
  const [pace, setPace] = useState<TravelPace | undefined>(initialPreference?.pace);
  const [spendingStyle, setSpendingStyle] = useState<SpendingStyle | undefined>(
    initialPreference?.spending_style
  );
  const [togetherness, setTogetherness] = useState<Togetherness | undefined>(
    initialPreference?.togetherness ?? undefined
  );
  const [showTogethernessHelp, setShowTogethernessHelp] = useState(false);
  const [note, setNote] = useState(initialPreference?.note ?? "");

  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // 저장 성공 후 합의 화면으로 넘어가는 동안 버튼을 되살리지 않는다.
  const [leaving, setLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showNoAvailableConfirm, setShowNoAvailableConfirm] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [markedInProgress, setMarkedInProgress] = useState(false);

  const interestsRef = useRef<HTMLElement>(null);
  const styleRef = useRef<HTMLElement>(null);

  const start = new Date(candidateStartDate + "T00:00:00");
  const endDate = new Date(candidateEndDate + "T00:00:00");
  const [monthCursor, setMonthCursor] = useState(new Date(start.getFullYear(), start.getMonth(), 1));

  const minMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const maxMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  const spansTwoMonths = maxMonth > minMonth;

  /* 데스크톱에서는 달이 걸쳐 있으면 두 달을 나란히 보여준다. 태블릿은 본문이
     이미 2열이라 달력 하나가 들어갈 폭밖에 없어 한 달씩 넘긴다. */
  const secondMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
  const showsSecondMonth = spansTwoMonths && secondMonth <= maxMonth;

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function markDirty() {
    setDirty(true);
    setSaved(false);
    if (!markedInProgress) {
      setMarkedInProgress(true);
      const supabase = createClient();
      supabase.rpc("mark_response_in_progress", { p_trip_id: tripId }).then(() => {});
    }
  }

  function paintDate(iso: string) {
    setDates((prev) => (prev[iso] === paintMode ? prev : { ...prev, [iso]: paintMode }));
    markDirty();
  }

  function resetDates() {
    setDates({ ...blankDates });
    setShowResetConfirm(false);
    markDirty();
  }

  // 요약은 보고 있는 달이 아니라 후보 기간 전체를 센다.
  const counts = useMemo(() => countDateStates(allDates, dates), [allDates, dates]);

  const interestsDone =
    nature !== undefined && food !== undefined && cafe !== undefined && activity !== undefined;
  const styleDone =
    pace !== undefined && spendingStyle !== undefined && togetherness !== undefined;
  const canSave = interestsDone && styleDone;

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      await ensureAnonSession(supabase);

      const { error } = await supabase.rpc("save_my_response", {
        p_trip_id: tripId,
        p_dates: allDates.map((date) => ({
          date,
          availability: dates[date] ?? "tentative",
        })),
        p_nature: nature!,
        p_food: food!,
        p_cafe: cafe!,
        p_activity: activity!,
        p_pace: pace!,
        p_spending_style: spendingStyle!,
        p_togetherness: togetherness!,
        p_note: note.trim() ? note.trim() : null,
      });
      if (error) throw new Error(error.message);

      setDirty(false);
      // The confirmation is the pill in the sticky footer below (design 04).
      // Do not also fire a toast — the toast rail sits 88px off the bottom,
      // which lands right on top of that pill.
      setSaved(true);
      setShowNoAvailableConfirm(false);

      /* 저장이 확인된 뒤에만 넘어간다. 저장됨 표시를 잠깐 보여준 다음
         그룹 합의로 이동하는데, 그 사이 버튼은 계속 잠겨 있어야 한다. */
      setLeaving(true);
      window.setTimeout(() => {
        startTransition(() => {
          // 합의 화면이 라우터 캐시에 남아 있으면 방금 낸 응답이 빠진 채로
          // 그려진다. 먼저 캐시를 버리고 같은 전환 안에서 이동한다.
          router.refresh();
          router.push(`/trip/${tripId}/consensus`);
        });
      }, 700);
      return;
    } catch (err) {
      // 실패하면 화면에 그대로 머문다 — 입력값은 상태에 살아 있고, dirty 도
      // 그대로라 바로 다시 저장할 수 있다.
      showToast(
        err instanceof Error
          ? `저장하지 못했어요. ${err.message}`
          : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
        "error"
      );
      setShowNoAvailableConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (saving || leaving) return;
    if (!interestsDone) {
      setStyleError("여행 관심사를 모두 선택해 주세요.");
      interestsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!styleDone) {
      setStyleError("여행 스타일을 모두 선택해 주세요.");
      styleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setStyleError(null);
    // 모든 날짜가 불가이거나 미정인 상황도 표현할 수 있어야 하니 막지는 않고
    // 한 번만 확인한다.
    if (counts.available === 0) {
      setShowNoAvailableConfirm(true);
      return;
    }
    save();
  }

  function handleBack() {
    if (dirty) {
      setShowLeaveConfirm(true);
      return;
    }
    router.push(`/trip/${tripId}`);
  }

  const saveHint = !canSave
    ? "관심사와 여행 스타일을 모두 고르면 저장할 수 있어요."
    : leaving
      ? "그룹 합의 화면으로 이동할게요."
      : dirty
        ? "저장하면 그룹 합의 화면으로 넘어가요."
        : "변경한 내용이 없어요.";

  function renderMonth(cursor: Date, compact: boolean) {
    const grid = getMonthGrid(
      cursor.getFullYear(),
      cursor.getMonth(),
      candidateStartDate,
      candidateEndDate
    );
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        {compact && (
          <p className="m-0 text-center text-sm font-semibold text-ink">
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </p>
        )}
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              className="text-center text-xs font-semibold leading-[1.33] text-text-muted"
            >
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 desk:gap-1.5">
          {grid.map((cell) => {
            // 옆 달의 날짜는 그 달 달력에서만 누른다 — 두 달을 나란히 놓으면
            // 같은 날짜가 두 번 나와 어느 쪽을 눌렀는지 알 수 없어진다.
            if (!cell.inCandidateRange || !cell.inCurrentMonth) {
              return (
                <div
                  key={cell.iso}
                  aria-hidden="true"
                  className={`${CELL_BASE} border-transparent bg-transparent text-text-faint opacity-60`}
                >
                  <span className="text-[15px] font-semibold leading-none">
                    {cell.inCurrentMonth ? cell.day : ""}
                  </span>
                </div>
              );
            }
            const state = dates[cell.iso] ?? "tentative";
            return (
              <button
                key={cell.iso}
                type="button"
                aria-pressed={state === paintMode}
                aria-label={`${cell.day}일, ${CELL_LABEL[state]}`}
                onClick={() => paintDate(cell.iso)}
                className={`${CELL_BASE} ${CELL_STATE[state]}`}
              >
                <span className="text-[15px] font-semibold leading-none">{cell.day}</span>
                {compact ? (
                  <span aria-hidden="true" className="text-[10px] leading-none">
                    {CELL_MARK[state]}
                  </span>
                ) : (
                  <span aria-hidden="true" className="text-xs font-[450] leading-none">
                    {CELL_LABEL[state]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TripTopNav tripId={tripId} />
      <TripAppBar title="내 날짜와 취향" back onBack={handleBack} />

      <Container className="flex flex-1 flex-col pb-6 pt-4 desk:pb-12 desk:pt-8">
        <div className="mb-5 hidden desk:block">
          <h2 className="m-0 mb-1.5 text-[28px] font-[650] leading-[1.2] text-ink">
            가능한 날짜를 알려주세요.
          </h2>
          <p className="m-0 text-[15px] text-text-muted">
            확실한 날짜만 표시하면 돼요. 나머지는 미정으로 남겨두세요.
          </p>
        </div>

        {/* ① 이번 여행의 날짜 조건. 보고 있는 달과 헷갈리지 않게 따로 둔다. */}
        <div className="mb-5 grid gap-3 rounded-2xl bg-primary-soft px-5 py-4 sm:grid-cols-2">
          <div>
            <p className="m-0 mb-0.5 text-[13px] text-text-muted">여행 후보 기간</p>
            <p className="m-0 text-[15px] font-semibold text-ink">
              {formatShortDateKo(candidateStartDate)}–{formatShortDateKo(candidateEndDate)}
              <span className="ml-1.5 text-[13px] font-[450] text-text-muted">
                {allDates.length}일
              </span>
            </p>
          </div>
          <div>
            <p className="m-0 mb-0.5 text-[13px] text-text-muted">예정 여행 기간</p>
            <p className="m-0 text-[15px] font-semibold text-ink">{formatTripLength(tripDays)}</p>
          </div>
        </div>

        {/* 768px up: calendar left, preferences right, tops aligned. */}
        <div className="grid items-start gap-5 md:grid-cols-2 md:gap-6">
          <section className="flex max-w-[560px] flex-col gap-3 md:rounded-2xl md:border md:border-hairline-soft md:p-5 desk:p-6">
            {/* ② 표시할 상태 */}
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="m-0 text-base font-semibold text-ink">표시할 상태</p>
                <span className="text-xs text-text-muted">고른 뒤 날짜를 누르세요</span>
              </div>
              <div role="radiogroup" aria-label="표시할 상태" className="grid grid-cols-3 gap-2">
                {PAINT_MODES.map((m) => {
                  const selected = paintMode === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPaintMode(m.value)}
                      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${
                        selected
                          ? "border-primary bg-primary text-on-primary"
                          : "border-hairline bg-surface text-ink hover:bg-primary-soft"
                      }`}
                    >
                      <span aria-hidden="true">{m.mark}</span>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ③ 달력 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="이전 달"
                  disabled={monthCursor <= minMonth}
                  onClick={() =>
                    setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-primary-soft disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <p className="m-0 text-xl font-[650] text-ink">
                  {monthCursor.getFullYear()}년 {monthCursor.getMonth() + 1}월
                  {showsSecondMonth && (
                    <span className="hidden desk:inline"> · {secondMonth.getMonth() + 1}월</span>
                  )}
                </p>
                <button
                  type="button"
                  aria-label="다음 달"
                  disabled={monthCursor >= maxMonth}
                  onClick={() =>
                    setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-primary-soft disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </div>
              <Badge variant="soft">{formatTripLength(tripDays)}</Badge>
            </div>

            {/* 한 달 보기 — 모바일과 태블릿 */}
            <div className={showsSecondMonth ? "desk:hidden" : ""}>{renderMonth(monthCursor, false)}</div>

            {/* 두 달 나란히 — 데스크톱에서 후보 기간이 달을 넘어갈 때만 */}
            {showsSecondMonth && (
              <div className="hidden gap-4 desk:grid desk:grid-cols-2">
                {renderMonth(monthCursor, true)}
                {renderMonth(secondMonth, true)}
              </div>
            )}

            {/* ④ 요약과 초기화 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline-soft pt-3">
              <p className="m-0 text-[13px] text-ink-soft">
                가능 {counts.available}일 · 미정 {counts.tentative}일 · 불가{" "}
                {counts.unavailable}일
              </p>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-ink"
              >
                <RotateCcw size={14} aria-hidden="true" />
                전체 미정으로 초기화
              </button>
            </div>
          </section>

          <div className="flex max-w-[520px] flex-col gap-5">
            {/* ⑤ 여행 관심사 */}
            <section
              ref={interestsRef}
              className="flex flex-col gap-2 md:rounded-2xl md:border md:border-hairline-soft md:p-5 desk:gap-4 desk:p-6"
            >
              <div className="flex items-center justify-between">
                <p className="m-0 text-base font-semibold text-ink">여행 관심사</p>
                <span className="text-xs text-text-muted">항목마다 하나씩 선택</span>
              </div>
              <div className="flex flex-col gap-4">
                {PREFERENCE_FIELDS.map(({ key, label }) => {
                  const value = { nature, food, cafe, activity }[key];
                  const setValue = {
                    nature: setNature,
                    food: setFood,
                    cafe: setCafe,
                    activity: setActivity,
                  }[key];
                  return (
                    <div key={key} className="flex flex-col gap-2">
                      <p className="m-0 text-[15px] font-semibold text-ink">{label}</p>
                      <PillSelect
                        ariaLabel={label}
                        columns={5}
                        options={PREFERENCE_OPTIONS}
                        value={value}
                        onChange={(v) => {
                          setValue(v);
                          setStyleError(null);
                          markDirty();
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ⑥⑦⑧ 여행 스타일 */}
            <section
              ref={styleRef}
              className="flex flex-col gap-4 md:rounded-2xl md:border md:border-hairline-soft md:p-5 desk:p-6"
            >
              <p className="m-0 text-base font-semibold text-ink">여행 스타일</p>

              <div className="flex flex-col gap-2">
                <p className="m-0 text-[15px] font-semibold text-ink">일정 속도</p>
                <PillSelect
                  ariaLabel="일정 속도"
                  columns={3}
                  options={PACE_OPTIONS}
                  value={pace}
                  onChange={(v) => {
                    setPace(v);
                    setStyleError(null);
                    markDirty();
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <p className="m-0 text-[15px] font-semibold text-ink">소비 성향</p>
                <PillSelect
                  ariaLabel="소비 성향"
                  columns={3}
                  options={SPENDING_OPTIONS}
                  value={spendingStyle}
                  onChange={(v) => {
                    setSpendingStyle(v);
                    setStyleError(null);
                    markDirty();
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="m-0 text-[15px] font-semibold text-ink">함께 다니는 정도</p>
                  <button
                    type="button"
                    aria-expanded={showTogethernessHelp}
                    onClick={() => setShowTogethernessHelp((v) => !v)}
                    className="min-h-11 text-[13px] font-semibold text-ink"
                  >
                    {showTogethernessHelp ? "설명 접기" : "설명 보기"}
                  </button>
                </div>
                <div role="radiogroup" aria-label="함께 다니는 정도" className="flex flex-col gap-2">
                  {TOGETHERNESS_OPTIONS.map((o) => {
                    const selected = togetherness === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setTogetherness(o.value);
                          setStyleError(null);
                          markDirty();
                        }}
                        className={`flex min-h-11 flex-col items-start gap-0.5 rounded-2xl border px-4 py-3 text-left ${
                          selected
                            ? "border-primary bg-primary-soft"
                            : "border-hairline-soft bg-surface hover:bg-primary-soft"
                        }`}
                      >
                        <span className="text-[15px] font-semibold text-ink">{o.label}</span>
                        {showTogethernessHelp && (
                          <span className="text-[13px] leading-[1.45] text-ink-soft">
                            {o.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {styleError && (
                <p className="m-0 text-xs font-medium text-conflict-text">{styleError}</p>
              )}
            </section>

            {/* ⑨ 꼭 반영할 점 — 어떤 점수에도 들어가지 않는 자유 입력 */}
            <section className="flex flex-col gap-2 md:rounded-2xl md:border md:border-hairline-soft md:p-5 desk:p-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="m-0 text-base font-semibold text-ink">꼭 반영할 점이 있나요?</p>
                <Badge variant="soft">선택</Badge>
              </div>
              <p className="m-0 text-[13px] leading-[1.45] text-text-muted">
                여행 중 꼭 고려해야 할 조건이나 친구들에게 미리 알리고 싶은 내용을 적어주세요.
              </p>
              <textarea
                aria-label="꼭 반영할 점"
                maxLength={NOTE_MAX}
                rows={3}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value.slice(0, NOTE_MAX));
                  markDirty();
                }}
                placeholder="예: 못 먹는 음식, 어려운 출발 시간, 개별 침대 등"
                className="w-full resize-none rounded-2xl bg-field px-4 py-3 text-[15px] leading-[1.5] text-ink outline-none placeholder:text-text-faint focus:ring-2 focus:ring-inset focus:ring-ink"
              />
              <div className="flex items-baseline justify-between gap-3">
                <p className="m-0 text-xs text-text-muted">
                  작성한 내용은 여행 참여자 모두에게 공개돼요.
                </p>
                <span className="shrink-0 text-xs text-text-muted">
                  {note.length} / {NOTE_MAX}
                </span>
              </div>
            </section>

            {/* ⑩ 저장 — 768 이상에서는 폼 아래 오른쪽 */}
            <div className="hidden items-center justify-end gap-3 md:flex">
              {saved && (
                <span className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white">
                  <Check size={16} aria-hidden="true" />
                  저장됨
                </span>
              )}
              <p className="m-0 text-[13px] text-text-muted">{saveHint}</p>
              <Button
                disabled={!dirty || leaving}
                loading={saving || leaving || pendingNav}
                onClick={handleSave}
              >
                응답 저장
              </Button>
            </div>
          </div>
        </div>
      </Container>

      <div
        className="sticky bottom-0 flex flex-col gap-2 border-t border-hairline-soft bg-surface px-5 pb-4 pt-3 md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        {saved && (
          <span className="inline-flex h-10 items-center gap-2 self-center rounded-full bg-ink px-4 text-sm font-semibold text-white">
            <Check size={16} aria-hidden="true" />
            응답이 저장되었어요.
          </span>
        )}
        <Button
          size="lg"
          fullWidth
          disabled={!dirty || leaving}
          loading={saving || leaving || pendingNav}
          onClick={handleSave}
        >
          응답 저장
        </Button>
        <p className="m-0 text-center text-[13px] text-text-muted">{saveHint}</p>
      </div>

      <Modal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="모든 날짜를 미정으로 변경할까요?"
        description="지금 표시한 가능·불가 날짜가 모두 미정으로 돌아가요."
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setShowResetConfirm(false)}>
            취소
          </Button>
          <Button fullWidth onClick={resetDates}>
            초기화
          </Button>
        </div>
      </Modal>

      <Modal
        open={showNoAvailableConfirm}
        onClose={() => setShowNoAvailableConfirm(false)}
        title="가능한 날짜를 선택하지 않았어요."
        description="이대로 응답을 저장할까요? 모든 날짜가 어렵다는 뜻으로 전달돼요."
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setShowNoAvailableConfirm(false)}>
            계속 선택
          </Button>
          <Button fullWidth loading={saving || leaving} onClick={save}>
            그대로 저장
          </Button>
        </div>
      </Modal>

      <Modal
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title="변경한 내용이 저장되지 않았어요."
        description="나가면 이번에 고른 날짜와 취향이 사라져요."
      >
        <div className="flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => setShowLeaveConfirm(false)}>
            계속 작성
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => router.push(`/trip/${tripId}`)}
          >
            나가기
          </Button>
        </div>
      </Modal>
    </div>
  );
}
