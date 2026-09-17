import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { CoverImage } from "@/components/ui/cover-image";
import { Avatar } from "@/components/ui/avatar";
import { formatMonthKo, formatTripLength } from "@/lib/trip/format";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  const { inviteToken } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_trip_invite_info", { p_invite_token: inviteToken })
    .maybeSingle();

  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TripAppBar title="TRIPTUNE" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="text-[15px] font-semibold text-ink">초대 링크를 찾을 수 없어요.</p>
          <p className="text-sm text-text-muted">링크가 잘못되었거나 더 이상 유효하지 않아요.</p>
        </div>
      </div>
    );
  }

  if (data.already_joined) {
    redirect(`/trip/${data.trip_id}`);
  }

  const isFull = data.current_participant_count >= data.expected_participant_count;
  const isClosed = data.status !== "collecting_responses";

  return (
    <div className="flex min-h-dvh flex-col">
      <TripAppBar title="TRIPTUNE" />
      <CoverImage height={200}>
        <p className="m-0 mb-1.5 text-xs font-semibold text-white">초대를 받았어요</p>
        <h2 className="m-0 text-2xl font-[650] leading-[1.2] text-white">{data.title}</h2>
      </CoverImage>

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <div className="overflow-hidden rounded-2xl border border-hairline-soft">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline-soft px-4 py-2">
            <span className="text-sm text-ink-soft">주최자</span>
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
              <Avatar nickname={data.host_nickname} size="sm" />
              {data.host_nickname}
            </span>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline-soft px-4 py-2">
            <span className="text-sm text-ink-soft">예상 시기</span>
            <span className="text-[15px] font-semibold">
              {formatMonthKo(data.candidate_start_date)} · {formatTripLength(data.trip_days)}
            </span>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
            <span className="text-sm text-ink-soft">현재 참여</span>
            <span className="text-[15px] font-semibold">
              {data.current_participant_count} / {data.expected_participant_count}명
            </span>
          </div>
        </div>

        {isClosed ? (
          <div className="rounded-2xl bg-primary-soft p-4">
            <p className="text-sm leading-relaxed text-ink-soft">
              이 여행은 참여자 모집이 마감되었어요.
            </p>
          </div>
        ) : isFull ? (
          <div className="rounded-2xl bg-primary-soft p-4">
            <p className="text-sm leading-relaxed text-ink-soft">
              이 여행은 이미 참여 인원이 모두 찼어요.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-primary-soft p-4">
              <p className="text-sm leading-relaxed text-ink-soft">
                가능한 날짜와 여행 취향만 고르면 돼요. 그룹의 공통 선호와 충돌을 정리해 보여주고, 숙소는
                함께 투표로 정합니다.
              </p>
            </div>
            <JoinForm inviteToken={inviteToken} />
          </>
        )}
      </div>
    </div>
  );
}
