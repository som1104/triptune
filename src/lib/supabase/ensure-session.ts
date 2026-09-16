import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureAnonSession(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;

  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error || !signInData.user) {
    throw new Error(error?.message ?? "세션을 시작할 수 없어요.");
  }
  return signInData.user.id;
}
