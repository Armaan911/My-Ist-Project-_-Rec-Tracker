import { redirect } from "next/navigation";
import AvatarWithBadge from "@/components/AvatarWithBadge";
import { medalFor } from "@/lib/medals";
import RequestIncentiveButton from "@/components/RequestIncentiveButton";
import MyGoals from "@/components/MyGoals";
import { StatCard } from "@/components/uikit";
import { Briefcase, Send, Trophy, Target } from "lucide-react";
import { computeRecruiterPacing } from "@/lib/performance";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DailyUpdateEditor from "@/components/DailyUpdateEditor";
import { saveDailyItemsAction, loadDailyForDate } from "@/app/activity/actions";
import { getAllocatedReqs, getDailyItems, getActiveMetrics } from "@/lib/dailyData";
import SubmissionsPanel from "@/components/SubmissionsPanel";
import NavBar from "@/components/NavBar";
import MedalShowcase from "@/components/MedalShowcase";
import FloatingMessages from "@/components/FloatingMessages";
import FetchedProfiles from "@/components/FetchedProfiles";
import ManagerMyDay from "@/components/ManagerMyDay";
import BadgeCelebration from "@/components/BadgeCelebration";
import { Card } from "@/components/ui";
import { istDateStr, addDays, inRange } from "@/lib/dates";
import { computeRecruiterMetrics, badgeProgress, type Badge } from "@/lib/badges";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, division_id, monthly_submission_target, avatar_url")
    .eq("id", user.id).single();

  // HR users live in the incentives dashboard, not the recruiter "My day".
  if (profile?.role === "hr") redirect("/hr");
  // AI team has its own desk.
  if (profile?.role === "ai_team") redirect("/ai");
  // Admins land on the team dashboard.
  if (profile?.role === "admin") redirect("/admin/teams");

  // Managers get a tailored "My day": desk overview instead of a recruiter's logging form.
  if (profile?.role === "manager") {
    return <ManagerDay name={profile.full_name ?? ""} role={profile.role} divisionId={profile.division_id} userId={user.id} avatarUrl={(profile as any)?.avatar_url ?? null} />;
  }

  if (!profile?.division_id) {
    return (
      <>
        <NavBar name={profile?.full_name ?? ""} role={profile?.role ?? "recruiter"} userId={user.id} avatarUrl={(profile as any)?.avatar_url ?? null} isCoordinator={(profile as any)?.is_coordinator ?? false} />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <Card>
            <h1 className="text-xl font-bold">No division assigned</h1>
            <p className="mt-2 text-sm text-muted">
              This page is for recruiters logging daily work, and your account isn&apos;t assigned to a
              division yet — so there&apos;s nothing to log here. An admin can set your division under
              <span className="font-medium text-ink"> Admin → People → Edit</span>. If you&apos;re a manager or
              admin, use the <span className="font-medium text-ink">Team</span> and
              <span className="font-medium text-ink"> Admin</span> areas in the top navigation.
            </p>
          </Card>
        </main>
      </>
    );
  }

  const today = istDateStr();

  const [allocatedReqs, todayItems, dailyMetrics] = await Promise.all([
    getAllocatedReqs(supabase, user.id),
    getDailyItems(supabase, user.id, today),
    getActiveMetrics(supabase),
  ]);

  const [{ data: statuses }, { data: submissions }, { data: closuresRow }, { data: tiers }, { data: messages }] =
    await Promise.all([
      supabase.from("submission_statuses").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("submissions")
        .select("id, candidate_name, current_status_id, submitted_date, current_company, current_title, total_experience, current_location, resume_url, candidate_photo_url, requirements(title)")
        .eq("recruiter_id", user.id).order("submitted_date", { ascending: false }).limit(50),
      supabase.from("v_recruiter_closures").select("closures_all_time, closures_this_month").eq("recruiter_id", user.id).maybeSingle(),
      supabase.from("medal_tiers").select("name, min_closures, color, rank"),
      supabase.from("messages").select("id, subject, body, is_read, created_at, sender:profiles!sender_id(full_name)").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);

  // persistent allocations: active requirements still on the recruiter's plate
  const reqs = allocatedReqs;
  const closuresAll = closuresRow?.closures_all_time ?? 0;
  // Current medal (bronze/silver/gold…) — colours the ring around the avatar.
  const medal = medalFor(closuresAll, (tiers as any) ?? []);

  // ---- achievement badges ----
  const adminCli = createAdminClient();
  const [metrics, { data: allBadges }, { data: myAwards }, myPerf] = await Promise.all([
    computeRecruiterMetrics(adminCli, user.id, today),
    supabase.from("badges").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("recruiter_badges").select("badge_id, period_key, seen_at").eq("recruiter_id", user.id),
    computeRecruiterPacing(adminCli, user.id, today),
  ]);
  const awardCount = new Map<string, number>();
  for (const a of (myAwards ?? []) as any[]) awardCount.set(a.badge_id, (awardCount.get(a.badge_id) ?? 0) + 1);
  const badgeViews = ((allBadges ?? []) as Badge[]).map((b) => {
    const count = awardCount.get(b.id) ?? 0;
    return {
      id: b.id, name: b.name, description: b.description, icon: b.icon, color: b.color,
      earned: count > 0, count, repeatable: b.is_repeatable,
      progress: count > 0 ? null : badgeProgress(b, metrics),
    };
  });
  const newBadgeIds = new Set(((myAwards ?? []) as any[]).filter((a) => !a.seen_at).map((a) => a.badge_id));
  const newBadges = ((allBadges ?? []) as Badge[])
    .filter((b) => newBadgeIds.has(b.id))
    .map((b) => ({ id: b.id, name: b.name, icon: b.icon, color: b.color }));
  // Headline badge for the LinkedIn-style avatar frame: a just-unlocked one wins, else any earned.
  const headlineBadge =
    newBadges[0] ??
    badgeViews.filter((b) => b.earned).map((b) => ({ name: b.name, icon: b.icon, color: b.color }))[0] ??
    null;

  // AI-team fetched profiles assigned to this recruiter (POC).
  const { data: pocLinks } = await adminCli.from("fetched_profile_pocs").select("fetched_profile_id").eq("recruiter_id", user.id);
  const fpIds = ((pocLinks ?? []) as any[]).map((l) => l.fetched_profile_id);
  let fetchedProfiles: any[] = [];
  if (fpIds.length) {
    const { data: fps } = await adminCli.from("fetched_profiles")
      .select("id, candidate_name, linkedin_url, location, email, phone, open_to_work, ownership, status, resume_url, recruiter_comment, requirements(title)")
      .in("id", fpIds).order("created_at", { ascending: false });
    fetchedProfiles = ((fps ?? []) as any[]).map((f) => ({ ...f, requirement_title: (f.requirements as any)?.title ?? null }));
  }

  return (
    <>
      <NavBar name={profile?.full_name ?? ""} role={profile?.role ?? "recruiter"} userId={user.id} avatarUrl={(profile as any)?.avatar_url ?? null} isCoordinator={(profile as any)?.is_coordinator ?? false} />
      <main className="mx-auto max-w-[1500px] px-3 sm:px-5 lg:px-7 py-8">
      <div className="mb-6 flex items-center gap-4">
        <AvatarWithBadge userId={user.id} name={profile?.full_name ?? ""} initialUrl={(profile as any)?.avatar_url ?? null} medalColor={medal?.color ?? null} medalName={medal?.name ?? null} />
        <div>
          <h1 className="text-2xl font-bold">Hi, {profile?.full_name}</h1>
          <p className="text-sm text-muted">Your daily tracker</p>
        </div>
        <div className="ml-auto"><RequestIncentiveButton /></div>
      </div>

      <div className="mb-6">
        <MyGoals pacing={myPerf.pacing} streak={myPerf.streak} activeDays={myPerf.activeDays} scorecard={myPerf.scorecard} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Briefcase size={16} />} label="Reqs allocated" value={reqs.length} />
        <StatCard icon={<Send size={16} />} label="Submissions" value={submissions?.length ?? 0} />
        <StatCard icon={<Trophy size={16} />} label="Closures (all-time)" value={closuresAll} />
        <StatCard accent icon={<Target size={16} />} label="Monthly target" value={profile?.monthly_submission_target ?? "—"} />
      </div>

      <div className="mb-6"><MedalShowcase closuresAll={closuresAll} tiers={(tiers as any) ?? []} /></div>

      {/* Achievements grid moved to the Rewards tab; the unlocked badge still shows on the avatar + as a celebration. */}
      <BadgeCelebration newBadges={newBadges} />

      <div className="space-y-6">
        <FloatingMessages messages={(messages as any) ?? []} />
        <FetchedProfiles items={fetchedProfiles} />
        <SubmissionsPanel
          requirements={reqs}
          statuses={statuses ?? []}
          submissions={(submissions as any) ?? []}
        />
        <Card>
          <DailyUpdateEditor
            reqs={reqs}
            metrics={dailyMetrics}
            date={today}
            initialItems={todayItems}
            locked={false}
            allowDateChange
            greeting="Daily activity counts"
            save={saveDailyItemsAction}
            loadDate={loadDailyForDate}
          />
        </Card>
      </div>
      </main>
    </>
  );
}


