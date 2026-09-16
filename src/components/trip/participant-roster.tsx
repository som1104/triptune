"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Participant } from "@/lib/supabase/database.types";
import { RESPONSE_STATUS_LABEL } from "@/lib/trip/format";

export function ParticipantRoster({
  tripId,
  initialParticipants,
  expectedCount,
}: {
  tripId: string;
  initialParticipants: Participant[];
  expectedCount: number;
}) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [syncedInitial, setSyncedInitial] = useState(initialParticipants);
  if (initialParticipants !== syncedInitial) {
    setSyncedInitial(initialParticipants);
    setParticipants(initialParticipants);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`participants-${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          setParticipants((prev) => {
            if (payload.eventType === "INSERT") {
              const next = payload.new as Participant;
              if (prev.some((p) => p.id === next.id)) return prev;
              return [...prev, next].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
            }
            if (payload.eventType === "UPDATE") {
              const next = payload.new as Participant;
              return prev.map((p) => (p.id === next.id ? next : p));
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const pendingSlots = Math.max(expectedCount - participants.length, 0);
  const respondedCount = participants.filter((p) => p.response_status === "submitted").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center justify-between">
        <p className="text-base font-semibold text-ink">참여 현황</p>
        <Badge variant="primary">
          {respondedCount}/{participants.length}명 응답
        </Badge>
      </div>
      <div className="overflow-hidden rounded-2xl border border-hairline-soft">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex min-h-[60px] items-center gap-3 border-b border-hairline-soft px-4 py-2 last:border-b-0"
          >
            <Avatar nickname={p.nickname} seed={p.id} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">{p.nickname}</p>
              <p className="text-xs text-text-muted">{RESPONSE_STATUS_LABEL[p.response_status]}</p>
            </div>
            {p.role === "host" ? (
              <Badge variant="primary">주최자</Badge>
            ) : (
              <Badge variant={p.response_status === "submitted" ? "primary" : "muted"}>
                {RESPONSE_STATUS_LABEL[p.response_status]}
              </Badge>
            )}
          </div>
        ))}
        {Array.from({ length: pendingSlots }).map((_, i) => (
          <div
            key={`pending-${i}`}
            className="flex min-h-[60px] items-center gap-3 border-b border-hairline-soft px-4 py-2 last:border-b-0"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-text-faint text-[13px] font-semibold text-text-faint"
              aria-hidden="true"
            >
              {participants.length + i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-text-muted">아직 참여 전</p>
              <p className="text-xs text-text-faint">링크를 열면 여기에 표시돼요</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
