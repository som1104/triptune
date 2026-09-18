/* "막대 색이 곧 합의 강도. 75% 이상만 블루." — the design system board.
   ≥75% reads as agreed (blue), 40–74% as merely the majority (ink),
   under 40% as ruled out (faint). `tone` overrides the rule for the vote
   screens, where colour marks the winner rather than the strength. */
export type BarTone = "primary" | "ink" | "faint";

export function toneForPercent(percent: number): BarTone {
  if (percent >= 75) return "primary";
  if (percent >= 40) return "ink";
  return "faint";
}

const TONE_CLASS: Record<BarTone, string> = {
  primary: "bg-primary",
  ink: "bg-ink",
  faint: "bg-text-faint",
};

export function ConsensusBar({ percent, tone }: { percent: number; tone?: BarTone }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-hairline-soft">
      <div
        className={`h-full rounded-full ${TONE_CLASS[tone ?? toneForPercent(clamped)]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
