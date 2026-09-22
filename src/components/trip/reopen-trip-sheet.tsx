"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CalendarClock, RotateCcw, Vote } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { ReopenScope } from "@/lib/supabase/database.types";

const REASON_MAX = 100;

const OPTIONS: {
  scope: ReopenScope;
  icon: typeof Vote;
  title: string;
  description: string;
}[] = [
  {
    scope: "stay_vote",
    icon: Vote,
    title: "숙소 투표만 다시 열기",
    description: "확정된 날짜와 여행 취향은 유지하고 숙소 투표만 다시 진행합니다.",
  },
  {
    scope: "group_direction",
    icon: CalendarClock,
    title: "날짜·취향 조율부터 다시 열기",
    description:
      "날짜나 취향을 다시 조율하면 확정된 숙소도 재검토 상태로 변경됩니다. 기존 응답은 유지되며 참여자들이 수정할 수 있습니다.",
  },
];

const CONFIRM: Record<ReopenScope, { title: string; body: string; cta: string; go: string }> = {
  stay_vote: {
    title: "숙소 투표를 다시 열까요?",
    body: "확정된 날짜와 취향은 유지됩니다. 숙소의 최종 확정이 해제되고 참여자들이 기존 투표를 수정할 수 있습니다.",
    cta: "숙소 투표 다시 열기",
    go: "/stay",
  },
  group_direction: {
    title: "날짜와 취향을 다시 조율할까요?",
    body: "날짜 확정과 숙소 확정이 해제됩니다. 기존 응답과 숙소 후보는 삭제되지 않으며 참여자들이 응답을 수정할 수 있습니다.",
    cta: "날짜·취향 다시 열기",
    go: "/consensus",
  },
};

const ERRORS: Record<string, string> = {
  NOT_HOST: "주최자만 조율을 다시 열 수 있어요.",
  INVALID_STATE: "지금은 다시 열 수 없는 상태예요. 화면을 새로 불러와 주세요.",
  REASON_TOO_LONG: "변경 사유는 100자까지 쓸 수 있어요.",
};

/* 확정 화면의 보조 관리 기능. 주최자에게만 보이고, 실제 권한은 서버의
   reopen_after_confirm 이 다시 확인한다 — 버튼을 숨기는 것만으로는 막히지
   않으니 UI 는 안내일 뿐이다. */
export function ReopenTripSheet({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmScope, setConfirmScope] = useState<ReopenScope | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [navigating, startTransition] = useTransition();

  const busy = submitting || navigating;

  async function reopen() {
    if (!confirmScope || busy) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("reopen_after_confirm", {
        p_trip_id: tripId,
        p_scope: confirmScope,
        p_reason: reason.trim() ? reason.trim() : null,
      });
      if (error) {
        const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
        throw new Error(key ? ERRORS[key] : `다시 열지 못했어요. (${error.message})`);
      }

      const target = CONFIRM[confirmScope].go;
      setConfirmScope(null);
      setSheetOpen(false);
      setReason("");
      showToast(
        confirmScope === "stay_vote" ? "숙소 투표를 다시 열었어요." : "날짜·취향 조율을 다시 열었어요."
      );
      startTransition(() => {
        // 확정 화면이 캐시에 남아 있으면 되돌린 결과가 안 보인다.
        router.refresh();
        router.push(`/trip/${tripId}${target}`);
      });
    } catch (err) {
      // 실패하면 확정 상태 그대로 — 서버가 아무것도 바꾸지 않았다.
      showToast(err instanceof Error ? err.message : "다시 열지 못했어요.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        icon={<RotateCcw size={16} aria-hidden="true" />}
        iconPosition="start"
        onClick={() => setSheetOpen(true)}
      >
        조율 다시 열기
      </Button>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="조율 다시 열기">
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[13px] leading-[1.5] text-text-muted">
            여행을 처음부터 되돌리는 기능이 아니에요. 확정만 풀고, 지금까지 모인 응답과 숙소
            후보는 그대로 둡니다.
          </p>
          {OPTIONS.map((o) => (
            <button
              key={o.scope}
              type="button"
              onClick={() => setConfirmScope(o.scope)}
              className="flex items-start gap-3 rounded-2xl border border-hairline-soft bg-surface p-4 text-left hover:bg-primary-soft"
            >
              <span className="mt-0.5 flex shrink-0 text-primary">
                <o.icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-ink">{o.title}</span>
                <span className="mt-0.5 block text-[13px] leading-[1.45] text-ink-soft">
                  {o.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>

      <Modal
        open={confirmScope !== null}
        onClose={() => !busy && setConfirmScope(null)}
        title={confirmScope ? CONFIRM[confirmScope].title : ""}
        description={confirmScope ? CONFIRM[confirmScope].body : undefined}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reopen-reason"
              className="text-xs font-semibold leading-[1.33] text-ink"
            >
              변경 사유 <span className="font-[450] text-text-muted">(선택)</span>
            </label>
            <textarea
              id="reopen-reason"
              rows={2}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              placeholder="예: 확정한 숙소 예약이 어려워졌어요."
              className="w-full resize-none rounded-2xl bg-field px-4 py-3 text-[15px] leading-[1.5] text-ink outline-none placeholder:text-text-faint focus:ring-2 focus:ring-inset focus:ring-ink"
            />
            <div className="flex items-baseline justify-between gap-3">
              <p className="m-0 text-xs text-text-muted">참여자에게 안내와 함께 보여요.</p>
              <span className="shrink-0 text-xs text-text-muted">
                {reason.length} / {REASON_MAX}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              fullWidth
              disabled={busy}
              onClick={() => setConfirmScope(null)}
            >
              취소
            </Button>
            <Button variant="soft" fullWidth loading={busy} onClick={reopen}>
              {confirmScope ? CONFIRM[confirmScope].cta : ""}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
