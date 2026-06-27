"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markAlertRead(alertId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", alertId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/manager");
  return { ok: true };
}
