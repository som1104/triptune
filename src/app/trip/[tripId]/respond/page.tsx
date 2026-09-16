import { redirect } from "next/navigation";
import { getTripContext } from "@/lib/trip/get-trip-context";
import { createClient } from "@/lib/supabase/server";
import { TripNotFound } from "@/components/trip/trip-not-found";
import { RespondForm } from "./respond-form";
import { RespondReadOnly } from "@/components/trip/respond-read-only";
import type { DateAvailability } from "@/lib/supabase/database.types";

export default async function RespondPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const ctx = await getTripContext(tripId);
  if (!ctx) return <TripNotFound />;
  if (!ctx.me) {
    redirect(`/trip/${tripId}`);
  }

  const supabase = await createClient();
  const [{ data: dateRows }, { data: prefRow }] = await Promise.all([
    supabase.from("date_responses").select("*").eq("participant_id", ctx.me.id),
    supabase.from("preference_responses").select("*").eq("participant_id", ctx.me.id).maybeSingle(),
  ]);

  const initialDates: Record<string, DateAvailability> = {};
  for (const row of dateRows ?? []) initialDates[row.date] = row.availability;

  const initialPreference = prefRow
    ? {
        nature: prefRow.nature,
        food: prefRow.food,
        cafe: prefRow.cafe,
        activity: prefRow.activity,
        pace: prefRow.pace,
        spending_style: prefRow.spending_style,
      }
    : null;

  if (ctx.trip.status !== "collecting_responses") {
    return (
      <RespondReadOnly
        candidateStartDate={ctx.trip.candidate_start_date}
        candidateEndDate={ctx.trip.candidate_end_date}
        dates={initialDates}
        preference={initialPreference}
      />
    );
  }

  return (
    <RespondForm
      tripId={tripId}
      candidateStartDate={ctx.trip.candidate_start_date}
      candidateEndDate={ctx.trip.candidate_end_date}
      tripDays={ctx.trip.trip_days}
      initialDates={initialDates}
      initialPreference={initialPreference}
    />
  );
}
