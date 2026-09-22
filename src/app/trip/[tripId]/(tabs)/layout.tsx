import { TripTabBar } from "@/components/layout/trip-tab-bar";
import { TripTopNav } from "@/components/layout/trip-top-nav";
import { TripRealtimeRefresher } from "@/components/trip/trip-realtime-refresher";
import { ParticipantColors } from "@/components/ui/avatar";
import { ReopenNotice } from "@/components/trip/reopen-notice";
import { getTripContext } from "@/lib/trip/get-trip-context";

export default async function TripTabsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const ctx = await getTripContext(tripId);

  // 참여 순서가 곧 좌석 번호다. 여기서 한 번 공개해두면 숙소 카드나 투표
  // 명단처럼 참여자 id 만 아는 화면도 같은 색을 쓴다.
  return (
    <ParticipantColors participants={ctx?.participants ?? []}>
      <div className="flex min-h-dvh flex-col">
        {ctx && <TripRealtimeRefresher tripId={tripId} currentStatus={ctx.trip.status} />}
        <TripTopNav tripId={tripId} />
        {ctx && <ReopenNotice trip={ctx.trip} participants={ctx.participants} />}
        <div className="flex flex-1 flex-col">{children}</div>
        <TripTabBar tripId={tripId} />
      </div>
    </ParticipantColors>
  );
}
