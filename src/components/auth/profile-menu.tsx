"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, LogOut, Plus, List, BookmarkPlus } from "lucide-react";
import { useAccount } from "@/components/providers/session-provider";
import { useAccountSheet } from "@/components/auth/account-sheet";
import { createClient } from "@/lib/supabase/client";

/* Popover, not a screen — the spec keeps 로그인/계정 저장/프로필 out of the
   core screen list. Sits in the app bar's action slot. */
export function ProfileMenu() {
  const router = useRouter();
  const { isGuest, displayName } = useAccount();
  const { openAccountSheet } = useAccountSheet();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const items: { label: string; icon: typeof List; onClick: () => void }[] = [
    { label: "내 여행", icon: List, onClick: () => router.push("/") },
    { label: "새 여행 만들기", icon: Plus, onClick: () => router.push("/new") },
    isGuest
      ? { label: "여행 저장하기", icon: BookmarkPlus, onClick: openAccountSheet }
      : { label: "로그아웃", icon: LogOut, onClick: signOut },
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="프로필 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-primary-soft"
      >
        <UserRound size={20} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-hairline bg-surface"
        >
          <div className="border-b border-hairline-soft px-4 py-3">
            <p className="m-0 truncate text-[15px] font-semibold text-ink">{displayName}</p>
            <p className="m-0 text-xs text-text-muted">
              {isGuest ? "게스트로 이용 중" : "계정에 저장됨"}
            </p>
          </div>
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="flex min-h-11 w-full items-center gap-2.5 px-4 text-sm font-medium text-ink hover:bg-primary-soft"
            >
              <item.icon size={16} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small, non-nagging status chip for the 내 여행 header. */
export function GuestChip() {
  const { isGuest, displayName, ready } = useAccount();
  if (!ready) return null;
  return (
    <span className="text-[13px] font-semibold text-text-muted">
      {isGuest ? "게스트" : displayName}
    </span>
  );
}
