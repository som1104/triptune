export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-hairline-soft ${className}`} aria-hidden="true" />;
}

/* 공통 앱바와 탭은 레이아웃이 이미 그려둔 채로 남아 있다. 그 아래 본문만
   비어 있어야 하는데, 화면 전체를 대체하면 껍데기가 두 겹으로 보이고 매번
   화면이 통째로 깜빡이는 것처럼 느껴진다. 그래서 본문 전용을 따로 둔다.
   카드 모서리와 간격은 실제 화면과 같은 값을 쓴다. */
export function TripContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-label="불러오는 중">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-5 py-5 md:px-8 desk:px-10">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/* 자체 앱바를 그리는 화면(참여, 날짜·취향 입력)용 — 앱바 자리까지 포함한다. */
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
