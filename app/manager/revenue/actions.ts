"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";

// Managers (and admins as superusers) record the placement/revenue value for a closure.
export async function setRevenueValue(rewardId: string, value: number | null, currency: string) {
  const me = await getProfile();
  if (me?.role !== "manager" && me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const cur = currency === "USD" ? "USD" : "INR";
  const clean = value == null || isNaN(value) ? null : Math.max(0, value);
  const admin = createAdminClient();
  const { error } = await admin.from("reward_requests").update({ revenue_value: clean, revenue_currency: cur }).eq("id", rewardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/manager/revenue");
  return { ok: true };
}
