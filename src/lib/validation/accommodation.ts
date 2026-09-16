import { z } from "zod";

export const accommodationSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "숙소 링크를 입력해주세요.")
    .refine((v) => /^https?:\/\/.+/i.test(v), "올바른 http(s) 링크를 입력해주세요."),
  name: z.string().trim().min(2, "2~50자로 입력해주세요.").max(50, "2~50자로 입력해주세요."),
  imageUrl: z.union([z.literal(""), z.string().trim().url("올바른 이미지 주소를 입력해주세요.")]).optional(),
  location: z.string().trim().min(1, "위치를 입력해주세요."),
  totalPrice: z.coerce.number().int("정수로 입력해주세요.").positive("0보다 큰 금액을 입력해주세요."),
  capacity: z.coerce.number().int().min(1, "1명 이상으로 입력해주세요."),
  note: z.string().trim().max(200, "최대 200자까지 입력할 수 있어요.").optional(),
});

export type AccommodationInput = z.infer<typeof accommodationSchema>;
