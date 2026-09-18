import { Suspense } from "react";
import { getMyTrips } from "@/lib/trip/my-trips";
import { MyTripsView } from "@/components/trip/my-trips-view";

/* 내 여행 is the entry screen. It never asks anyone to sign in — the list is
   whatever this browser's session takes part in, guest or not. */
export default async function MyTripsPage() {
  const trips = await getMyTrips();

  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <MyTripsView trips={trips} />
    </Suspense>
  );
}
