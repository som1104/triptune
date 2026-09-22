import { RUN_ID } from "./env";

/** 이 실행이 만든 여행에만 붙는 접두사. 정리할 때 이 접두사로만 지운다. */
export const TITLE_PREFIX = `[E2E-${RUN_ID}]`;

/** "[E2E-ab12cd] 합의" — 여행 이름은 30자 제한이라 짧게 유지한다. */
export function tripTitle(name: string): string {
  const title = `${TITLE_PREFIX} ${name}`;
  if (title.length > 30) throw new Error(`여행 이름이 30자를 넘습니다: ${title}`);
  return title;
}

/** 병렬 실행에서도 겹치지 않는 닉네임 (2~12자). */
export function nickname(base: string): string {
  const name = `${base}${RUN_ID.slice(0, 3)}`;
  if (name.length > 12) throw new Error(`닉네임이 12자를 넘습니다: ${name}`);
  return name;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface CandidateRange {
  start: string;
  end: string;
  /** 후보 기간 안의 1-based 날짜 목록 (달력 칸의 '일' 숫자). */
  days: number[];
}

/**
 * 후보 기간은 "다다음 달 1일"부터 시작한다.
 * - 언제 실행해도 반드시 미래다 (오늘이 말일이어도 최소 한 달 이상 남는다)
 * - 항상 한 달 안에 들어가므로 달력이 한 장만 뜨고, 날짜 칸이 중복되지 않는다
 * - 실행 시점이 아니라 규칙으로 정해지므로 "어제는 통과했는데" 가 생기지 않는다
 */
export function candidateRange(spanDays = 10, now: Date = new Date()): CandidateRange {
  if (spanDays < 1 || spanDays > 28) throw new Error("spanDays 는 1~28 사이여야 합니다.");
  const start = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const end = new Date(start.getFullYear(), start.getMonth(), spanDays);
  return {
    start: iso(start),
    end: iso(end),
    days: Array.from({ length: spanDays }, (_, i) => i + 1),
  };
}
