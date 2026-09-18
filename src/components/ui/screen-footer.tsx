/* Mobile keeps the design's fixed action bar. From 1200px up the bar
   dissolves (§14): no rule, no fill, no full-bleed buttons — the actions
   line up at the bottom right of the content column at natural width. */
export function ScreenFooter({
  sticky,
  className = "",
  children,
}: {
  sticky?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      // the safe-area pad has to be a class, not an inline style, or it would
      // win over desk:pb-12 and leave a short footer on desktop
      className={`mt-auto flex shrink-0 flex-col gap-2 border-t border-hairline-soft bg-surface px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3 desk:mx-auto desk:w-full desk:max-w-[1200px] desk:flex-row desk:flex-wrap desk:items-center desk:justify-end desk:border-0 desk:bg-transparent desk:px-10 desk:pb-12 desk:pt-6 desk:[&_a]:h-11 desk:[&_a]:w-auto desk:[&_button]:h-11 desk:[&_button]:w-auto ${
        sticky ? "sticky bottom-0 desk:static" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* The centred caption under a footer action — inline and right-aligned once
   the footer becomes a row. */
export function FooterNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-center text-xs text-text-muted desk:order-first desk:mr-auto desk:text-left desk:text-[13px]">
      {children}
    </p>
  );
}
