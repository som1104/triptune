import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Lands here after Google linking or the email confirmation link. Exchanging
   the code upgrades the SAME user that was browsing as a guest, so no trip
   needs to be moved — we just send them back where they were with a flag the
   UI turns into "여행을 계정에 저장했어요". */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}?saved=1`);
    }
    return NextResponse.redirect(`${origin}${safeNext}?save_error=1`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
