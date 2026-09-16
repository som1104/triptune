import { getTripContext } from "@/lib/trip/get-trip-context";
import { TripNotFound } from "@/components/trip/trip-not-found";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { StageLocked } from "@/components/trip/stage-locked";

export default async function ConsensusPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const ctx = await getTripContext(tripId);
  if (!ctx) return <TripNotFound />;

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="그룹 합의" />
      <StageLocked message="아직 응답이 진행 중이에요. 모두 응답을 마치면 그룹 합의 결과가 여기에 나타나요." />
    </div>
  );
}
