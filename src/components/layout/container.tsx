/* One container rule for every screen, so page width never shifts between
   routes: full-bleed on mobile, centred with a hard 1200px cap on desktop.
   Gutters follow the board — 20 / 32 / 40. */
export function Container({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1200px] px-5 md:px-8 desk:px-10 ${className}`}>
      {children}
    </div>
  );
}

/* Vertical rhythm for a desktop page body (32 top / 48 bottom on the board),
   kept tighter on mobile where the app bar already provides separation. */
export function PageBody({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Container className={`flex flex-1 flex-col pb-6 pt-4 md:pb-10 md:pt-8 desk:pb-12 ${className}`}>
      {children}
    </Container>
  );
}

/* Page heading used on the wide layouts: 24/650 on mobile, 28/650 desktop. */
export function PageHeading({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h2 className="m-0 mb-1.5 text-2xl font-[650] leading-[1.2] text-ink desk:text-[28px]">
          {title}
        </h2>
        {lead && (
          <p className="m-0 max-w-[68ch] text-[15px] font-[300] leading-[1.43] text-text-muted">
            {lead}
          </p>
        )}
      </div>
      {action && <div className="hidden shrink-0 md:block">{action}</div>}
    </div>
  );
}
