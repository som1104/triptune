"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonSession } from "@/lib/supabase/ensure-session";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { getMonthGrid } from "@/lib/trip/calendar";
import { formatTripLength } from "@/lib/trip/format";
import type {
  DateAvailability,
  PreferenceResponse,
  SpendingStyle,
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

function nextAvailability(current: DateAvailability | undefined): DateAvailability {
  if (current === undefined) return "tentative";
  if (current === "tentative") return "available";
  if (current === "available") return "unavailable";
  return "tentative";
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

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
    "nature" | "food" | "cafe" | "activity" | "pace" | "spending_style"
  > | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [dates, setDates] = useState(initialDates);
  const [nature, setNature] = useState<number | undefined>(initialPreference?.nature);
  const [food, setFood] = useState<number | undefined>(initialPreference?.food);
  const [cafe, setCafe] = useState<number | undefined>(initialPreference?.cafe);
  const [activity, setActivity] = useState<number | undefined>(initialPreference?.activity);
  const [pace, setPace] = useState<TravelPace | undefined>(initialPreference?.pace);
  const [spendingStyle, setSpendingStyle] = useState<SpendingStyle | undefined>(
    initialPreference?.spending_style
  );

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [markedInProgress, setMarkedInProgress] = useState(false);

  const start = new Date(candidateStartDate + "T00:00:00");
  const [monthCursor, setMonthCursor] = useState(new Date(start.getFullYear(), start.getMonth(), 1));

  const grid = useMemo(
    () =>
      getMonthGrid(
        monthCursor.getFullYear(),
        monthCursor.getMonth(),
        candidateStartDate,
        candidateEndDate
      ),
    [monthCursor, candidateStartDate, candidateEndDate]
  );

  const minMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const endDate = new Date(candidateEndDate + "T00:00:00");
  const maxMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

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
    if (!markedInProgress) {
      setMarkedInProgress(true);
      const supabase = createClient();
      supabase.rpc("mark_response_in_progress", { p_trip_id: tripId }).then(() => {});
    }
  }

  function toggleDate(iso: string) {
    setDates((prev) => ({ ...prev, [iso]: nextAvailability(prev[iso]) }));
    markDirty();
  }

  const canSave =
    Object.keys(dates).length > 0 &&
    nature !== undefined &&
    food !== undefined &&
    cafe !== undefined &&
    activity !== undefined &&
    pace !== undefined &&
    spendingStyle !== undefined;

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await ensureAnonSession(supabase);

      const { error } = await supabase.rpc("save_my_response", {
        p_trip_id: tripId,
        p_dates: Object.entries(dates).map(([date, availability]) => ({ date, availability })),
        p_nature: nature!,
        p_food: food!,
        p_cafe: cafe!,
        p_activity: activity!,
        p_pace: pace!,
        p_spending_style: spendingStyle!,
      });
      if (error) throw new Error(error.message);

      setDirty(false);
      showToast("응답이 저장되었어요.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "저장하지 못했어요.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (dirty) {
      setShowLeaveConfirm(true);
      return;
    }
    router.push(`/trip/${tripId}`);
  }

  const saveHint = canSave
    ? dirty
      ? "저장하지 않은 변경 사항이 있어요."
      : "모든 응답이 저장됐어요."
    : "날짜와 취향 항목을 모두 선택하면 저장할 수 있어요.";

  return (
    <div className="flex min-h-dvh flex-col">
      <TripAppBar title="내 날짜와 취향" back onBack={handleBack} />

      <div className="flex flex-1 flex-col gap-5 px-5 py-4">
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="이전 달"
                disabled={monthCursor <= minMonth}
                onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink disabled:opacity-30"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <p className="text-xl font-bold">
                {monthCursor.getFullYear()}년 {monthCursor.getMonth() + 1}월
              </p>
              <button
                type="button"
                aria-label="다음 달"
                disabled={monthCursor >= maxMonth}
                onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink disabled:opacity-30"
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
            <span className="inline-flex h-6 items-center rounded-full bg-primary-soft px-2.5 text-xs font-semibold text-ink-soft">
              {formatTripLength(tripDays)}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-center text-xs font-semibold text-text-muted">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {grid.map((cell) => {
              if (!cell.inCandidateRange) {
                return (
                  <div
                    key={cell.iso}
                    className="flex aspect-square items-center justify-center text-sm text-text-faint opacity-40"
                  >
                    {cell.inCurrentMonth ? cell.day : ""}
                  </div>
                );
              }
              const availability = dates[cell.iso];
              const stateClass =
                availability === "available"
                  ? "border-primary bg-primary text-on-primary"
                  : availability === "tentative"
                    ? "border-dashed border-text-muted text-text-muted bg-surface"
                    : availability === "unavailable"
                      ? "border-hairline bg-hairline-soft text-text-faint"
                      : "border-hairline bg-surface text-ink-soft";
              const stateLabel =
                availability === "available"
                  ? "가능"
                  : availability === "tentative"
                    ? "미정"
                    : availability === "unavailable"
                      ? "불가"
                      : "선택 안 함";
              return (
                <button
                  key={cell.iso}
                  type="button"
                  aria-label={`${cell.day}일, ${stateLabel}`}
                  onClick={() => toggleDate(cell.iso)}
                  className={`flex aspect-square min-h-11 items-center justify-center rounded-xl border text-[15px] font-semibold ${stateClass}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 pt-1 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-primary" />
              가능
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full border border-dashed border-text-muted" />
              미정
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full border border-hairline" />
              불가
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-ink">여행 취향</p>
            <span className="text-xs text-text-muted">항목마다 하나씩 선택</span>
          </div>
          {PREFERENCE_FIELDS.map(({ key, label }) => {
            const value = { nature, food, cafe, activity }[key];
            const setValue = { nature: setNature, food: setFood, cafe: setCafe, activity: setActivity }[
              key
            ];
            return (
              <div key={key} className="flex flex-col gap-2">
                <p className="text-[15px] font-semibold text-ink">{label}</p>
                <PillSelect
                  ariaLabel={label}
                  columns={5}
                  options={PREFERENCE_OPTIONS}
                  value={value}
                  onChange={(v) => {
                    setValue(v);
                    markDirty();
                  }}
                />
              </div>
            );
          })}
        </section>

        <section className="flex flex-col gap-4">
          <p className="text-base font-semibold text-ink">여행 방식</p>
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-semibold text-ink">일정 속도</p>
            <PillSelect
              ariaLabel="일정 속도"
              columns={3}
              options={PACE_OPTIONS}
              value={pace}
              onChange={(v) => {
                setPace(v);
                markDirty();
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-semibold text-ink">소비 성향</p>
            <PillSelect
              ariaLabel="소비 성향"
              columns={3}
              options={SPENDING_OPTIONS}
              value={spendingStyle}
              onChange={(v) => {
                setSpendingStyle(v);
                markDirty();
              }}
            />
          </div>
        </section>
      </div>

      <div
        className="sticky bottom-0 flex flex-col gap-2 border-t border-hairline-soft bg-surface px-5 pb-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <Button size="lg" fullWidth disabled={!canSave || !dirty} loading={saving} onClick={handleSave}>
          응답 저장
        </Button>
        <p className="text-center text-[13px] text-text-muted">{saveHint}</p>
      </div>

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
