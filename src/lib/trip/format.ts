import type { ResponseStatus, TripStatus } from "@/lib/supabase/database.types";

export function formatDateKo(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function formatShortDateKo(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
}

export function formatMonthKo(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export function formatTripLength(tripDays: number): string {
  const nights = Math.max(tripDays - 1, 0);
  return `${nights}박 ${tripDays}일`;
}

/** "10월 17일–19일" — the compact range used on the 내 여행 cards. */
export function formatDateRangeKo(startIso: string, endIso: string): string {
  const s = new Date(startIso + "T00:00:00");
  const e = new Date(endIso + "T00:00:00");
  const head = `${s.getMonth() + 1}월 ${s.getDate()}일`;
  return s.getMonth() === e.getMonth()
    ? `${head}–${e.getDate()}일`
    : `${head}–${e.getMonth() + 1}월 ${e.getDate()}일`;
}

/** "10월 중" — for trips whose dates the group has not settled yet. */
export function formatMonthHintKo(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}월 중`;
}

export function formatPrice(won: number): string {
  return `${won.toLocaleString("ko-KR")}원`;
}

export function perPersonPrice(totalPrice: number, participantCount: number): number {
  return Math.ceil(totalPrice / participantCount);
}

export const RESPONSE_STATUS_LABEL: Record<ResponseStatus, string> = {
  not_started: "응답 전",
  in_progress: "작성 중",
  submitted: "응답 완료",
};

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  collecting_responses: "날짜·취향 응답 수집 중",
  accommodation_collecting: "숙소 후보 등록 중",
  accommodation_voting: "숙소 투표 중",
  vote_result: "투표 결과 공개",
  confirmed: "여행 확정 완료",
};
