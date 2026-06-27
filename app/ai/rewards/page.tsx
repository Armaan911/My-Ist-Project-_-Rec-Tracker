import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AiRewards() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if ((me as any).role !== "ai_team") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: mine } = await admin.from("fetched_profiles").select("id, status, created_at").eq("ai_team_id", me.id);
  const rows = (mine ?? []) as { id: string; status: string; created_at: string | null }[];

  const total = rows.length;
  const closures = rows.filter((r) => r.status === "closure").length;
  const submissions = rows.filter((r) => r.status === "internal_submission" || r.status === "client_submission").length;
  const strong = rows.filter((r) => r.status === "strong").length;
  const days = new Set(rows.map((r) => (r.created_at ?? "").slice(0, 10)).filter(Boolean)).size;

  let recruitersHelped = 0;
  if (rows.length) {
    const { data: pocs } = await admin.from("fetched_profile_pocs").select("recruiter_id").in("fetched_profile_id", rows.map((r) => r.id));
    recruitersHelped = new Set(((pocs ?? []) as any[]).map((p) => p.recruiter_id)).size;
  }

  const badges = [
    { name: "Speed Sourcer", icon: "⚡", value: total, target: 50, crit: "Source 50 candidate profiles" },
    { name: "Elite Sourcer", icon: "👑", value: total, target: 250, crit: "Source 250 candidate profiles" },
    { name: "Precision Hunter", icon: "🎯", value: submissions, target: 10, crit: "Get 10 profiles to internal/client submission" },
    { name: "Quality Expert", icon: "💎", value: strong, target: 15, crit: "Have 15 profiles marked “Strong profile”" },
    { name: "Consistency Champion", icon: "📅", value: days, target: 20, crit: "Source candidates on 20 different days" },
    { name: "Team Contributor", icon: "🤝", value: recruitersHelped, target: 5, crit: "Assign candidates to 5 different recruiters" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rewards</h1>
        <p className="text-sm text-muted">Your sourcing achievements.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Profiles sourced" value={total} />
        <Stat label="Submissions" value={submissions} />
        <Stat label="Closures" value={closures} tone="success" />
        <Stat label="Strong profiles" value={strong} />
        <Stat label="Recruiters helped" value={recruitersHelped} />
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Achievements</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b) => {
            const earned = b.value >= b.target;
            const pct = Math.min(100, Math.round((b.value / b.target) * 100));
            return (
              <div key={b.name} className={`rounded-xl border p-4 ${earned ? "border-brand-300 bg-brand-50" : "border-line"}`}>
                <div className="flex items-start gap-2">
                  <span className={`text-2xl ${earned ? "" : "opacity-40 grayscale"}`}>{b.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold">{b.name}
                      {earned && <span className="rounded-full bg-success-50 px-1.5 text-[10px] font-bold uppercase text-success-600">Unlocked</span>}</div>
                    <div className="text-xs text-muted">{b.crit}</div>
                  </div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-line"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} /></div>
                <div className="mt-1 text-right text-xs text-muted">{Math.min(b.value, b.target)}/{b.target}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 elevate">
      <div className={`text-2xl font-bold ${tone === "success" ? "text-success-600" : "text-ink"}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
