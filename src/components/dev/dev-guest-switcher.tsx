"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAccount } from "@/components/providers/session-provider";

/* 개발 전용. 게스트는 브라우저 세션 하나당 한 명이라, 참여자 여러 명을
   테스트하려면 보통 시크릿 창을 계속 새로 열어야 한다 — 그런데 시크릿 창은
   서로 세션을 공유해서 두 번째 창을 열어도 같은 게스트다.

   여기서는 익명 세션을 버리고 새로 발급받는다. 같은 창에서 참여자를 몇 명이든
   연달아 만들 수 있고, 주소는 그대로 두므로 초대 링크(/join/…)를 띄워둔 채
   "새 게스트로 전환 → 참여하기"를 반복하면 된다.

   전환하면 이전 게스트의 여행 목록에는 다시 못 들어간다(그 세션이 곧 신원이라
   계정에 저장하지 않았다면 복구 수단이 없다). 테스트용으로만 쓸 것. */
export function DevGuestSwitcher() {
  const router = useRouter();
  const { userId, isGuest, ready, refresh } = useAccount();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden || !ready) return null;

  async function switchGuest() {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw new Error(error.message);
      await refresh();
      // 서버 컴포넌트가 쿠키에서 세션을 다시 읽도록 현재 화면을 갱신한다.
      router.refresh();
    } catch {
      // 개발 도구라 조용히 실패해도 된다 — 콘솔에 남는 supabase 에러로 충분.
    } finally {
      setBusy(false);
    }
  }

  return (
    // 모바일은 오른쪽 위(앱바 아래) — 아래쪽은 저장 바와 탭바가 차지한다.
    // 데스크톱은 비어 있는 오른쪽 아래로 내린다.
    <div className="fixed right-3 top-16 z-[100] flex items-center gap-2 rounded-full border border-hairline bg-surface/95 py-1.5 pl-3 pr-1.5 text-xs backdrop-blur-sm desk:bottom-3 desk:top-auto">
      <span className="font-semibold text-text-muted">
        dev · {isGuest ? "게스트" : "계정"} {userId ? userId.slice(0, 6) : "—"}
      </span>
      <button
        type="button"
        onClick={switchGuest}
        disabled={busy}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink px-3 font-semibold text-white disabled:opacity-50"
      >
        {busy ? (
          <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <UserPlus size={13} aria-hidden="true" />
        )}
        새 게스트로 전환
      </button>
      <button
        type="button"
        aria-label="개발 도구 숨기기"
        onClick={() => setHidden(true)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-primary-soft"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
