import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Badge } from "@/components/ui/badge";
import { getMonthGrid } from "@/lib/trip/calendar";
import type {
  DateAvailability,
  PreferenceResponse,
  SpendingStyle,
  TravelPace,
} from "@/lib/supabase/database.types";

const PREFERENCE_FIELDS: { key: "nature" | "food" | "cafe" | "activity"; label: string }[] = [
  { key: "nature", label: "자연" },
  { key: "food", label: "맛집" },
  { key: "cafe", label: "카페" },
  { key: "activity", label: "활동" },
];
const SCORE_LABEL: Record<number, string> = { [-2]: "싫어요", [-1]: "별로", 0: "보통", 1: "좋아요", 2: "꼭 필요" };
const PACE_LABEL: Record<TravelPace, string> = { relaxed: "여유롭게", balanced: "적당히", packed: "알차게" };
const SPENDING_LABEL: Record<SpendingStyle, string> = {
  value: "가성비",
  balanced: "균형 있게",
  experience: "경험 우선",
};

const STATE_CLASS: Record<DateAvailability, string> = {
  available: "border-primary bg-primary text-on-primary",
  tentative: "border-dashed border-text-muted text-text-muted bg-surface",
  unavailable: "border-hairline bg-hairline-soft text-text-faint",
};

export function RespondReadOnly({
  candidateStartDate,
  candidateEndDate,
  dates,
  preference,
}: {
  candidateStartDate: string;
  candidateEndDate: string;
  dates: Record<string, DateAvailability>;
  preference: Pick<PreferenceResponse, "nature" | "food" | "cafe" | "activity" | "pace" | "spending_style"> | null;
}) {
  const start = new Date(candidateStartDate + "T00:00:00");
  const grid = getMonthGrid(start.getFullYear(), start.getMonth(), candidateStartDate, candidateEndDate);

  return (
    <div className="flex min-h-dvh flex-col">
      <TripAppBar title="내 날짜와 취향" back />
      <div className="flex flex-1 flex-col gap-6 px-5 py-4">
        <Badge variant="muted">응답을 수정할 수 없는 단계예요.</Badge>

        <section className="flex flex-col gap-2">
          <p className="text-xl font-bold text-ink">
            {start.getFullYear()}년 {start.getMonth() + 1}월
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {grid.map((cell) =>
              cell.inCandidateRange ? (
                <div
                  key={cell.iso}
                  className={`flex aspect-square items-center justify-center rounded-xl border text-[15px] font-semibold ${
                    STATE_CLASS[dates[cell.iso] ?? "unavailable"]
                  }`}
                >
                  {cell.day}
                </div>
              ) : (
                <div key={cell.iso} className="flex aspect-square items-center justify-center text-sm text-text-faint opacity-40">
                  {cell.inCurrentMonth ? cell.day : ""}
                </div>
              )
            )}
          </div>
        </section>

        {preference && (
          <>
            <section className="flex flex-col gap-3">
              <p className="text-base font-semibold text-ink">여행 취향</p>
              {PREFERENCE_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-hairline-soft px-4 py-3">
                  <span className="text-[15px] font-semibold text-ink">{label}</span>
                  <Badge variant="primary">{SCORE_LABEL[preference[key]]}</Badge>
                </div>
              ))}
            </section>
            <section className="flex flex-col gap-3">
              <p className="text-base font-semibold text-ink">여행 방식</p>
              <div className="flex items-center justify-between rounded-xl border border-hairline-soft px-4 py-3">
                <span className="text-[15px] font-semibold text-ink">일정 속도</span>
                <Badge variant="primary">{PACE_LABEL[preference.pace]}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-hairline-soft px-4 py-3">
                <span className="text-[15px] font-semibold text-ink">소비 성향</span>
                <Badge variant="primary">{SPENDING_LABEL[preference.spending_style]}</Badge>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
