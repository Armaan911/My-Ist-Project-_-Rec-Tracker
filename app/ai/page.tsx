import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import AiImport from "@/components/ai/AiImport";
import AiCandidates from "@/components/ai/AiCandidates";
import AiRequirementsSummary from "@/components/ai/AiRequirementsSummary";

export const dynamic = "force-dynamic";

export default async function AiDashboard() {
  const me = await getProfile();
  const admin = createAdminClient();

  const [{ data: reqs }, { data: recruiters }, { data: mine }] = await Promise.all([
    admin.from("requirements").select("id, title, job_code, status, clients(name)").eq("status", "open").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, full_name").eq("role", "recruiter").eq("is_active", true).order("full_name"),
    admin.from("fetched_profiles")
      .select("id, candidate_name, linkedin_url, location, email, phone, open_to_work, ownership, status, resume_url, recruiter_comment, requirement_id, created_at, requirements(title, divisions(name))")
      .eq("ai_team_id", me?.id).order("created_at", { ascending: false }).limit(2000),
  ]);

  const mineRows = (mine ?? []) as any[];

  const candidates = mineRows.map((m) => ({
    id: m.id, candidate_name: m.candidate_name, linkedin_url: m.linkedin_url, location: m.location,
    email: m.email, phone: m.phone, open_to_work: m.open_to_work, ownership: m.ownership, status: m.status,
    resume_url: m.resume_url, requirement_id: m.requirement_id, requirement_title: (m.requirements as any)?.title ?? null,
    created_at: m.created_at ?? null, recruiter_comment: m.recruiter_comment ?? null,
  }));

  // Summary of requirements (JDs) worked on: job role, division, # sourced profiles.
  const agg = new Map<string, { title: string; division: string; count: number }>();
  for (const m of mineRows) {
    const key = m.requirement_id ?? "none";
    const g = agg.get(key) ?? {
      title: m.requirement_id ? ((m.requirements as any)?.title ?? "Untitled") : "No JD",
      division: (m.requirements as any)?.divisions?.name ?? "—",
      count: 0,
    };
    g.count++; agg.set(key, g);
  }
  const reqSummary = [...agg.values()].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI desk</h1>
        <p className="text-sm text-muted">Import sourced candidates, preview them per JD, then track and manage the pipeline.</p>
      </div>

      <AiImport
        requirements={((reqs ?? []) as any[]).map((r) => ({ id: r.id, title: r.title, job_code: r.job_code, client: (r.clients as any)?.name ?? null }))}
        recruiters={(recruiters ?? []) as any}
      />

      <AiRequirementsSummary rows={reqSummary} />

      <AiCandidates candidates={candidates} />
    </div>
  );
}
