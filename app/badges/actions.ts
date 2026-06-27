"use server";
import { createClient } from "@/lib/supabase/server";

// Mark the caller's freshly-awarded badges as seen so the celebration only fires once.
export async function markBadgesSeen() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  await supabase.from("recruiter_badges").update({ seen_at: new Date().toISOString() })
    .eq("recruiter_id", user.id).is("seen_at", null);
  return { ok: true };
}
