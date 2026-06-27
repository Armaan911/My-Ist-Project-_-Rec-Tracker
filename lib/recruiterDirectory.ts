import type { SupabaseClient } from "@supabase/supabase-js";

export type RecruiterRow = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  division_names: string[];
  submissions: number;
  closures: number;
  active_reqs: number;
};

// Build the recruiter directory: every active recruiter with their divisions,
// all-time submission + closure counts, and how many live requirements they hold.
// Pass a client that can read across divisions (service-role for managers/admins).
export async function getRecruiterDirectory(db: SupabaseClient): Promise<RecruiterRow[]> {
  const [{ data: recruiters }, { data: divisions }, { data: pd }, { data: subs }, { data: statuses }, { data: allocs }, { data: reqs }] = await Promise.all([
    db.from("profiles").select("id, full_name, email, division_id, avatar_url").eq("role", "recruiter").eq("is_active", true).order("full_name"),
    db.from("divisions").select("id, name"),
    db.from("profile_divisions").select("profile_id, division_id"),
    db.from("submissions").select("recruiter_id, current_status_id"),
    db.from("submission_statuses").select("id, counts_as_closure"),
    db.from("allocations").select("recruiter_id, requirement_id"),
    db.from("requirements").select("id, status"),
  ]);

  const divNameById = new Map<string, string>();
  for (const d of (divisions as any[]) ?? []) divNameById.set(d.id, d.name);

  const divsByRecruiter = new Map<string, Set<string>>();
  for (const row of (pd as any[]) ?? []) {
    const set = divsByRecruiter.get(row.profile_id) ?? new Set<string>();
    set.add(row.division_id);
    divsByRecruiter.set(row.profile_id, set);
  }

  const closureStatusIds = new Set(((statuses as any[]) ?? []).filter((s) => s.counts_as_closure).map((s) => s.id));
  const subsByRecruiter = new Map<string, { total: number; closures: number }>();
  for (const s of (subs as any[]) ?? []) {
    const cur = subsByRecruiter.get(s.recruiter_id) ?? { total: 0, closures: 0 };
    cur.total += 1;
    if (closureStatusIds.has(s.current_status_id)) cur.closures += 1;
    subsByRecruiter.set(s.recruiter_id, cur);
  }

  const reqStatus = new Map<string, string>();
  for (const r of (reqs as any[]) ?? []) reqStatus.set(r.id, r.status);
  const activeByRecruiter = new Map<string, Set<string>>();
  for (const a of (allocs as any[]) ?? []) {
    const st = reqStatus.get(a.requirement_id);
    if (st !== "open" && st !== "on_hold") continue;
    const set = activeByRecruiter.get(a.recruiter_id) ?? new Set<string>();
    set.add(a.requirement_id);
    activeByRecruiter.set(a.recruiter_id, set);
  }

  return ((recruiters as any[]) ?? []).map((rc) => {
    const set = divsByRecruiter.get(rc.id) ?? new Set<string>();
    if (rc.division_id) set.add(rc.division_id);
    const names = [...set].map((id) => divNameById.get(id)).filter(Boolean) as string[];
    const s = subsByRecruiter.get(rc.id) ?? { total: 0, closures: 0 };
    return {
      id: rc.id,
      full_name: rc.full_name,
      email: rc.email,
      avatar_url: rc.avatar_url ?? null,
      division_names: names.sort(),
      submissions: s.total,
      closures: s.closures,
      active_reqs: activeByRecruiter.get(rc.id)?.size ?? 0,
    };
  });
}
