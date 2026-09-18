import { Check } from "lucide-react";
import type { TripStatus } from "@/lib/supabase/database.types";

/* Where the group is in the decision flow. Colour carries the same meaning
   as everywhere else in the system: blue = settled, ink = where we are now,
   faint = not reached yet. */
const STEPS: { label: string; caption: string }[] = [
  { label: "날짜 · 취향 응답", caption: "각자 가능한 날짜와 취향을 고르는 단계" },
  { label: "그룹 방향 확정", caption: "겹치는 날짜와 공통 취향을 정리해 확정" },
  { label: "숙소 후보 · 투표", caption: "후보를 모으고 한 곳을 함께 고르는 단계" },
  { label: "여행 확정", caption: "날짜와 숙소가 모두 정해진 상태" },
];

const CURRENT_STEP: Record<TripStatus, number> = {
  collecting_responses: 0,
  accommodation_collecting: 2,
  accommodation_voting: 2,
  vote_result: 2,
  confirmed: 4,
};

export function TripStageProgress({ status }: { status: TripStatus }) {
  const current = CURRENT_STEP[status];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline-soft bg-surface p-4">
      <p className="m-0 text-xs font-semibold leading-[1.33] text-text-muted">진행 단계</p>
      <ol className="m-0 flex list-none flex-col gap-0 p-0">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const last = i === STEPS.length - 1;
          return (
            <li key={step.label} className="flex gap-3">
              <div className="flex shrink-0 flex-col items-center">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? "bg-primary text-on-primary"
                      : active
                        ? "border-2 border-primary bg-surface text-primary"
                        : "border border-hairline bg-surface text-text-faint"
                  }`}
                  aria-hidden="true"
                >
                  {done ? <Check size={15} strokeWidth={3} /> : i + 1}
                </span>
                {!last && (
                  <span
                    className={`w-0.5 flex-1 ${done ? "bg-primary" : "bg-hairline"}`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-4"}`}>
                <p
                  className={`m-0 text-[15px] font-semibold ${
                    done || active ? "text-ink" : "text-text-faint"
                  }`}
                >
                  {step.label}
                </p>
                <p className="m-0 text-[13px] text-text-muted">{step.caption}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
