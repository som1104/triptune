import { TripTabBar } from "@/components/layout/trip-tab-bar";
import { TripRealtimeRefresher } from "@/components/trip/trip-realtime-refresher";
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

  return (
    <div className="flex min-h-dvh flex-col">
      {ctx && <TripRealtimeRefresher tripId={tripId} currentStatus={ctx.trip.status} />}
      <div className="flex flex-1 flex-col">{children}</div>
      <TripTabBar tripId={tripId} />
    </div>
  );
}
