import { formatPrice, perPersonPrice } from "@/lib/trip/format";
import type { Accommodation, StayBookingMode } from "@/lib/supabase/database.types";

/** 한 객실 유형. 금액은 언제나 '객실 1개의 전체 여행 기간' 금액이다. */
export interface RoomType {
  name: string;
  count: number;
  capacityPerRoom: number;
  pricePerRoom: number;
}

export const BOOKING_MODE_LABEL: Record<StayBookingMode, string> = {
  whole: "숙소 전체 사용",
  rooms: "객실 여러 개",
};

/* rooms 는 jsonb 라 무엇이든 들어올 수 있다. 화면이 깨지는 대신 못 읽는 항목은
   버리고, 읽은 것만으로 계산한다. */
export function parseRooms(value: unknown): RoomType[] {
  if (!Array.isArray(value)) return [];
  const out: RoomType[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const count = Number(r.count);
    const capacityPerRoom = Number(r.capacityPerRoom);
    const pricePerRoom = Number(r.pricePerRoom);
    if (!name || !Number.isFinite(count) || count < 1) continue;
    if (!Number.isFinite(capacityPerRoom) || capacityPerRoom < 1) continue;
    if (!Number.isFinite(pricePerRoom) || pricePerRoom < 1) continue;
    out.push({ name, count, capacityPerRoom, pricePerRoom });
  }
  return out;
}

export interface RoomTotals {
  roomCount: number;
  capacity: number;
  totalPrice: number;
}

export function roomTotals(rooms: RoomType[]): RoomTotals {
  return rooms.reduce<RoomTotals>(
    (acc, r) => ({
      roomCount: acc.roomCount + r.count,
      capacity: acc.capacity + r.count * r.capacityPerRoom,
      totalPrice: acc.totalPrice + r.count * r.pricePerRoom,
    }),
    { roomCount: 0, capacity: 0, totalPrice: 0 }
  );
}

/** 카드 한 줄짜리 구성 요약: "디럭스 트윈 2개 외 1종" */
export function roomsSummaryLine(rooms: RoomType[]): string {
  if (rooms.length === 0) return "";
  const [first, ...rest] = rooms;
  const head = `${first.name} ${first.count}개`;
  return rest.length === 0 ? head : `${head} 외 ${rest.length}종`;
}

/** 이용 방식을 한 줄로: "숙소 전체 사용 · 최대 6명" / "객실 3개 · 최대 8명" */
export function bookingLine(a: Pick<Accommodation, "booking_mode" | "capacity" | "rooms">): string {
  if (a.booking_mode === "rooms") {
    const { roomCount } = roomTotals(parseRooms(a.rooms));
    return `객실 ${roomCount}개 · 최대 ${a.capacity}명`;
  }
  return `${BOOKING_MODE_LABEL.whole} · 최대 ${a.capacity}명`;
}

/** "총 840,000원 · 1인 약 140,000원" — 확정 인원을 모르면 총액만. */
export function priceLine(totalPrice: number, confirmedParticipantCount: number | null): string {
  const total = `총 ${formatPrice(totalPrice)}`;
  if (!confirmedParticipantCount) return total;
  return `${total} · 1인 약 ${formatPrice(perPersonPrice(totalPrice, confirmedParticipantCount))}`;
}
