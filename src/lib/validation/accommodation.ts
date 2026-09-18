import { z } from "zod";

const roomTypeSchema = z.object({
  name: z.string().trim().min(1, "객실 이름을 입력해주세요.").max(30, "최대 30자까지 입력할 수 있어요."),
  count: z.coerce.number().int().min(1, "1개 이상으로 입력해주세요."),
  capacityPerRoom: z.coerce.number().int().min(1, "1명 이상으로 입력해주세요."),
  pricePerRoom: z.coerce
    .number()
    .int("정수로 입력해주세요.")
    .positive("0보다 큰 금액을 입력해주세요."),
});

export type RoomTypeInput = z.infer<typeof roomTypeSchema>;

/* 한 후보 = 하나의 숙박 예약안. 공통 정보는 모드와 무관하게 같고, 모드에 따라
   최대 인원·금액을 직접 받거나(whole) 객실 구성에서 계산한다(rooms). */
export const accommodationSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1, "숙소 링크를 입력해주세요.")
      .refine((v) => /^https?:\/\/.+/i.test(v), "올바른 http(s) 링크를 입력해주세요."),
    name: z.string().trim().min(2, "2~50자로 입력해주세요.").max(50, "2~50자로 입력해주세요."),
    imageUrl: z
      .union([z.literal(""), z.string().trim().url("올바른 이미지 주소를 입력해주세요.")])
      .optional(),
    location: z.string().trim().min(1, "위치를 입력해주세요."),
    bookingMode: z.enum(["whole", "rooms"], { message: "숙소 이용 방식을 선택해주세요." }),
    // whole 전용
    totalPrice: z.coerce.number().int("정수로 입력해주세요.").min(0),
    capacity: z.coerce.number().int().min(0),
    // rooms 전용
    rooms: z.array(roomTypeSchema),
    note: z.string().trim().max(200, "최대 200자까지 입력할 수 있어요.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.bookingMode === "whole") {
      if (data.capacity < 1) {
        ctx.addIssue({ code: "custom", path: ["capacity"], message: "1명 이상으로 입력해주세요." });
      }
      if (data.totalPrice < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["totalPrice"],
          message: "0보다 큰 금액을 입력해주세요.",
        });
      }
      return;
    }
    if (data.rooms.length === 0) {
      ctx.addIssue({ code: "custom", path: ["rooms"], message: "객실을 한 종류 이상 추가해주세요." });
    }
  });

export type AccommodationInput = z.infer<typeof accommodationSchema>;
