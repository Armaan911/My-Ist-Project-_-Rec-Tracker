import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import NavBar from "@/components/NavBar";
import VerifyPanel from "@/components/VerifyPanel";
import { istDateStr, addDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const me = (await getProfile()) as any;
  if (!me) redirect("/login");
  const allowed = me.is_coordinator === true || me.role === "admin" || me.role === "manager";
  if (!allowed) redirect("/dashboard");

  const admin = createAdminClient();
  const since = addDays(istDateStr(), -60);

  const [{ data: subs }, { data: logs }] = await Promise.all([
    admin.from("submissions")
      .select("id, candidate_name, submitted_date, verified_at, recruiter_id, requirements(title), submission_statuses(label)")
      .gte("submitted_date", since).neq("recruiter_id", me.id).order("submitted_date", { ascending: false }).limit(1500),
    admin.from("daily_activity")
      .select("id, activity_date, resumes_sourced, applicants_parsed, notes, verified_at, recruiter_id, divisions(name)")
      .gte("activity_date", since).neq("recruiter_id", me.id).order("activity_date", { ascending: false }).limit(1500),
  ]);

  const recIds = Array.from(new Set([...(subs ?? []), ...(logs ?? [])].map((r: any) => r.recruiter_id).filter(Boolean)));
  const { data: recs } = recIds.length ? await admin.from("profiles").select("id, full_name").in("id", recIds) : { data: [] as any[] };
  const nameById = new Map(((recs ?? []) as any[]).map((r) => [r.id, r.full_name]));

  const submissions = ((subs ?? []) as any[]).map((s) => ({
    id: s.id, candidate: s.candidate_name ?? "—", recruiter: nameById.get(s.recruiter_id) ?? "—",
    requirement: (s.requirements as any)?.title ?? "—", status: (s.submission_statuses as any)?.label ?? "—",
    date: s.submitted_date, verified: !!s.verified_at,
  }));
  const dailyLogs = ((logs ?? []) as any[]).map((l) => ({
    id: l.id, recruiter: nameById.get(l.recruiter_id) ?? "—", division: (l.divisions as any)?.name ?? "—",
    date: l.activity_date, sourced: l.resumes_sourced ?? 0, parsed: l.applicants_parsed ?? 0, notes: l.notes ?? "", verified: !!l.verified_at,
  }));

  return (
    <div>
      <NavBar name={me.full_name} role={me.role} userId={me.id} avatarUrl={me.avatar_url ?? null} isCoordinator={me.is_coordinator === true} />
      <main className="mx-auto max-w-[1600px] px-3 py-8 sm:px-5 lg:px-7">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold tracking-tight">Verify team logs</h1>
          <p className="text-sm text-muted">As coordinator, confirm other recruiters' submissions and daily logs. Verified entries can be filtered on the team dashboard.</p>
        </div>
        <VerifyPanel submissions={submissions} logs={dailyLogs} />
      </main>
    </div>
  );
}
