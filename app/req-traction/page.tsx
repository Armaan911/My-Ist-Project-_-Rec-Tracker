import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NavBar from "@/components/NavBar";
import ReqTraction from "@/components/ReqTraction";
import { istDateStr, weekBuckets, inRange } from "@/lib/dates";

export const dynamic = "force-dynamic";

const DAY = 86400000;

export default async function ReqTractionPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name, role, avatar_url, is_coordinator").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) redirect("/dashboard");

  const admin = createAdminClient();
  const today = istDateStr();
  const [{ data: reqs }, { data: statuses }, { data: subs }, { data: recruiters }, { data: divisions }] = await Promise.all([
    admin.from("requirements").select("id, title, job_code, positions, priority, date_received, status, division_id, clients(name)").eq("status", "open").order("date_received", { ascending: true }),
    admin.from("submission_statuses").select("id, code, label, counts_as_closure, is_rejection, sort_order").order("sort_order"),
    admin.from("submissions").select("requirement_id, recruiter_id, current_status_id, submitted_date, last_status_at"),
    admin.from("profiles").select("id, full_name"),
    admin.from("divisions").select("id, name"),
  ]);

  const nameOf = new Map((recruiters ?? []).map((r: any) => [r.id, r.full_name]));
  const divName = new Map((divisions ?? []).map((d: any) => [d.id, d.name]));
  const sList = (statuses ?? []) as any[];
  const closure = new Set(sList.filter((s) => s.counts_as_closure).map((s) => s.id));
  const rej = new Set(sList.filter((s) => s.is_rejection).map((s) => s.id));
  const labelOf = new Map(sList.map((s) => [s.id, s.label]));
  const rrId = sList.find((s) => s.code === "internal_submitted")?.id;
  const clientId = sList.find((s) => s.code === "client_submitted")?.id;

  const subsByReq = new Map<string, any[]>();
  for (const s of (subs ?? []) as any[]) {
    if (!s.requirement_id) continue;
    const list = subsByReq.get(s.requirement_id);
    if (list) list.push(s); else subsByReq.set(s.requirement_id, [s]);
  }

  const weeks = weekBuckets(today, 8);

  const cards = ((reqs ?? []) as any[]).map((r) => {
    const rs = subsByReq.get(r.id) ?? [];
    const ageDays = Math.max(0, Math.round((Date.parse(today) - Date.parse(r.date_received)) / DAY));

    let total = 0, closures = 0, rejections = 0, rrTotal = 0, clientTotal = 0;
    let firstSub: string | null = null, lastAct: string | null = null;
    const stageCount = new Map<string, number>();
    const recMap = new Map<string, { rr: number; client: number }>();
    const recTotal = new Map<string, number>();
    const recSet = new Set<string>();
    for (const s of rs) {
      total++;
      const lbl = labelOf.get(s.current_status_id) ?? "Other";
      stageCount.set(lbl, (stageCount.get(lbl) ?? 0) + 1);
      const nm = nameOf.get(s.recruiter_id) ?? "Unknown";
      const cur = recMap.get(nm) ?? { rr: 0, client: 0 };
      if (s.current_status_id === rrId) { cur.rr++; rrTotal++; }
      if (s.current_status_id === clientId) { cur.client++; clientTotal++; }
      recMap.set(nm, cur);
      recTotal.set(nm, (recTotal.get(nm) ?? 0) + 1);
      if (s.recruiter_id) recSet.add(s.recruiter_id);
      if (closure.has(s.current_status_id)) closures++;
      if (rej.has(s.current_status_id)) rejections++;
      if (s.submitted_date && (!firstSub || s.submitted_date < firstSub)) firstSub = s.submitted_date;
      const act = s.last_status_at ?? s.submitted_date;
      if (act && (!lastAct || act > lastAct)) lastAct = act;
    }

    const byStage = sList.filter((s) => stageCount.has(s.label)).map((s) => ({ stage: s.label, count: stageCount.get(s.label)! }));
    const byRecruiter = [...recMap.entries()].map(([name, v]) => ({ name, rr: v.rr, client: v.client }))
      .sort((a, b) => (b.rr + b.client) - (a.rr + a.client));
    const topEntry = [...recTotal.entries()].sort((a, b) => b[1] - a[1])[0];
    const topRecruiter = topEntry ? { name: topEntry[0], count: topEntry[1] } : null;
    const weeksOpen = Math.max(1, ageDays / 7);
    const daysSinceActivity = lastAct ? Math.max(0, Math.round((Date.parse(today) - Date.parse(lastAct)) / DAY)) : null;
    const timeToFirstSub = firstSub ? Math.max(0, Math.round((Date.parse(firstSub) - Date.parse(r.date_received)) / DAY)) : null;
    const trend = weeks.map((w) => ({
      week: w.label,
      submissions: rs.filter((s) => inRange(s.submitted_date, w.start, w.end)).length,
      closures: rs.filter((s) => closure.has(s.current_status_id) && inRange(s.last_status_at, w.start, w.end)).length,
    }));
    const fill = [
      { name: "Closed", value: Math.min(closures, r.positions ?? closures), color: "#16a34a" },
      { name: "Open", value: Math.max(0, (r.positions ?? 0) - closures), color: "#e2e8f0" },
    ];

    return {
      id: r.id, title: r.title, jobCode: r.job_code ?? null, client: r.clients?.name ?? null,
      division: divName.get(r.division_id) ?? null, priority: r.priority ?? null, positions: r.positions ?? 0,
      dateReceived: r.date_received, ageDays, total, closures, rejections, rrTotal, clientTotal,
      positionsRemaining: Math.max(0, (r.positions ?? 0) - closures),
      activeRecruiters: recSet.size, topRecruiter, daysSinceActivity, timeToFirstSub,
      weeklyVelocity: Math.round((total / weeksOpen) * 10) / 10,
      conversionRate: total ? Math.round((closures / total) * 100) : 0,
      rejectionRate: total ? Math.round((rejections / total) * 100) : 0,
      rrToClient: rrTotal ? Math.round((clientTotal / rrTotal) * 100) : null,
      fillRate: r.positions ? Math.round((closures / r.positions) * 100) : null,
      byStage, byRecruiter, trend, fill,
    };
  });

  return (
    <>
      <NavBar name={profile.full_name ?? ""} role={profile.role} userId={user.id} avatarUrl={(profile as any).avatar_url ?? null} isCoordinator={(profile as any).is_coordinator ?? false} />
      <main className="mx-auto max-w-[1500px] space-y-6 px-3 py-8 sm:px-5 lg:px-7">
        <ReqTraction cards={cards} />
      </main>
    </>
  );
}
