import { createAdminClient } from "@/lib/supabase/admin";
import AiContributors from "@/components/AiContributors";

export const dynamic = "force-dynamic";

// "Approved" = a profile that moved past review into the active pipeline.
const APPROVED = new Set(["connected", "in_conversation", "strong", "tech_scheduled", "tech_conducted", "internal_submission", "client_submission", "closure"]);

export default async function AiContributorsPage() {
  const admin = createAdminClient();
  const [{ data: profs }, { data: fps }] = await Promise.all([
    admin.from("profiles").select("id, full_name").eq("role", "ai_team"),
    admin.from("fetched_profiles").select("ai_team_id, requirement_id, status, requirements(title, divisions(name))"),
  ]);
  const nameById = new Map(((profs ?? []) as any[]).map((p) => [p.id, p.full_name]));

  const agg = new Map<string, any>();
  for (const f of (fps ?? []) as any[]) {
    if (!f.ai_team_id) continue;
    const key = `${f.ai_team_id}|${f.requirement_id ?? "none"}`;
    const row = agg.get(key) ?? {
      contributor: nameById.get(f.ai_team_id) ?? "—",
      jobRole: f.requirement_id ? ((f.requirements as any)?.title ?? "Untitled") : "No JD",
      division: (f.requirements as any)?.divisions?.name ?? "—",
      submitted: 0, approved: 0, internal: 0, client: 0,
    };
    row.submitted++;
    if (APPROVED.has(f.status)) row.approved++;
    if (f.status === "internal_submission") row.internal++;
    if (f.status === "client_submission") row.client++;
    agg.set(key, row);
  }
  const rows = [...agg.values()].sort((a, b) => b.submitted - a.submitted);
  return <AiContributors rows={rows} />;
}
