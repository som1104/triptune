import { TripContentSkeleton } from "@/components/ui/skeleton";

/* 이 loading 은 (tabs) 레이아웃의 children 자리에만 들어간다. 상단 내비와
   하단 탭바는 그대로 남으므로 본문 스켈레톤만 있으면 된다. */
export default function Loading() {
  return <TripContentSkeleton />;
}
