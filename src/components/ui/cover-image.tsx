export function CoverImage({
  height,
  children,
}: {
  height: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/trip-cover-placeholder.svg"
        alt=""
        className="h-full w-full object-cover"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-auto"
        style={{
          padding: "64px 20px 20px",
          background: "linear-gradient(180deg, rgba(20,20,20,0) 0%, rgba(20,20,20,.72) 100%)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
