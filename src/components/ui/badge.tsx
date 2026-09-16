type Variant = "neutral" | "primary" | "conflict" | "muted";

const variantClasses: Record<Variant, string> = {
  neutral: "bg-surface border border-hairline text-ink-soft",
  primary: "bg-primary-soft text-ink-soft",
  conflict: "bg-conflict-bg border border-conflict-border text-conflict-text",
  muted: "bg-hairline-soft text-text-muted",
};

export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: Variant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
