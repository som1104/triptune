"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/trip/format";
import { parseRooms, roomTotals } from "@/lib/trip/stay";
import type { Accommodation } from "@/lib/supabase/database.types";

/* 객실 목록 그대로. 카드 안에서는 요약 한 줄만 쓰고, 전부 보고 싶을 때
   이걸 편다 — 모바일은 바텀시트, 데스크톱은 중앙 모달(BottomSheet 가 두
   모양을 다 담당한다). */
export function RoomList({ accommodation }: { accommodation: Accommodation }) {
  const rooms = parseRooms(accommodation.rooms);
  const totals = roomTotals(rooms);

  return (
    <div className="flex flex-col gap-3">
      {rooms.map((r, i) => (
        <div
          key={`${r.name}-${i}`}
          className="flex flex-col gap-0.5 border-b border-hairline-soft pb-3 last:border-b-0 last:pb-0"
        >
          <p className="m-0 text-[15px] font-semibold text-ink">{r.name}</p>
          <p className="m-0 text-[13px] text-ink-soft">
            {r.count}개 · 객실당 {r.capacityPerRoom}명
          </p>
          <p className="m-0 text-[13px] text-ink-soft">객실당 {formatPrice(r.pricePerRoom)}</p>
        </div>
      ))}
      <div className="rounded-2xl bg-primary-soft px-4 py-3">
        <p className="m-0 text-[13px] text-ink-soft">
          총 {totals.roomCount}개 객실 · 최대 {accommodation.capacity}명
        </p>
        <p className="m-0 text-[15px] font-[650] text-ink">
          총 {formatPrice(accommodation.total_price)}
        </p>
      </div>
    </div>
  );
}

/** 카드 안에 놓는 "객실 구성 보기" 버튼 + 그 내용. */
export function RoomsDisclosure({
  accommodation,
  className = "",
}: {
  accommodation: Accommodation;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (accommodation.booking_mode !== "rooms") return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={`self-start ${className}`}
        icon={<ChevronDown size={15} aria-hidden="true" />}
        onClick={() => setOpen(true)}
      >
        객실 구성 보기
      </Button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="객실 구성">
        <RoomList accommodation={accommodation} />
      </BottomSheet>
    </>
  );
}
