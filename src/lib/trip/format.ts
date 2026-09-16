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
