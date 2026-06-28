"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";

// A recruiter records the "closed rate" (placement / bill value) for one of their
// own closures. Managers/admins may also adjust it. This value is informational —
// revenue is calculated from the manager-entered profit, not from this rate.
export async function setClosedRate(rewardId: string, value: number | null, currency: string) {
  const me = await getProfile();
  if (!me) return { ok: false, error: "Not authorized" };

  const cur = currency === "USD" ? "USD" : "INR";
  const clean = value == null || isNaN(value) ? null : Math.max(0, value);

  const admin = createAdminClient();
  const { data: row } = await admin.from("reward_requests").select("recruiter_id").eq("id", rewardId).maybeSingle();
  if (!row) return { ok: false, error: "Closure not found" };
  // Recruiters may only edit their own closures; managers/admins may edit any.
  if (me.role === "recruiter" && (row as { recruiter_id: string }).recruiter_id !== me.id) {
    return { ok: false, error: "Not authorized" };
  }

  const { error } = await admin.from("reward_requests")
    .update({ closed_rate: clean, closed_rate_currency: cur }).eq("id", rewardId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/rewards");
  revalidatePath("/manager/revenue");
  return { ok: true };
}
