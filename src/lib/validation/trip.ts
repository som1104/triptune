import { z } from "zod";

const nicknameSchema = z
  .string()
  .trim()
  .min(2, "2~12자로 입력해주세요.")
  .max(12, "2~12자로 입력해주세요.")
  .regex(/[^\s\p{P}]/u, "특수문자만으로는 이름을 만들 수 없어요.");

/** 오늘(로컬 기준) 자정의 ISO 날짜 — 지난 날짜를 막는 기준점. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 후보 기간의 상한. 월 경계와 무관하게 날짜 수로만 센다. */
export const MAX_CANDIDATE_SPAN_DAYS = 60;

export function candidateSpanDays(startIso: string, endIso: string): number {
  const start = Date.parse(startIso + "T00:00:00");
  const end = Date.parse(endIso + "T00:00:00");
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

export const createTripSchema = z
  .object({
    title: z.string().trim().min(2, "2~30자로 입력해주세요.").max(30, "2~30자로 입력해주세요."),
    destination: z.string().trim().min(2, "2~30자로 입력해주세요.").max(30, "2~30자로 입력해주세요."),
    candidateStartDate: z.string().min(1, "시작일을 선택해주세요."),
    candidateEndDate: z.string().min(1, "종료일을 선택해주세요."),
    nights: z.coerce.number().int().min(1, "1박 이상으로 설정해주세요.").max(30),
    expectedParticipantCount: z.coerce
      .number()
      .int()
      .min(2, "2~10명 사이로 설정해주세요.")
      .max(10, "2~10명 사이로 설정해주세요."),
    hostNickname: nicknameSchema,
  })
  .superRefine((data, ctx) => {
    if (data.candidateStartDate < todayIso()) {
      ctx.addIssue({
        code: "custom",
        path: ["candidateStartDate"],
        message: "지난 날짜는 선택할 수 없어요.",
      });
    }

    if (data.candidateEndDate < data.candidateStartDate) {
      ctx.addIssue({
        code: "custom",
        path: ["candidateEndDate"],
        message: "종료일은 시작일보다 빠를 수 없어요.",
      });
      return;
    }

    const spanDays = candidateSpanDays(data.candidateStartDate, data.candidateEndDate);
    if (spanDays > MAX_CANDIDATE_SPAN_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["candidateEndDate"],
        message: `여행 후보 기간은 최대 ${MAX_CANDIDATE_SPAN_DAYS}일까지 설정할 수 있어요.`,
      });
    }

    // 예정 여행 기간(N박 N+1일)이 후보 기간 안에 한 번은 들어가야 한다.
    const tripDays = data.nights + 1;
    if (tripDays > spanDays) {
      ctx.addIssue({
        code: "custom",
        path: ["nights"],
        message: "여행 기간보다 후보 날짜 범위가 짧아요.",
      });
    }
  });

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const joinTripSchema = z.object({
  nickname: nicknameSchema,
});

export type JoinTripInput = z.infer<typeof joinTripSchema>;
