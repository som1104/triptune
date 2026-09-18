"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/providers/session-provider";
import { useAccountSheet } from "@/components/auth/account-sheet";

const KEY = (tripId: string) => `triptune:guest-notice:${tripId}`;

/* Shown once per trip, to the guest who owns it. "괜찮아요" is remembered so
   the same trip never asks again — after that the only reminder left is the
   small 게스트 chip in the profile area. */
export function GuestNoticeModal({ tripId, isHost }: { tripId: string; isHost: boolean }) {
  const { isGuest, ready } = useAccount();
  const { openAccountSheet } = useAccountSheet();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready || !isGuest || !isHost) return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(KEY(tripId)) === "1";
    } catch {
      // private mode / storage blocked — skip the notice rather than nag
      dismissed = true;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dismissed) setOpen(true);
  }, [ready, isGuest, isHost, tripId]);

  function dismiss() {
    try {
      window.localStorage.setItem(KEY(tripId), "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title="현재 게스트로 이용 중이에요."
      description="브라우저 데이터를 삭제하거나 다른 기기를 사용하면 이 여행을 다시 관리하지 못할 수 있어요. 계정에 저장하면 안전하게 보관할 수 있습니다."
    >
      <div className="flex flex-col gap-2">
        <Button
          fullWidth
          onClick={() => {
            dismiss();
            openAccountSheet();
          }}
        >
          계정에 저장
        </Button>
        <Button variant="outline" fullWidth onClick={dismiss}>
          괜찮아요
        </Button>
      </div>
    </Modal>
  );
}

/* The soft, optional save card that sits under the invite link on the
   친구 초대 screen and on the 최종 여행 screen. Deliberately quieter than the
   invite/share CTA next to it: no solid fill, no primary colour block. */
export function SaveTripCard({ tripId }: { tripId?: string }) {
  const { isGuest, ready } = useAccount();
  const { openAccountSheet } = useAccountSheet();
  const [hidden, setHidden] = useState(false);

  if (!ready || !isGuest || hidden) return null;

  function later() {
    if (tripId) {
      try {
        window.localStorage.setItem(KEY(tripId), "1");
      } catch {
        // ignore
      }
    }
    setHidden(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline-soft bg-surface p-4">
      <div>
        <p className="m-0 mb-1 text-[15px] font-semibold text-ink">
          여행을 잃어버리지 않도록 저장할까요?
        </p>
        <p className="m-0 text-[13px] leading-[1.45] text-text-muted">
          로그인하면 다른 기기에서도 이 여행을 계속 관리할 수 있어요.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="min-w-0 flex-1" onClick={openAccountSheet}>
          Google로 저장
        </Button>
        <Button variant="ghost" className="min-w-0 flex-1" onClick={later}>
          나중에
        </Button>
      </div>
    </div>
  );
}
