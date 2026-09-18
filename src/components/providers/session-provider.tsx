"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* Every visitor gets a Supabase anonymous session on first load. That session
   IS the "게스트" identity: it owns trips, holds host rights, and persists in
   this browser. Signing in later does not create a new user — it upgrades
   this same auth.uid() to a permanent one (linkIdentity / updateUser), so no
   trip, response or vote ever has to be migrated. */
export interface AccountState {
  userId: string | null;
  /** true while the session is anonymous (게스트) */
  isGuest: boolean;
  /** email once the account has been saved, otherwise null */
  email: string | null;
  /** what to show in the profile menu header */
  displayName: string;
  ready: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountState>({
  userId: null,
  isGuest: true,
  email: null,
  displayName: "게스트",
  ready: false,
  error: null,
  refresh: async () => {},
});

export function useAccount() {
  return useContext(AccountContext);
}

/** Kept for call sites that only need the id. */
export function useAnonSession() {
  const { userId, ready, error } = useAccount();
  return { userId, ready, error };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<{
    userId: string | null;
    isGuest: boolean;
    email: string | null;
    displayName: string;
    ready: boolean;
    error: string | null;
  }>({
    userId: null,
    isGuest: true,
    email: null,
    displayName: "게스트",
    ready: false,
    error: null,
  });

  const read = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    let user = data.session?.user ?? null;

    if (!user) {
      const { data: signInData, error } = await supabase.auth.signInAnonymously();
      if (error) {
        setSnapshot((s) => ({ ...s, ready: true, error: error.message }));
        return;
      }
      user = signInData.user ?? null;
    }

    // Supabase marks converted accounts by clearing is_anonymous and filling
    // in an identity, so either signal alone is enough to leave guest mode.
    const guest = !!user?.is_anonymous && !user?.email;
    const email = user?.email ?? null;
    const name =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      email ??
      "게스트";

    setSnapshot({
      userId: user?.id ?? null,
      isGuest: guest,
      email,
      displayName: guest ? "게스트" : name,
      ready: true,
      error: null,
    });
  }, []);

  useEffect(() => {
    // Reading (and bootstrapping) the Supabase session is synchronising with
    // an external system, which is exactly what effects are for — the lint
    // rule only sees the setState inside the async helper.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    read();
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      read();
    });
    return () => sub.subscription.unsubscribe();
  }, [read]);

  const value = useMemo<AccountState>(() => ({ ...snapshot, refresh: read }), [snapshot, read]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
