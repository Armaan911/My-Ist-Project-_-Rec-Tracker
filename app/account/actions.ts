"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

// Any signed-in user can set their own profile photo.
export async function setMyAvatar(url: string | null) {
  const me = await getProfile();
  if (!me) return { ok: false, error: "Not signed in" };
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", me.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
