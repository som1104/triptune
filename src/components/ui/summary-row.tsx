import type { LucideIcon } from "lucide-react";

/* The 최종 합의 card on screen 05: a white circular icon chip, a muted
   label on the left and the decided value hard right, each row 44px. */
export function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-primary">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="flex flex-1 items-baseline justify-between gap-3">
        <span className="text-[13px] text-text-muted">{label}</span>
        <span className="text-right text-[15px] font-semibold text-ink">{value}</span>
      </div>
    </div>
  );
}

/* The bordered fact rows on screens 03 and 07 — a tinted icon chip, a
   stacked label/value, inside a card whose rows are split by hairlines. */
export function FactRow({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-hairline-soft px-4 py-2 last:border-b-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13px] text-text-muted">{label}</p>
        <p className="m-0 text-base font-semibold leading-[1.35] text-ink">{value}</p>
        {caption && <p className="m-0 text-[13px] text-ink-soft">{caption}</p>}
      </div>
    </div>
  );
}

/* Label-left / value-right row, no icon (screen 03's trip facts). */
export function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline-soft px-4 py-2 last:border-b-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}
