import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NavBar from "@/components/NavBar";
import BadgesPanel from "@/components/BadgesPanel";
import ClosedRateEditor from "@/components/ClosedRateEditor";
import { Card } from "@/components/ui";
import { istDateStr, prettyDate } from "@/lib/dates";
import { computeRecruiterMetrics, badgeProgress, type Badge } from "@/lib/badges";

export const dynamic = "force-dynamic";

// A recruiter's own Rewards: the status of their incentive requests + achievement badges.
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
  const sym = currency === "USD" ? "$" : currency === "INR" ? "₹" : "";
  return `${sym}${Number(amount).toLocaleString(currency === "USD" ? "en-US" : "en-IN")}`;
}

export default async function RewardsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name, role, avatar_url").eq("id", user.id).single();

  const today = istDateStr();
  const admin = createAdminClient();
  const [{ data: requests }, metrics, { data: allBadges }, { data: myAwards }] = await Promise.all([
    admin.from("reward_requests")
      .select("id, source, status, candidate_name, requirement_title, job_title, client_name, vendor_name, rate_closed, other_details, amount, currency, hr_comment, note, created_at, hr_decided_at, initiated_at")
      .eq("recruiter_id", user.id).order("created_at", { ascending: false }),
    computeRecruiterMetrics(admin, user.id, today),
    supabase.from("badges").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("recruiter_badges").select("badge_id, period_key, seen_at").eq("recruiter_id", user.id),
  ]);

  const awardCount = new Map<string, number>();
  for (const a of (myAwards ?? []) as any[]) awardCount.set(a.badge_id, (awardCount.get(a.badge_id) ?? 0) + 1);
  const badgeViews = ((allBadges ?? []) as Badge[]).map((b) => {
    const count = awardCount.get(b.id) ?? 0;
    return { id: b.id, name: b.name, description: b.description, icon: b.icon, color: b.color, earned: count > 0, count, repeatable: b.is_repeatable, progress: count > 0 ? null : badgeProgress(b, metrics) };
  });

  const reqs = (requests ?? []) as any[];

  // Closed rate comes from a newer migration; fetch it tolerantly so the page still
  // renders (and incentives still show) even before the column is applied.
  const { data: crRows, error: crErr } = await admin.from("reward_requests")
    .select("id, closed_rate, closed_rate_currency").eq("recruiter_id", user.id);
  if (!crErr) {
    const crBy = new Map((((crRows ?? []) as any[]).map((r) => [r.id, r])));
    for (const r of reqs) { const c = crBy.get(r.id); r.closed_rate = c?.closed_rate ?? null; r.closed_rate_currency = c?.closed_rate_currency ?? "INR"; }
  }

  return (
    <>
      <NavBar name={profile?.full_name ?? ""} role={profile?.role ?? "recruiter"} userId={user.id} avatarUrl={(profile as any)?.avatar_url ?? null} />
      <main className="mx-auto max-w-[1500px] space-y-8 px-3 py-8 sm:px-5 lg:px-7">
        <div>
          <h1 className="text-2xl font-bold">Rewards</h1>
          <p className="text-sm text-muted">The status of your incentive requests, and your achievement badges.</p>
        </div>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Incentive requests</h2>
          {reqs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No incentive requests yet — use “Request incentive” on your dashboard.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted">
                  <tr><th className="py-2 pr-3">Candidate / closure</th><th className="pr-3">Closed rate</th><th className="pr-3 text-right">Incentive</th><th className="pr-3">Status</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {reqs.map((r) => {
                    const s = STATUS[r.status] ?? { label: r.status, cls: "bg-canvas text-muted" };
                    return (
                      <tr key={r.id} className="border-t border-line align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.candidate_name ?? "—"}</div>
                          {(r.job_title || r.requirement_title) && <div className="text-xs text-muted">{r.job_title ?? r.requirement_title}{r.client_name ? ` · ${r.client_name}` : ""}{r.vendor_name ? ` · vendor: ${r.vendor_name}` : ""}</div>}
                          {r.rate_closed && <div className="text-xs text-muted">Rate: {r.rate_closed}</div>}
                          {r.other_details && <div className="text-xs text-muted">{r.other_details}</div>}
                          {r.hr_comment && <div className="mt-0.5 text-xs text-danger-600">“{r.hr_comment}”</div>}
                        </td>
                        <td className="pr-3">
                          {r.source === "closure"
                            ? <ClosedRateEditor id={r.id} value={r.closed_rate != null ? Number(r.closed_rate) : null} currency={r.closed_rate_currency === "USD" ? "USD" : "INR"} />
                            : <span className="text-muted">—</span>}
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

        <BadgesPanel badges={badgeViews} />
      </main>
    </>
  );
}
