/* Photo header with the design's bottom-up scrim. The gradient's top pad
   scales with the cover height (64px on the tall covers, 48px on the 150px
   consensus header, 96px on the 300px final cover), so it is a prop. */
export function CoverImage({
  height,
  scrimTop = 64,
  padX = 20,
  padBottom = 20,
  scrimEnd = 0.72,
  children,
}: {
  height: number;
  scrimTop?: number;
  padX?: number;
  padBottom?: number;
  scrimEnd?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/trip-cover.jpg" alt="" className="h-full w-full object-cover" />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-auto"
        style={{
          padding: `${scrimTop}px ${padX}px ${padBottom}px`,
          background: `linear-gradient(180deg, rgba(20,20,20,0) 0%, rgba(20,20,20,${scrimEnd}) 100%)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
