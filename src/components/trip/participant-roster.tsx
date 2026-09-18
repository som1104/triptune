"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Participant, ResponseStatus } from "@/lib/supabase/database.types";

/* Screen 02 spells out what each row's subtitle says, so the wording here
   follows the design rather than the generic status labels used elsewhere. */
const ROW_SUBTITLE: Record<ResponseStatus, string> = {
  submitted: "날짜 · 취향 응답 완료",
  in_progress: "응답 작성 중",
  not_started: "아직 응답 전",
};

function StatusBadge({ status }: { status: ResponseStatus }) {
  if (status === "submitted") return <Badge variant="primary">완료</Badge>;
  if (status === "in_progress") return <Badge variant="conflict">응답 중</Badge>;
  return <Badge variant="outline">응답 전</Badge>;
}

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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Postgres Changes authorization is enforced per-message using the JWT
    // attached to the realtime socket. That attachment happens async after
    // sign-in, so subscribing before the session loads leaves the channel
    // reporting SUBSCRIBED while RLS silently drops every event. Awaiting
    // the session first guarantees the socket is authenticated before we
    // start listening.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
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
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [tripId]);

  const pendingSlots = Math.max(expectedCount - participants.length, 0);
  const respondedCount = participants.filter((p) => p.response_status === "submitted").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center justify-between">
        <p className="m-0 text-base font-semibold text-ink">참여 현황</p>
        <Badge variant="primary">
          {respondedCount}/{participants.length}명 응답
        </Badge>
      </div>
      <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface md:max-h-[320px] md:overflow-y-auto">
        {participants.map((p, i) => (
          <div
            key={p.id}
            className="flex min-h-[60px] items-center gap-3 border-b border-hairline-soft px-4 py-2 last:border-b-0"
          >
            <Avatar nickname={p.nickname} seed={p.id} colorIndex={i} />
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[15px] font-semibold text-ink">{p.nickname}</p>
              <p className="m-0 text-xs text-text-muted">{ROW_SUBTITLE[p.response_status]}</p>
            </div>
            {p.role === "host" ? (
              <Badge variant="soft">주최자</Badge>
            ) : (
              <StatusBadge status={p.response_status} />
            )}
          </div>
        ))}
        {Array.from({ length: pendingSlots }).map((_, i) => (
          <div
            key={`pending-${i}`}
            className="flex min-h-[60px] items-center gap-3 border-b border-hairline-soft px-4 py-2 last:border-b-0"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-text-faint bg-surface text-[13px] font-semibold text-text-faint"
              aria-hidden="true"
            >
              {participants.length + i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[15px] font-semibold text-text-muted">아직 참여 전</p>
              <p className="m-0 text-xs text-text-faint">링크를 열면 여기에 표시돼요</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
