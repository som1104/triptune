import { getTripContext } from "@/lib/trip/get-trip-context";
import { TripNotFound } from "@/components/trip/trip-not-found";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { StageLocked } from "@/components/trip/stage-locked";

export default async function StayPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const ctx = await getTripContext(tripId);
  if (!ctx) return <TripNotFound />;

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="숙소 정하기" />
      <StageLocked message="그룹 합의가 확정되면 숙소 후보를 등록할 수 있어요." />
    </div>
  );
}
