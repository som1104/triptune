export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-hairline-soft ${className}`} aria-hidden="true" />;
}

export function TripScreenSkeleton() {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-label="불러오는 중">
      <div className="flex h-14 shrink-0 items-center px-5">
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="flex flex-col gap-4 px-5 py-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-3/4" />
      </div>
    </div>
  );
}
