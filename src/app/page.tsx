"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonSession } from "@/lib/supabase/ensure-session";
import { createTripSchema, type CreateTripInput } from "@/lib/validation/trip";
import { CoverImage } from "@/components/ui/cover-image";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { TextInput } from "@/components/ui/text-input";
import { PillSelect } from "@/components/ui/pill-select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const PARTICIPANT_OPTIONS = Array.from({ length: 9 }, (_, i) => i + 2).map((n) => ({
  value: n,
  label: `${n}명`,
}));

export default function CreateTripPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { nights: 2, expectedParticipantCount: 4 },
  });

  async function onSubmit(values: CreateTripInput) {
    try {
      const supabase = createClient();
      await ensureAnonSession(supabase);

      const { data, error } = await supabase.rpc("create_trip", {
        p_title: values.title,
        p_destination: values.destination,
        p_candidate_start_date: values.candidateStartDate,
        p_candidate_end_date: values.candidateEndDate,
        p_trip_days: values.nights + 1,
        p_expected_participant_count: values.expectedParticipantCount,
        p_host_nickname: values.hostNickname,
      });

      if (error || !data) throw new Error(error?.message ?? "여행을 만들지 못했어요.");

      router.push(`/trip/${data.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "여행을 만들지 못했어요.", "error");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-dvh flex-col">
      <TripAppBar title="TRIPTUNE" />
      <CoverImage height={220}>
        <p className="m-0 mb-1.5 text-xs font-semibold text-white">Welcome</p>
        <h2 className="m-0 text-2xl font-[650] leading-[1.2] text-white">
          함께 가고 싶은
          <br />
          여행을 시작해요.
        </h2>
      </CoverImage>

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">
        <TextInput
          label="여행 이름"
          placeholder="예: 제주, 우리답게"
          error={errors.title?.message}
          {...register("title")}
        />
        <TextInput
          label="목적지"
          placeholder="예: 제주도"
          error={errors.destination?.message}
          {...register("destination")}
        />
        <TextInput
          label="주최자 닉네임"
          placeholder="예: 지원"
          hint="이 이름으로 참여자 목록에 표시돼요."
          error={errors.hostNickname?.message}
          {...register("hostNickname")}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            type="date"
            label="후보 기간 시작일"
            error={errors.candidateStartDate?.message}
            {...register("candidateStartDate")}
          />
          <TextInput
            type="date"
            label="후보 기간 종료일"
            error={errors.candidateEndDate?.message}
            {...register("candidateEndDate")}
          />
        </div>
        <p className="text-xs text-text-muted">
          정확한 날짜는 멤버 응답 후 그룹이 정해요. 후보 기간은 최대 31일까지 설정할 수 있어요.
        </p>

        <Controller
          control={control}
          name="nights"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-ink">여행 기간</p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  aria-label="숙박 일수 줄이기"
                  onClick={() => field.onChange(Math.max(1, (field.value ?? 1) - 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline"
                >
                  <Minus size={18} aria-hidden="true" />
                </button>
                <p className="min-w-24 text-center text-lg font-bold">
                  {field.value ?? 1}박 {(field.value ?? 1) + 1}일
                </p>
                <button
                  type="button"
                  aria-label="숙박 일수 늘리기"
                  onClick={() => field.onChange(Math.min(30, (field.value ?? 1) + 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
              {errors.nights?.message && (
                <p className="text-xs font-medium text-conflict-text">{errors.nights.message}</p>
              )}
            </div>
          )}
        />

        <Controller
          control={control}
          name="expectedParticipantCount"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-ink">예상 인원 (주최자 포함)</p>
              <PillSelect
                ariaLabel="예상 인원"
                options={PARTICIPANT_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            </div>
          )}
        />

        <div className="mt-auto pt-4">
          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            여행 만들기
          </Button>
        </div>
      </div>
    </form>
  );
}
