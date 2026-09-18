"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LogOut, MoreHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDateRangeKo, formatMonthHintKo, TRIP_STATUS_LABEL } from "@/lib/trip/format";
import type { MyTrip } from "@/lib/trip/my-trips";

/* One card shape at every width — the grid around it changes, the card does
   not. flex-col + mt-auto keeps the footer row on the baseline so a 3-up row
   of cards stays even however long the titles are.

   The whole card is one link, laid over the content as an overlay rather
   than wrapped around it, so the ⋯ menu can sit on top without nesting a
   button inside an anchor. */
export function TripListCard({
  item,
  onRemove,
}: {
  item: MyTrip;
  /** opens the host's 삭제 / the participant's 나가기 confirmation */
  onRemove?: (item: MyTrip) => void;
}) {
  const { trip, memberCount, nextAction, isHost, members } = item;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  // The menu floats over a card that is itself a link, so a stray click or
  // Esc has to close it rather than fall through and navigate.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const confirmed = trip.status === "confirmed";
  const dateText =
    trip.confirmed_start_date && trip.confirmed_end_date
      ? formatDateRangeKo(trip.confirmed_start_date, trip.confirmed_end_date)
      : formatMonthHintKo(trip.candidate_start_date);

  return (
    <div
      ref={wrapRef}
      className={`relative flex flex-col overflow-hidden rounded-2xl bg-surface transition-colors hover:border-primary ${
        confirmed ? "border-2 border-primary" : "border border-hairline-soft"
      }`}
    >
      <div className="h-40 w-full shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/trip-cover.jpg" alt="" className="h-full w-full object-cover" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="m-0 min-w-0 truncate text-[18px] font-[650] text-ink">{trip.title}</p>
          <Badge variant={confirmed ? "primary" : "soft"}>{TRIP_STATUS_LABEL[trip.status]}</Badge>
        </div>

        <p className="m-0 text-sm text-ink-soft">
          {trip.destination} · {dateText}
        </p>
        <p className="m-0 text-[13px] text-text-muted">{nextAction}</p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="flex items-center gap-2">
            <span className="flex">
              {members.slice(0, 4).map((m, i) => (
                <span key={m.id} className={i > 0 ? "-ml-2" : ""}>
                  <Avatar nickname={m.nickname} seed={m.id} colorIndex={i} size="sm" ringed />
                </span>
              ))}
            </span>
            <span className="text-[13px] text-text-muted">{memberCount}명</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            {confirmed ? "여행 보기" : "이어하기"}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </div>

        {isHost && <span className="sr-only">주최자</span>}
      </div>

      <Link
        href={`/trip/${trip.id}`}
        aria-label={`${trip.title} ${confirmed ? "여행 보기" : "이어하기"}`}
        className="absolute inset-0 rounded-2xl"
      />

      {onRemove && (
        <div className="absolute right-2 top-2 z-10">
          <button
            type="button"
            aria-label={`${trip.title} 메뉴`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-ink backdrop-blur-sm hover:bg-surface"
          >
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 top-12 w-40 overflow-hidden rounded-2xl border border-hairline bg-surface"
            >
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRemove(item);
                }}
                className="flex min-h-11 w-full items-center gap-2 px-4 text-sm text-conflict-text hover:bg-conflict-bg"
              >
                {isHost ? (
                  <>
                    <Trash2 size={15} aria-hidden="true" /> 여행 삭제
                  </>
                ) : (
                  <>
                    <LogOut size={15} aria-hidden="true" /> 여행 나가기
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