// ---- Manager "My day": desk overview, scoped to the manager's division by RLS ----
async function ManagerDay({ name, role, divisionId, userId, avatarUrl }: { name: string; role: string; divisionId: string | null; userId?: string; avatarUrl?: string | null }) {
  // Manager oversees all divisions — read via service-role (this branch only renders for managers).
  const supabase = createAdminClient();
  const today = istDateStr();
  const weekStart = addDays(today, -6); // rolling 7-day window incl. today
  const monthStart = today.slice(0, 7) + "-01";
  const yearStart = today.slice(0, 4) + "-01-01";

  const [
    { data: divisionRow }, { data: requirements }, { data: statuses },
    { data: submissions }, { data: allocations }, { data: recruiters },
    { data: activity }, { data: alerts },
  ] = await Promise.all([
    divisionId ? supabase.from("divisions").select("name").eq("id", divisionId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("requirements").select("id, title, priority, status, date_received, created_at, clients(name)").order("created_at", { ascending: false }),
    supabase.from("submission_statuses").select("id, code, label, sort_order, counts_as_closure").eq("is_active", true),
    supabase.from("submissions").select("id, recruiter_id, current_status_id, submitted_date, last_status_at, candidate_name, requirements(title)"),
    supabase.from("allocations").select("requirement_id"),
    supabase.from("profiles").select("id, full_name").eq("role", "recruiter").eq("is_active", true),
    supabase.from("daily_activity").select("recruiter_id, resumes_sourced, applicants_parsed").eq("activity_date", today),
    supabase.from("alerts").select("id, type, severity, title, body, is_read, created_at").order("is_read").order("created_at", { ascending: false }).limit(20),
  ]);

  const reqs = requirements ?? [];
  const subs = submissions ?? [];
  const statusById = new Map((statuses ?? []).map((s: any) => [s.id, s]));
  const codeOf = (id: string) => statusById.get(id)?.code as string | undefined;
  const isClosure = (id: string) => !!statusById.get(id)?.counts_as_closure;

  // requirement status counts
  const statusCounts = { open: 0, on_hold: 0, closed: 0, filled: 0, cancelled: 0, total: reqs.length };
  for (const r of reqs as any[]) if (r.status in statusCounts) (statusCounts as any)[r.status]++;

  // newly added (last 7 days)
  const newReqs = (reqs as any[])
    .filter((r) => inRange(r.created_at, weekStart, today))
    .slice(0, 8)
    .map((r) => ({ id: r.id, title: r.title, priority: r.priority, status: r.status, date_received: r.date_received, client: r.clients?.name ?? null }));

  // submission pipeline (by current stage)
  const subCards = { internal: 0, client: 0, tech: 0, closures: 0 };
  for (const s of subs as any[]) {
    const code = codeOf(s.current_status_id);
    if (code === "internal_submitted") subCards.internal++;
    else if (code === "client_submitted") subCards.client++;
    else if (code === "tech_interview") subCards.tech++;
    if (isClosure(s.current_status_id)) subCards.closures++;
  }

  // performance by period (today / week / month / year) so the manager can switch the lens
  const nameById = new Map(((recruiters ?? []) as any[]).map((r) => [r.id, r.full_name]));
  function periodPerf(start: string, end: string, label: string) {
    const perRec: Record<string, { subs: number; closures: number }> = {};
    for (const r of (recruiters ?? []) as any[]) perRec[r.id] = { subs: 0, closures: 0 };
    let submissions = 0, closures = 0;
    for (const s of subs as any[]) {
      if (inRange(s.submitted_date, start, end)) { submissions++; if (perRec[s.recruiter_id]) perRec[s.recruiter_id].subs++; }
      if (isClosure(s.current_status_id) && inRange(s.last_status_at, start, end)) { closures++; if (perRec[s.recruiter_id]) perRec[s.recruiter_id].closures++; }
    }
    const ranked = Object.entries(perRec).sort((a, b) => (b[1].closures - a[1].closures) || (b[1].subs - a[1].subs));
    const topPerformer = ranked.length >= 1 && (ranked[0][1].closures > 0 || ranked[0][1].subs > 0) ? nameById.get(ranked[0][0]) ?? null : null;
    const lagging = ranked.length >= 2 ? nameById.get(ranked[ranked.length - 1][0]) ?? null : null;
    return { label, windowLabel: `${start.slice(5)} – ${end.slice(5)}`, submissions, closures, topPerformer, lagging };
  }
  const periods = {
    today: periodPerf(today, today, "Today"),
    week: periodPerf(weekStart, today, "This week"),
    month: periodPerf(monthStart, today, "This month"),
    year: periodPerf(yearStart, today, "This year"),
  };

  // open requirements with nobody assigned yet
  const allocatedReqIds = new Set(((allocations ?? []) as any[]).map((a) => a.requirement_id));
  const unallocated = (reqs as any[])
    .filter((r) => r.status === "open" && !allocatedReqIds.has(r.id))
    .slice(0, 8)
    .map((r) => ({ id: r.id, title: r.title, priority: r.priority, date_received: r.date_received, client: r.clients?.name ?? null }));

  // team activity today
  const activityBy = new Map(((activity ?? []) as any[]).map((a) => [a.recruiter_id, a]));
  const team = ((recruiters ?? []) as any[]).map((r) => {
    const a = activityBy.get(r.id);
    return { id: r.id, name: r.full_name, logged: !!a, resumes: a?.resumes_sourced ?? 0, parsed: a?.applicants_parsed ?? 0 };
  });

  // Per-box drill-down: who did what (clicking a stat box opens this breakup).
  const recName = (id: string) => nameById.get(id) ?? "—";
  const subItem = (s: any, dateField: string) => ({ recruiter: recName(s.recruiter_id), candidate: s.candidate_name ?? "—", requirement: (s.requirements as any)?.title ?? "—", date: (s[dateField] ?? "").slice(0, 10) });
  const reqItem = (r: any) => ({ title: r.title, priority: r.priority ?? null, client: (r.clients as any)?.name ?? null, status: r.status });
  const breakdown = {
    internal: (subs as any[]).filter((s) => codeOf(s.current_status_id) === "internal_submitted").map((s) => subItem(s, "submitted_date")),
    client: (subs as any[]).filter((s) => codeOf(s.current_status_id) === "client_submitted").map((s) => subItem(s, "submitted_date")),
    tech: (subs as any[]).filter((s) => codeOf(s.current_status_id) === "tech_interview").map((s) => subItem(s, "submitted_date")),
    closures: (subs as any[]).filter((s) => isClosure(s.current_status_id)).map((s) => subItem(s, "last_status_at")),
    reqOpen: (reqs as any[]).filter((r) => r.status === "open").map(reqItem),
    reqOnHold: (reqs as any[]).filter((r) => r.status === "on_hold").map(reqItem),
    reqClosed: (reqs as any[]).filter((r) => r.status === "closed").map(reqItem),
    reqTotal: (reqs as any[]).map(reqItem),
  };

  const data = {
    name,
    divisionName: (divisionRow as any)?.name ?? null,
    newReqs,
    statusCounts,
    subCards,
    periods,
    unallocated,
    team,
    alerts: (alerts as any) ?? [],
    breakdown,
  };

  return (
    <>
      <NavBar name={name} role={role} userId={userId} avatarUrl={avatarUrl} />
      <main className="mx-auto max-w-[1500px] px-3 sm:px-5 lg:px-7 py-8">
        <ManagerMyDay data={data} />
      </main>
    </>
  );
}
