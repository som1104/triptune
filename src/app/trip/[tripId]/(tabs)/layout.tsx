import { TripTabBar } from "@/components/layout/trip-tab-bar";

export default async function TripTabsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <TripTabBar tripId={tripId} />
    </div>
  );
}
