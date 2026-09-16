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
      className={columns ? "grid gap-1.5" : "flex flex-wrap gap-2"}
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
            className={`min-h-11 whitespace-nowrap rounded-xl border font-semibold transition-colors ${
              dense ? "px-1 text-xs" : "px-4 text-sm"
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
