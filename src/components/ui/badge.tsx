/* The design fixes colour to exactly three meanings, so the variants here are
   named after the meaning, not the colour:
     primary  — the group agreed on this (design system Badge variant="popular")
     soft     — neutral context chip (#eef1ff fill, no border)
     conflict — people disagree (coral tint + coral border)
     outline  — a plain label on a white ground
     muted    — ruled out
     overlay  — sits on top of a photo */
type Variant = "primary" | "soft" | "conflict" | "outline" | "muted" | "overlay";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary px-2 text-on-primary",
  soft: "bg-primary-soft px-2.5 text-ink-soft",
  conflict: "border border-conflict-pill-border bg-conflict-pill-bg px-2.5 text-conflict-text",
  outline: "border border-hairline bg-surface px-2.5 text-ink-soft",
  muted: "border border-hairline bg-surface px-2.5 text-text-faint line-through",
  overlay: "bg-scrim px-2.5 text-white backdrop-blur-[2px]",
};

export function Badge({
  variant = "primary",
  className = "",
  children,
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full text-xs font-semibold leading-[1.33] ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
