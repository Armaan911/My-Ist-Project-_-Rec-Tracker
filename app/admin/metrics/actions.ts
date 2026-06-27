"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const PATH = "/admin/metrics";
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

async function gate() {
  const me = await getProfile();
  if (me?.role !== "admin") return null;
  return me;
}

export async function createMetric(input: {
  label: string; key?: string; hint: string; color: string; icon: string; input_style: string; soft_max: number;
}) {
  const me = await gate();
  if (!me) return { ok: false, error: "Not authorized" };
  if (!input.label.trim()) return { ok: false, error: "Give the metric a name." };
  const key = slug(input.key || input.label);
  if (!key) return { ok: false, error: "Couldn't make a key from that name." };
  const supabase = createClient();

  const { data: maxRow } = await supabase.from("daily_metrics").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sort_order = ((maxRow?.sort_order ?? 0) as number) + 10;

  const { error } = await supabase.from("daily_metrics").insert({
    key, label: input.label.trim(), hint: input.hint.trim() || null,
    color: input.color, icon: input.icon, input_style: input.input_style,
    soft_max: Math.max(1, Math.trunc(input.soft_max || 20)), sort_order, is_active: true,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "A metric with that key already exists." : error.message };
  await logAudit(me.id, "daily_metric.create", "daily_metrics", null, { key, label: input.label });
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateMetric(input: {
  id: string; label: string; hint: string; color: string; icon: string; input_style: string; soft_max: number; is_active: boolean;
}) {
  const me = await gate();
  if (!me) return { ok: false, error: "Not authorized" };
  if (!input.label.trim()) return { ok: false, error: "Name can't be empty." };
  const supabase = createClient();
  const { error } = await supabase.from("daily_metrics").update({
    label: input.label.trim(), hint: input.hint.trim() || null, color: input.color,
    icon: input.icon, input_style: input.input_style, soft_max: Math.max(1, Math.trunc(input.soft_max || 20)), is_active: input.is_active,
  }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "daily_metric.update", "daily_metrics", input.id, { label: input.label, is_active: input.is_active });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteMetric(id: string) {
  const me = await gate();
  if (!me) return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  // FK on daily_activity_values is ON DELETE CASCADE — historical values for this metric go too.
  const { error } = await supabase.from("daily_metrics").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "daily_metric.delete", "daily_metrics", id, null);
  revalidatePath(PATH);
  return { ok: true };
}

export async function reorderMetric(id: string, direction: "up" | "down") {
  const me = await gate();
  if (!me) return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { data: all } = await supabase.from("daily_metrics").select("id, sort_order").order("sort_order");
  const list = (all ?? []) as { id: string; sort_order: number }[];
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) return { ok: false, error: "Not found" };
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= list.length) return { ok: true };
  const a = list[idx], b = list[target];
  await Promise.all([
    supabase.from("daily_metrics").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("daily_metrics").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  revalidatePath(PATH);
  return { ok: true };
}
