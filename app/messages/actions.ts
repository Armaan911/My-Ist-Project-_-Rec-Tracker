"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Recipient marks one of their own messages read. RLS guarantees they can only touch their own.
export async function markMessageRead(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("messages").update({ is_read: true }).eq("id", id).eq("recipient_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

// Recipient deletes some of their own messages. Scoped to recipient_id so a user
// can only ever delete messages addressed to them.
export async function deleteMessages(ids: string[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const clean = Array.from(new Set((ids ?? []).filter(Boolean)));
  if (clean.length === 0) return { ok: false, error: "Nothing selected." };
  const admin = createAdminClient();
  const { error } = await admin.from("messages").delete().in("id", clean).eq("recipient_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

// Recipient clears their whole inbox.
export async function deleteAllMessages() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const admin = createAdminClient();
  const { error } = await admin.from("messages").delete().eq("recipient_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
