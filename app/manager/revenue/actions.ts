"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";

// Managers and HR record the contract economics for a closure: monthly profit and the
// contract duration (months). Total revenue = monthly_profit × contract_months.
export async function setClosureRevenue(
  rewardId: string,
  input: { monthlyProfit: number | null; contractMonths: number | null; currency: string },
) {
  const me = await getProfile();
  if (me?.role !== "manager" && me?.role !== "hr" && me?.role !== "admin") {
    return { ok: false, error: "Only managers and HR can edit revenue." };
  }
  const cur = input.currency === "USD" ? "USD" : "INR";
  const mp = input.monthlyProfit == null || isNaN(input.monthlyProfit) ? null : Math.max(0, input.monthlyProfit);
  const cm = input.contractMonths == null || isNaN(input.contractMonths) ? null : Math.max(0, Math.round(input.contractMonths));
  const total = mp != null && cm != null ? mp * cm : null;

  const admin = createAdminClient();
  const { error } = await admin.from("reward_requests")
    .update({ monthly_profit: mp, contract_months: cm, revenue_value: total, revenue_currency: cur })
    .eq("id", rewardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/manager/revenue");
  revalidatePath("/hr/revenue");
  return { ok: true };
}
