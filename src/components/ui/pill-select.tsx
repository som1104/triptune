import { Check } from "lucide-react";

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
            className={`inline-flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-full transition-colors ${
              dense ? "px-1 text-xs" : "px-4 text-sm"
            } ${
              selected
                ? "border-2 border-primary bg-primary font-bold text-on-primary"
                : "border border-hairline bg-surface font-medium text-ink-soft hover:bg-primary-soft"
            }`}
          >
            {!dense && selected && <Check size={14} aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
