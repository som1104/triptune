/* Single-select chip row. The design uses one chip shape everywhere:
   44px tall, fully rounded, 1px border, weight 600 — selected is a solid
   blue fill. Grid mode (5- or 3-step scales) drops to 12px/14px type with
   4px horizontal padding so the longest Korean label still fits at 390px. */
export function PillSelect<T extends string | number>({
  options,
  value,
  onChange,
  columns,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  columns?: number;
  ariaLabel: string;
}) {
  const dense = (columns ?? 0) >= 4;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={columns ? (dense ? "grid gap-1" : "grid gap-1.5") : "flex flex-wrap gap-2"}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border font-semibold transition-colors duration-[120ms] ${
              columns ? (dense ? "px-1 text-xs" : "px-1 text-sm") : "px-4 text-sm"
            } ${
              selected
                ? "border-primary bg-primary text-on-primary"
                : "border-hairline bg-surface text-ink-soft hover:bg-primary-soft"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
