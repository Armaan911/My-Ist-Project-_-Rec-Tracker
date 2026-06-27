"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type BadgeInput = {
  id?: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rule: string;
  threshold: number | null;
  period: string;
  is_repeatable: boolean;
  is_active: boolean;
  sort_order: number;
};

export async function upsertBadge(input: BadgeInput) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  if (!input.code?.trim() || !input.name?.trim() || !input.rule?.trim()) return { ok: false, error: "Code, name and rule are required." };
  const supabase = createClient();
  const row = {
    code: input.code.trim(), name: input.name.trim(), description: input.description || null,
    icon: input.icon || null, color: input.color || "#6366f1", rule: input.rule,
    threshold: input.threshold, period: input.period, is_repeatable: input.is_repeatable,
    is_active: input.is_active, sort_order: input.sort_order,
  };
  const { error } = input.id
    ? await supabase.from("badges").update(row).eq("id", input.id)
    : await supabase.from("badges").insert(row);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, input.id ? "badge.update" : "badge.create", "badges", input.id ?? null, { code: input.code });
  revalidatePath("/admin/badges");
  return { ok: true };
}

export async function deleteBadge(id: string) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { error } = await supabase.from("badges").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "badge.delete", "badges", id, null);
  revalidatePath("/admin/badges");
  return { ok: true };
}
