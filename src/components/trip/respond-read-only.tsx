import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Badge } from "@/components/ui/badge";
import { getMonthGrid } from "@/lib/trip/calendar";
import type {
  DateAvailability,
  PreferenceResponse,
  SpendingStyle,
  Togetherness,
  TravelPace,
} from "@/lib/supabase/database.types";

const PREFERENCE_FIELDS: { key: "nature" | "food" | "cafe" | "activity"; label: string }[] = [
  { key: "nature", label: "자연" },
  { key: "food", label: "맛집" },
  { key: "cafe", label: "카페" },
  { key: "activity", label: "활동" },
];
const SCORE_LABEL: Record<number, string> = {
  [-2]: "싫어요",
  [-1]: "별로",
  0: "보통",
  1: "좋아요",
  2: "꼭 필요",
};
const PACE_LABEL: Record<TravelPace, string> = {
  relaxed: "여유롭게",
  balanced: "적당히",
  packed: "알차게",
};
const SPENDING_LABEL: Record<SpendingStyle, string> = {
  value: "가성비",
  balanced: "균형 있게",
  experience: "경험 우선",
};
const TOGETHERNESS_LABEL: Record<Togetherness, string> = {
  mostly_together: "대부분 함께",
  core_together: "핵심 일정만 함께",
  free_time: "자유시간 선호",
};

const CELL_BASE =
  "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border p-0";

const CELL_STATE: Record<"none" | DateAvailability, string> = {
  none: "border-transparent bg-primary-soft text-ink-soft",
  available: "border-primary bg-primary text-on-primary",
  unavailable: "border-hairline bg-surface text-text-faint line-through",
  tentative: "border-dashed border-text-muted bg-surface text-ink-soft",
};

const CELL_LABEL: Record<"none" | DateAvailability, string> = {
  none: "",
  available: "가능",
  unavailable: "불가",
  tentative: "미정",
};

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function RespondReadOnly({
  candidateStartDate,
  candidateEndDate,
  dates,
  preference,
}: {
  candidateStartDate: string;
  candidateEndDate: string;
  dates: Record<string, DateAvailability>;
  preference: Pick<
    PreferenceResponse,
    "nature" | "food" | "cafe" | "activity" | "pace" | "spending_style" | "togetherness" | "note"
  > | null;
}) {
  const start = new Date(candidateStartDate + "T00:00:00");
  const grid = getMonthGrid(
    start.getFullYear(),
    start.getMonth(),
    candidateStartDate,
    candidateEndDate
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <TripAppBar title="내 날짜와 취향" back />
      <div className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-4">
        <Badge variant="soft">응답을 수정할 수 없는 단계예요.</Badge>

        <section className="flex flex-col gap-1.5">
          <p className="m-0 text-xl font-[650] text-ink">
            {start.getFullYear()}년 {start.getMonth() + 1}월
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="text-center text-xs font-semibold leading-[1.33] text-text-muted"
              >
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {grid.map((cell) => {
              const state = cell.inCandidateRange ? (dates[cell.iso] ?? "none") : null;
              if (state === null) {
                return (
                  <div
                    key={cell.iso}
                    className={`${CELL_BASE} border-transparent bg-transparent text-text-faint`}
                  >
                    <span className="text-[15px] font-semibold leading-none">
                      {cell.inCurrentMonth ? cell.day : ""}
                    </span>
                  </div>
                );
              }
              return (
                <div key={cell.iso} className={`${CELL_BASE} ${CELL_STATE[state]}`}>
                  <span className="text-[15px] font-semibold leading-none">{cell.day}</span>
                  <span className="text-xs font-[450] leading-none">{CELL_LABEL[state]}</span>
                </div>
              );
            })}
          </div>
        </section>

        {preference && (
          <>
            <section className="flex flex-col gap-2">
              <p className="m-0 text-base font-semibold text-ink">여행 취향</p>
              <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface">
                {PREFERENCE_FIELDS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline-soft px-4 py-2 last:border-b-0"
                  >
                    <span className="text-[15px] font-semibold text-ink">{label}</span>
                    <Badge variant="soft">{SCORE_LABEL[preference[key]]}</Badge>
                  </div>
                ))}
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <p className="m-0 text-base font-semibold text-ink">여행 방식</p>
              <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface">
                <div className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline-soft px-4 py-2">
                  <span className="text-[15px] font-semibold text-ink">일정 속도</span>
                  <Badge variant="soft">{PACE_LABEL[preference.pace]}</Badge>
                </div>
                <div className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline-soft px-4 py-2 last:border-b-0">
                  <span className="text-[15px] font-semibold text-ink">소비 성향</span>
                  <Badge variant="soft">{SPENDING_LABEL[preference.spending_style]}</Badge>
                </div>
                {preference.togetherness && (
                  <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                    <span className="text-[15px] font-semibold text-ink">함께 다니는 정도</span>
                    <Badge variant="soft">{TOGETHERNESS_LABEL[preference.togetherness]}</Badge>
                  </div>
                )}
              </div>
            </section>
            {preference.note && (
              <section className="flex flex-col gap-2">
                <p className="m-0 text-base font-semibold text-ink">꼭 반영할 점</p>
                <div className="rounded-2xl border border-hairline-soft bg-surface px-4 py-3">
                  <p className="m-0 text-[15px] leading-[1.5] text-ink">{preference.note}</p>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
