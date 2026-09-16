"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import type { TripStatus } from "@/lib/supabase/database.types";

const STATUS_CHANGE_MESSAGE: Partial<Record<TripStatus, string>> = {
  accommodation_collecting: "그룹 합의가 확정됐어요.",
  accommodation_voting: "숙소 투표가 시작됐어요.",
  vote_result: "투표가 종료되고 결과가 공개됐어요.",
  confirmed: "숙소가 최종 확정됐어요!",
};

/** Refreshes the current route whenever this trip's status changes elsewhere. */
export function TripRealtimeRefresher({ tripId, currentStatus }: { tripId: string; currentStatus: TripStatus }) {
  const router = useRouter();
  const { showToast } = useToast();
  const statusRef = useRef(currentStatus);

  useEffect(() => {
    statusRef.current = currentStatus;
  }, [currentStatus]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`trip-status-${tripId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
          (payload) => {
            const next = (payload.new as { status: TripStatus }).status;
            if (next !== statusRef.current) {
              const message = STATUS_CHANGE_MESSAGE[next];
              if (message) showToast(message);
              router.refresh();
            }
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [tripId, router, showToast]);

  return null;
}
