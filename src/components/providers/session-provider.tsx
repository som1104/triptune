"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SessionContextValue {
  userId: string | null;
  ready: boolean;
  error: string | null;
}

const SessionContext = createContext<SessionContextValue>({
  userId: null,
  ready: false,
  error: null,
});

export function useAnonSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionContextValue>({
    userId: null,
    ready: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function ensure() {
      const { data } = await supabase.auth.getSession();
      let userId = data.session?.user.id ?? null;

      if (!userId) {
        const { data: signInData, error } = await supabase.auth.signInAnonymously();
        if (error) {
          if (!cancelled) setState({ userId: null, ready: true, error: error.message });
          return;
        }
        userId = signInData.user?.id ?? null;
      }

      if (!cancelled) setState({ userId, ready: true, error: null });
    }

    ensure();
    return () => {
      cancelled = true;
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
