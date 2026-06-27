import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Passwordless landing: verifies the magic-link token_hash, sets the session cookie,
// then redirects to `next`. Used by approval emails so managers can act without a password.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") as EmailOtpType | null) ?? "magiclink";
  const next = searchParams.get("next") || "/dashboard";

  if (token_hash) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Only allow relative, same-app redirects.
      const dest = next.startsWith("/") ? next : "/dashboard";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=expired_link`);
}
