"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useAccount } from "@/components/providers/session-provider";
import type { ReopenScope, TripStatus } from "@/lib/supabase/database.types";

/* 되돌린 경우에는 같은 상태라도 뜻이 다르다 — "그룹 합의가 확정됐어요" 대신
   다시 열렸다고 알려야 한다. */
/** Realtime 이 조용히 비어 있을 때를 위한 보정 주기. */
const BACKSTOP_INTERVAL_MS = 30_000;

const REOPEN_MESSAGE: Record<ReopenScope, string> = {
  stay_vote: "주최자가 숙소 투표를 다시 열었어요.",
  group_direction: "주최자가 날짜·취향 조율을 다시 열었어요.",
};

const STATUS_CHANGE_MESSAGE: Partial<Record<TripStatus, string>> = {
  accommodation_collecting: "그룹 합의가 확정됐어요.",
  accommodation_voting: "숙소 투표가 시작됐어요.",
  vote_result: "투표가 종료되고 결과가 공개됐어요.",
  confirmed: "숙소가 최종 확정됐어요!",
};

/* 이 컴포넌트는 (tabs) 레이아웃에 있어서 탭을 옮겨도 살아남는다. 구독이 화면
   이동마다 다시 만들어지지 않고, 여행 하나당 채널 하나로 유지된다.

   라우터 캐시를 30초로 늘린 만큼, 정말 달라진 것이 있을 때는 바로 무효화해야
   한다. 그래서 단계 변화(trips.status)뿐 아니라 참여자의 응답 상태 변화까지
   본다 — 합의 화면의 "n명 응답"이 남의 화면에서 멈춰 있으면 안 된다.
   그 밖의 변화는 각 화면이 자기 구독으로 부분 갱신한다. */
export function TripRealtimeRefresher({ tripId, currentStatus }: { tripId: string; currentStatus: TripStatus }) {
  const router = useRouter();
  const { showToast } = useToast();
  const statusRef = useRef(currentStatus);
  // 내가 낸 변경은 그 화면이 이미 반영했다. 메아리로 한 번 더 받아오지 않도록
  // 내 id 를 기억해 둔다.
  const { userId } = useAccount();
  const myUserIdRef = useRef(userId);
  useEffect(() => {
    myUserIdRef.current = userId;
  }, [userId]);
  // 짧은 시간에 여러 이벤트가 몰려도 새로고침은 한 번만.
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSoon = useCallback(() => {
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      router.refresh();
    }, 300);
  }, [router]);

  useEffect(() => {
    statusRef.current = currentStatus;
  }, [currentStatus]);

  /* Realtime 은 best-effort 다. 구독이 살아 있는데도 이벤트가 유실되면 이
     화면은 영영 옛날 값을 보여준다. 그래서 보이는 동안에는 30초마다 한 번씩
     조용히 다시 맞춘다 — 라우터 캐시를 30초로 잡아둔 것과 같은 주기라
     체감 비용은 그 수준이고, '영영 멈춤'이 '최대 30초 지연'으로 바뀐다.
     탭을 가려두는 동안에는 돌지 않고, 돌아오는 순간 한 번 맞춘다. */
  useEffect(() => {
    function syncIfVisible() {
      if (document.visibilityState === "visible") refreshSoon();
    }
    const timer = setInterval(syncIfVisible, BACKSTOP_INTERVAL_MS);
    document.addEventListener("visibilitychange", syncIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", syncIfVisible);
    };
  }, [refreshSoon]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let everSubscribed = false;

    function connect() {
      channel = supabase
        .channel(`trip-status-${tripId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
          (payload) => {
            const row = payload.new as {
              status: TripStatus;
              reopened_scope: ReopenScope | null;
              reopened_at: string | null;
            };
            if (row.status !== statusRef.current) {
              const reopened = row.reopened_at ? row.reopened_scope : null;
              const message = reopened
                ? REOPEN_MESSAGE[reopened]
                : STATUS_CHANGE_MESSAGE[row.status];
              if (message) showToast(message);
              refreshSoon();
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "participants", filter: `trip_id=eq.${tripId}` },
          (payload) => {
            const row = payload.new as { user_id?: string };
            if (row?.user_id && row.user_id === myUserIdRef.current) return;
            // 참여자가 늘거나 누군가 응답을 마치면 합의·홈의 숫자가 달라진다.
            // 어떤 칼럼이 바뀌었는지로 거르고 싶지만, Postgres 는 기본적으로
            // 이전 값을 키만 실어 보내서 비교할 수가 없다. 대신 여행 하나에
            // 참여자가 10명뿐이라 이벤트 자체가 드물고, 아래 debounce 가
            // 몰려 오는 것들을 한 번으로 묶는다.
            refreshSoon();
          }
        )
        /* 구독이 조용히 실패하면(네트워크가 잠깐 끊기거나 서버가 바쁠 때)
           이 화면은 영영 갱신되지 않는다. 상태를 받아서 다시 붙고, 다시
           붙었을 때는 끊겨 있던 동안 놓친 변화를 한 번 따라잡는다. */
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            attempts = 0;
            if (everSubscribed) refreshSoon();
            everSubscribed = true;
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            const delay = Math.min(1000 * 2 ** attempts, 15_000);
            attempts += 1;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              if (cancelled) return;
              if (channel) supabase.removeChannel(channel);
              connect();
            }, delay);
          }
        });
    }

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      connect();
    });

    return () => {
      cancelled = true;
      if (pendingRef.current) clearTimeout(pendingRef.current);
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [tripId, refreshSoon, showToast]);

  return null;
}
