"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonSession } from "@/lib/supabase/ensure-session";
import {
  candidateSpanDays,
  createTripSchema,
  MAX_CANDIDATE_SPAN_DAYS,
  type CreateTripInput,
} from "@/lib/validation/trip";
import { CoverImage } from "@/components/ui/cover-image";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { TripTopNav } from "@/components/layout/trip-top-nav";
import { Container } from "@/components/layout/container";
import { TextInput } from "@/components/ui/text-input";
import { PillSelect } from "@/components/ui/pill-select";
import { Button, LinkButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const PARTICIPANT_OPTIONS = Array.from({ length: 9 }, (_, i) => i + 2).map((n) => ({
  value: n,
  label: `${n}명`,
}));

/* 예정 여행 기간 — 실제 여행에 필요한 길이. 후보 기간과는 다른 값이고,
   흔한 세 가지는 바로 누르고 그 밖은 직접 입력으로 넘어간다. */
const NIGHT_PRESETS = [1, 2, 3];

function nightsLabel(n: number): string {
  return `${n}박 ${n + 1}일`;
}

export default function CreateTripPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [customNights, setCustomNights] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { nights: 2, expectedParticipantCount: 4 },
  });

  const [startDate, endDate] = useWatch({
    control,
    name: ["candidateStartDate", "candidateEndDate"],
  });
  const spanDays =
    startDate && endDate && endDate >= startDate ? candidateSpanDays(startDate, endDate) : 0;
  const todayIso = new Date().toLocaleDateString("sv-SE"); // yyyy-mm-dd, local

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

  /* The form itself is identical at every width — only its container changes,
     and it never grows past 520px however wide the window gets. */
  const formFields = (
    <>
      <TextInput
        label="여행 이름"
        placeholder="여행 이름을 정해주세요."
        error={errors.title?.message}
        {...register("title")}
      />
      <TextInput
        label="목적지"
        placeholder="여행의 목적지를 알려주세요."
        error={errors.destination?.message}
        {...register("destination")}
      />
      <TextInput
        label="주최자 닉네임"
        placeholder="사용할 이름을 적어주세요."
        hint="이 이름으로 참여자 목록에 표시돼요."
        error={errors.hostNickname?.message}
        {...register("hostNickname")}
      />

      <div className="flex flex-col gap-2">
        <p className="m-0 text-xs font-semibold leading-[1.33] text-ink">여행 후보 기간</p>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            type="date"
            label="시작일"
            min={todayIso}
            error={errors.candidateStartDate?.message}
            {...register("candidateStartDate")}
          />
          <TextInput
            type="date"
            label="종료일"
            min={startDate || todayIso}
            error={errors.candidateEndDate?.message}
            {...register("candidateEndDate")}
          />
        </div>
        <p className="m-0 text-xs leading-[1.33] text-text-muted">
          {spanDays > 0
            ? `친구들이 가능한 날짜를 고를 전체 기간이에요. 지금 ${spanDays}일 · 최대 ${MAX_CANDIDATE_SPAN_DAYS}일.`
            : `친구들이 가능한 날짜를 고를 전체 기간이에요. 달을 넘어가도 괜찮고, 최대 ${MAX_CANDIDATE_SPAN_DAYS}일까지 설정할 수 있어요.`}
        </p>
      </div>

      <Controller
        control={control}
        name="nights"
        render={({ field }) => {
          const value = field.value ?? 2;
          const custom = customNights || !NIGHT_PRESETS.includes(value);
          return (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-xs font-semibold leading-[1.33] text-ink">예정 여행 기간</p>
              <div className="flex flex-wrap gap-2">
                {NIGHT_PRESETS.map((n) => {
                  const selected = !custom && value === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setCustomNights(false);
                        field.onChange(n);
                      }}
                      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${
                        selected
                          ? "border-primary bg-primary text-on-primary"
                          : "border-hairline bg-surface text-ink hover:bg-primary-soft"
                      }`}
                    >
                      {nightsLabel(n)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={custom}
                  onClick={() => setCustomNights(true)}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${
                    custom
                      ? "border-primary bg-primary text-on-primary"
                      : "border-hairline bg-surface text-ink hover:bg-primary-soft"
                  }`}
                >
                  직접 입력
                </button>
              </div>

              {custom && (
                <div className="flex items-center gap-4 pt-1">
                  <button
                    type="button"
                    aria-label="숙박 일수 줄이기"
                    onClick={() => field.onChange(Math.max(1, value - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface text-ink hover:bg-primary-soft"
                  >
                    <Minus size={20} aria-hidden="true" />
                  </button>
                  <p className="m-0 min-w-24 text-center text-[18px] font-[650] text-ink">
                    {nightsLabel(value)}
                  </p>
                  <button
                    type="button"
                    aria-label="숙박 일수 늘리기"
                    onClick={() => field.onChange(Math.min(30, value + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface text-ink hover:bg-primary-soft"
                  >
                    <Plus size={20} aria-hidden="true" />
                  </button>
                </div>
              )}

              <p className="m-0 text-xs leading-[1.33] text-text-muted">
                실제로 다녀올 기간이에요. 정확한 날짜는 응답이 모인 뒤 그룹 합의에서 정해요.
              </p>
              {errors.nights?.message && (
                <p className="m-0 text-xs font-medium text-conflict-text">{errors.nights.message}</p>
              )}
            </div>
          );
        }}
      />

      <Controller
        control={control}
        name="expectedParticipantCount"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-xs font-semibold leading-[1.33] text-ink">예상 인원 (주최자 포함)</p>
            <PillSelect
              ariaLabel="예상 인원"
              options={PARTICIPANT_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          </div>
        )}
      />
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <TripTopNav />
      <TripAppBar title="새 여행 만들기" back onBack={() => router.push("/")} />

      {/* mobile: photo header with the scrim, exactly as before */}
      <div className="desk:hidden">
        <CoverImage height={240}>
          <p className="m-0 mb-1.5 text-xs font-semibold text-white">Welcome</p>
          <h2 className="m-0 text-2xl font-[650] leading-[1.2] text-white">
            함께 가고 싶은
            <br />
            여행을 시작해요.
          </h2>
        </CoverImage>
      </div>

      {/* noValidate: 날짜 input 의 min 이 걸리면 브라우저가 제출을 막아버려
          우리 문구 대신 네이티브 말풍선이 떠버린다. 검증은 zod 로만 한다. */}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col">
        <Container className="flex flex-1 flex-col pb-6 pt-6 desk:pb-12 desk:pt-8">
          <div className="grid items-start gap-6 desk:grid-cols-[44fr_56fr] desk:gap-10">
            {/* desktop-only left rail: the same cover, framed rather than bled */}
            <div className="hidden flex-col gap-5 desk:flex">
              <div className="h-[320px] w-full overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/trip-cover.jpg"
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="max-w-[460px]">
                <h2 className="m-0 mb-2 text-[28px] font-[650] leading-[1.2] text-ink">
                  함께 가고 싶은 여행을 시작해요.
                </h2>
                <p className="m-0 text-base leading-[1.5] text-ink-soft">
                  이름과 목적지만 정해두면 친구들이 링크로 들어와 가능한 날짜와 취향을 남깁니다.
                  정확한 날짜는 응답이 모인 뒤 그룹 합의에서 정해요.
                </p>
              </div>
            </div>

            <div className="flex w-full max-w-[520px] flex-col gap-5">
              {formFields}

              <div className="flex flex-col gap-2 pt-1 desk:flex-row desk:justify-end">
                <LinkButton href="/" variant="soft" className="w-full desk:w-auto">
                  취소
                </LinkButton>
                <Button
                  type="submit"
                  size="lg"
                  loading={isSubmitting}
                  icon={<ArrowRight size={16} aria-hidden="true" />}
                  className="w-full desk:h-11 desk:w-auto"
                >
                  여행 만들기
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </form>
    </div>
  );
}
