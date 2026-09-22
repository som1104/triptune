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

// ============================================================
// 수용 인원 검증 — 등록 시트와 카드가 같은 규칙을 쓰도록 여기로 모았다.
// ============================================================

export interface CapacityCheck {
  /** 확정 인원보다 몇 명 부족한지. 확정 인원을 모르면 0. */
  shortBy: number;
  /** 저장해도 되는 예약안인지 (인원이 0이면 아직 미완성이라 false). */
  ok: boolean;
}

export function capacityCheck(
  capacity: number,
  confirmedParticipantCount: number | null
): CapacityCheck {
  const shortBy = confirmedParticipantCount ? Math.max(confirmedParticipantCount - capacity, 0) : 0;
  return { shortBy, ok: shortBy === 0 && capacity > 0 };
}

// ============================================================
// 투표 집계 — 동점과 미투표자를 같은 규칙으로 다룬다.
// ============================================================

export interface VoteTally<T extends { id: string }> {
  /** 유효 투표 수 (한 사람당 한 표). */
  validVotes: number;
  /** 후보 id -> 득표 수. 0표 후보는 키가 없다. */
  counts: Map<string, number>;
  /** 득표 내림차순. 0표뿐이면 원래 순서가 유지된다. */
  ranked: T[];
  /** 최다 득표 수. 표가 하나도 없으면 0. */
  topCount: number;
  /** 최다 득표 후보들. 표가 없으면 빈 집합. */
  topIds: Set<string>;
  /** 최다 득표가 둘 이상이면 동점. */
  isTie: boolean;
  /** 아직 투표하지 않은 확정 인원 수. 확정 인원을 모르면 0. */
  remainingVoters: number;
}

export function tallyVotes<T extends { id: string }>(
  accommodations: T[],
  votes: { accommodation_id: string }[],
  confirmedParticipantCount: number | null
): VoteTally<T> {
  const validVotes = votes.length;
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.accommodation_id, (counts.get(v.accommodation_id) ?? 0) + 1);

  const topCount = validVotes === 0 ? 0 : Math.max(0, ...accommodations.map((a) => counts.get(a.id) ?? 0));
  const topIds = new Set(
    accommodations.filter((a) => topCount > 0 && (counts.get(a.id) ?? 0) === topCount).map((a) => a.id)
  );

  return {
    validVotes,
    counts,
    ranked: [...accommodations].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)),
    topCount,
    topIds,
    isTie: topIds.size > 1,
    remainingVoters:
      confirmedParticipantCount != null ? Math.max(confirmedParticipantCount - validVotes, 0) : 0,
  };
}

/** 득표율(%) — 투표가 없으면 0. */
export function votePercentage(count: number, validVotes: number): number {
  return validVotes === 0 ? 0 : Math.round((count / validVotes) * 100);
}
