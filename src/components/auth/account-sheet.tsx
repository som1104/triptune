"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { useAccount } from "@/components/providers/session-provider";
import { createClient } from "@/lib/supabase/client";

interface AccountSheetValue {
  /** Opens the 계정 저장 bottom sheet. Never blocks anything behind it. */
  openAccountSheet: () => void;
}

const Ctx = createContext<AccountSheetValue>({ openAccountSheet: () => {} });

export function useAccountSheet() {
  return useContext(Ctx);
}

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
    />
    <path
      fill="#FBBC05"
      d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
    />
  </svg>
);

export function AccountSheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openAccountSheet = useCallback(() => setOpen(true), []);

  return (
    <Ctx.Provider value={{ openAccountSheet }}>
      {children}
      <AccountSheet open={open} onClose={() => setOpen(false)} />
    </Ctx.Provider>
  );
}

function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isGuest, email: savedEmail } = useAccount();
  const [mode, setMode] = useState<"choose" | "email" | "sent">("choose");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    onClose();
    // reset a beat later so the sheet doesn't flicker while it closes
    setTimeout(() => {
      setMode("choose");
      setError(null);
      setBusy(null);
    }, 200);
  }

  async function continueWithGoogle() {
    setBusy("google");
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        window.location.pathname
      )}`;

      // linkIdentity keeps the current (guest) user and attaches Google to it,
      // so everything already created in this browser stays owned by the same
      // account. signInWithOAuth would start a NEW user and orphan the trips.
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} (Supabase에서 Google 제공자와 Manual Linking을 켜야 해요.)`
          : "연결하지 못했어요."
      );
      setBusy(null);
    }
  }

  async function continueWithEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("email");
    setError(null);
    try {
      const supabase = createClient();
      // For a guest this attaches the address to the current user; the
      // confirmation link finishes the upgrade without a password screen.
      const { error } = await supabase.auth.updateUser(
        { email: email.trim() },
        { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` }
      );
      if (error) throw new Error(error.message);
      setMode("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "메일을 보내지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  if (!isGuest) {
    return (
      <BottomSheet open={open} onClose={close} title="여행이 계정에 저장돼 있어요">
        <p className="m-0 text-sm leading-[1.55] text-ink-soft">
          {savedEmail ? `${savedEmail} 계정으로 저장되어 있어요. ` : ""}
          다른 기기에서 같은 계정으로 로그인하면 이 여행들을 이어서 관리할 수 있어요.
        </p>
        <Button variant="soft" fullWidth onClick={close}>
          닫기
        </Button>
      </BottomSheet>
    );
  }

  if (mode === "sent") {
    return (
      <BottomSheet open={open} onClose={close} title="메일을 보냈어요">
        <p className="m-0 text-sm leading-[1.55] text-ink-soft">
          <span className="font-semibold text-ink">{email}</span> 으로 확인 링크를 보냈어요. 링크를
          열면 지금까지 만든 여행이 그대로 이 계정에 저장돼요.
        </p>
        <Button variant="soft" fullWidth onClick={close}>
          닫기
        </Button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={close} title="TRIPTUNE에 여행 저장하기">
      <p className="m-0 text-sm leading-[1.55] text-ink-soft">
        로그인하면 다른 기기에서도 여행을 계속 관리할 수 있어요.
      </p>

      {mode === "choose" ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="lg"
            fullWidth
            icon={<GoogleMark />}
            iconPosition="start"
            loading={busy === "google"}
            onClick={continueWithGoogle}
          >
            Google로 계속하기
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            icon={<Mail size={16} aria-hidden="true" />}
            iconPosition="start"
            onClick={() => setMode("email")}
          >
            이메일로 계속하기
          </Button>
          <Button variant="ghost" fullWidth onClick={close}>
            로그인 없이 계속
          </Button>
        </div>
      ) : (
        <form onSubmit={continueWithEmail} className="flex flex-col gap-3">
          <TextInput
            label="이메일"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint="비밀번호 없이, 메일로 받은 링크만 열면 돼요."
          />
          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={busy === "email"}
            disabled={!email.trim()}
            icon={<ArrowRight size={16} aria-hidden="true" />}
          >
            확인 링크 받기
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setMode("choose")}>
            뒤로
          </Button>
        </form>
      )}

      {error && (
        <p className="m-0 rounded-2xl border border-conflict-pill-border bg-conflict-pill-bg px-4 py-3 text-[13px] leading-[1.45] text-conflict-text">
          {error}
        </p>
      )}
    </BottomSheet>
  );
}
