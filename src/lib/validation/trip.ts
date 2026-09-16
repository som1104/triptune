import { z } from "zod";

const nicknameSchema = z
  .string()
  .trim()
  .min(2, "2~12자로 입력해주세요.")
  .max(12, "2~12자로 입력해주세요.")
  .regex(/[^\s\p{P}]/u, "특수문자만으로는 이름을 만들 수 없어요.");

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
    const start = new Date(data.candidateStartDate);
    const end = new Date(data.candidateEndDate);

    if (!(end > start)) {
      ctx.addIssue({
        code: "custom",
        path: ["candidateEndDate"],
        message: "종료일은 시작일 이후여야 해요.",
      });
      return;
    }

    const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (spanDays > 31) {
      ctx.addIssue({
        code: "custom",
        path: ["candidateEndDate"],
        message: "후보 기간은 최대 31일이에요.",
      });
    }

    const tripDays = data.nights + 1;
    if (tripDays > spanDays) {
      ctx.addIssue({
        code: "custom",
        path: ["nights"],
        message: "여행 기간이 후보 기간보다 길 수 없어요.",
      });
    }
  });

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const joinTripSchema = z.object({
  nickname: nicknameSchema,
});

export type JoinTripInput = z.infer<typeof joinTripSchema>;
