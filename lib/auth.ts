import { createClient } from "@/lib/supabase/server";

export async function getProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles").select("id, full_name, role, division_id, avatar_url, is_coordinator").eq("id", user.id).single();
  return data;
}

export async function isAdmin() {
  const p = await getProfile();
  return p?.role === "admin";
}
