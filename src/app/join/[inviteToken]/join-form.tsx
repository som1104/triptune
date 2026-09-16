"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonSession } from "@/lib/supabase/ensure-session";
import { joinTripSchema, type JoinTripInput } from "@/lib/validation/trip";
import { TextInput } from "@/components/ui/text-input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const ERROR_MESSAGES: Record<string, string> = {
  TRIP_NOT_FOUND: "초대 링크를 찾을 수 없어요.",
  JOIN_CLOSED: "이 여행은 참여자 모집이 마감되었어요.",
  TRIP_FULL: "이 여행은 이미 참여 인원이 모두 찼어요.",
  NICKNAME_TAKEN: "이미 사용 중인 이름이에요. 다른 이름을 입력해주세요.",
};

export function JoinForm({ inviteToken }: { inviteToken: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JoinTripInput>({ resolver: zodResolver(joinTripSchema) });

  async function onSubmit(values: JoinTripInput) {
    try {
      const supabase = createClient();
      await ensureAnonSession(supabase);

      const { data, error } = await supabase.rpc("join_trip", {
        p_invite_token: inviteToken,
        p_nickname: values.nickname,
      });

      if (error || !data) {
        const code = error?.message.includes("NICKNAME_TAKEN")
          ? "NICKNAME_TAKEN"
          : error?.message.includes("TRIP_FULL")
            ? "TRIP_FULL"
            : error?.message.includes("JOIN_CLOSED")
              ? "JOIN_CLOSED"
              : error?.message.includes("TRIP_NOT_FOUND")
                ? "TRIP_NOT_FOUND"
                : null;

        if (code === "NICKNAME_TAKEN") {
          setError("nickname", { message: ERROR_MESSAGES[code] });
          return;
        }
        if (code) {
          showToast(ERROR_MESSAGES[code], "error");
          return;
        }
        throw new Error(error?.message ?? "참여하지 못했어요.");
      }

      router.push(`/trip/${data.trip_id}/respond`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "네트워크 오류가 발생했어요.", "error");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-5">
      <TextInput
        label="이름 또는 닉네임"
        placeholder="예: 고양이"
        hint="가입 없이 참여할 수 있어요. 이 이름으로 응답이 표시돼요."
        error={errors.nickname?.message}
        {...register("nickname")}
      />
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          icon={<ArrowRight size={18} aria-hidden="true" />}
        >
          여행에 참여하기
        </Button>
        <p className="text-center text-xs text-text-muted">
          참여하면 바로 내 날짜·취향 입력으로 이동해요.
        </p>
      </div>
    </form>
  );
}
