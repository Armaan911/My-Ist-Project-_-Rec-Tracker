import { createClient } from "@supabase/supabase-js";

// Service-role client. Bypasses RLS. NEVER import this into client components.
// Powers all manager/admin reads + the no-login daily form save.
//
// If SUPABASE_SERVICE_ROLE_KEY is missing or wrong, these pages would otherwise
// silently return empty data (blank recruiter lists, empty dashboards). We fail
// loudly instead so the misconfiguration is obvious.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — manager/admin pages need it. Add it from Supabase → Settings → API → service_role key.");
  if (key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is set to the anon key. Use the service_role key (Supabase → Settings → API).");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
