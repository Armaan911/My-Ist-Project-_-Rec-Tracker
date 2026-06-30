import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui";
import RequestIncentiveButton from "@/components/RequestIncentiveButton";
import { prettyDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending_manager:   { label: "Awaiting manager", cls: "bg-warning-50 text-warning-600" },
  manager_confirmed: { label: "Awaiting HR",      cls: "bg-brand-50 text-brand-700" },
  hr_approved:       { label: "Approved",         cls: "bg-success-50 text-success-600" },
  hr_rejected:       { label: "Declined by HR",   cls: "bg-danger-50 text-danger-600" },
  rejected:          { label: "Rejected",         cls: "bg-danger-50 text-danger-600" },
  initiated:         { label: "Paid",             cls: "bg-brand-600/10 font-semibold text-brand-700" },
};
function money(amount: number | null, currency: string | null) {
  if (amount === null || amount === undefined) return "—";
  const sym = currency === "USD" ? "$" : "₹";
  return `${sym}${Number(amount).toLocaleString(currency === "USD" ? "en-US" : "en-IN")}`;
}

export default async function AiRewards() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if ((me as any).role !== "ai_team") redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: mine }, { data: requests }] = await Promise.all([
    admin.from("fetched_profiles").select("id, status, created_at").eq("owner_id", me.id),
    admin.from("reward_requests")
      .select("id, status, candidate_name, job_title, client_name, vendor_name, rate_closed, other_details, amount, currency, hr_comment, note, created_at, hr_decided_at, initiated_at")
      .eq("recruiter_id", me.id).order("created_at", { ascending: false }),
  ]);

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

  const reqs = (requests ?? []) as any[];
  const APPROVED = new Set(["hr_approved", "initiated"]);
  let claimedINR = 0, claimedUSD = 0, pending = 0;
  for (const r of reqs) {
    if (APPROVED.has(r.status)) { if (r.currency === "USD") claimedUSD += Number(r.amount) || 0; else claimedINR += Number(r.amount) || 0; }
    if (r.status === "pending_manager" || r.status === "manager_confirmed") pending++;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rewards</h1>
          <p className="text-sm text-muted">Your incentives and sourcing achievements.</p>
        </div>
        <RequestIncentiveButton />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Incentives claimed (INR)" value={money(claimedINR, "INR")} tone="success" />
        <Stat label="Incentives claimed (USD)" value={money(claimedUSD, "USD")} tone="success" />
        <Stat label="Pending requests" value={pending} />
        <Stat label="Total requests" value={reqs.length} />
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Incentive requests</h2>
        {reqs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No incentive requests yet — use “Request incentive” above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr><th className="py-2 pr-3">Candidate / closure</th><th className="pr-3 text-right">Incentive</th><th className="pr-3">Status</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {reqs.map((r) => {
                  const s = STATUS[r.status] ?? { label: r.status, cls: "bg-canvas text-muted" };
                  return (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{r.candidate_name ?? "—"}</div>
                        {r.job_title && <div className="text-xs text-muted">{r.job_title}{r.client_name ? ` · ${r.client_name}` : ""}{r.vendor_name ? ` · vendor: ${r.vendor_name}` : ""}</div>}
                        {r.rate_closed && <div className="text-xs text-muted">Rate: {r.rate_closed}</div>}
                        {r.other_details && <div className="text-xs text-muted">{r.other_details}</div>}
                        {r.hr_comment && <div className="mt-0.5 text-xs text-danger-600">“{r.hr_comment}”</div>}
                      </td>
                      <td className="pr-3 text-right font-medium">{money(r.amount, r.currency)}</td>
                      <td className="pr-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span></td>
                      <td className="whitespace-nowrap text-xs text-muted">{prettyDate((r.initiated_at ?? r.hr_decided_at ?? r.created_at).slice(0, 10), { weekday: "short" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
            const pctv = Math.min(100, Math.round((b.value / b.target) * 100));
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
                <div className="mt-3 h-2 w-full rounded-full bg-line"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${pctv}%` }} /></div>
                <div className="mt-1 text-right text-xs text-muted">{Math.min(b.value, b.target)}/{b.target}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "success" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 elevate">
      <div className={`text-2xl font-bold ${tone === "success" ? "text-success-600" : "text-ink"}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
