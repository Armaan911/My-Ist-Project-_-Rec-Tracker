import type { SupabaseClient } from "@supabase/supabase-js";
import type { AllocatedReq, DailyItem, DailyItemInput, DailyMetric } from "@/lib/types";

// Which daily-metric keys roll up into the legacy daily_activity summary columns,
// so badges (activity_days_week) + the manager "logged today" indicator keep working
// even as the metric list changes.
const SUMMARY_MAP: Record<string, "resumes_sourced" | "applicants_parsed" | "internal_submissions" | "client_submissions"> = {
  profiles_sourced: "resumes_sourced",
  resumes_parsed: "applicants_parsed",
  internal_submissions: "internal_submissions",
  client_submissions: "client_submissions",
};

// The admin-configured metrics recruiters log against, in display order.
export async function getActiveMetrics(db: SupabaseClient): Promise<DailyMetric[]> {
  const { data } = await db
    .from("daily_metrics")
    .select("id, key, label, hint, color, icon, input_style, soft_max, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as DailyMetric[];
}

// Pull the requirements a recruiter can log against (their persistent allocations),
// enriched for the dropdown. Concluded reqs (closed/cancelled/filled) are hidden from
// recruiters — they only see live work they can still act on.
export async function getAllocatedReqs(db: SupabaseClient, recruiterId: string): Promise<AllocatedReq[]> {
  const { data } = await db
    .from("allocations")
    .select("requirement_id, requirements(id, title, job_code, status, division_id, divisions(name), clients(name))")
    .eq("recruiter_id", recruiterId);

  const seen = new Set<string>();
  const out: AllocatedReq[] = [];
  for (const a of (data ?? []) as any[]) {
    const r = a.requirements;
    if (!r || seen.has(r.id)) continue;
    if (r.status === "closed" || r.status === "cancelled" || r.status === "filled") continue;
    seen.add(r.id);
    out.push({
      id: r.id, title: r.title, job_code: r.job_code ?? null, status: r.status,
      division_id: r.division_id, division_name: r.divisions?.name ?? null, client_name: r.clients?.name ?? null,
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

// Existing per-requirement values already saved for this recruiter + date,
// grouped into one DailyItem per requirement (values keyed by metric_id).
export async function getDailyItems(db: SupabaseClient, recruiterId: string, date: string): Promise<DailyItem[]> {
  const { data } = await db
    .from("daily_activity_values")
    .select("requirement_id, metric_id, value, is_locked")
    .eq("recruiter_id", recruiterId)
    .eq("activity_date", date);

  const byReq = new Map<string, DailyItem>();
  for (const row of (data ?? []) as any[]) {
    let item = byReq.get(row.requirement_id);
    if (!item) { item = { requirement_id: row.requirement_id, values: {}, is_locked: false }; byReq.set(row.requirement_id, item); }
    item.values[row.metric_id] = row.value;
    if (row.is_locked) item.is_locked = true;
  }
  return [...byReq.values()];
}

// Whether the day is locked for this recruiter (any saved value locked).
export async function isDayLocked(db: SupabaseClient, recruiterId: string, date: string): Promise<boolean> {
  const { data } = await db
    .from("daily_activity_values")
    .select("is_locked")
    .eq("recruiter_id", recruiterId)
    .eq("activity_date", date);
  return (data ?? []).some((r: any) => r.is_locked);
}

// Map each requirement to the division its effort should count toward.
async function divisionByReq(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (ids.length === 0) return m;
  const { data } = await db.from("requirements").select("id, division_id").in("id", ids);
  for (const r of (data ?? []) as any[]) m.set(r.id, r.division_id);
  return m;
}

// Save (upsert) per-requirement metric values for a recruiter on a date, then re-roll
// the legacy daily_activity summary. `db` must be able to write the rows (RLS for the
// logged-in recruiter, or the service-role client for the no-login forms).
export async function saveDailyItems(
  db: SupabaseClient, recruiterId: string, date: string, items: DailyItemInput[]
): Promise<{ ok: boolean; error?: string }> {
  if (items.length === 0) return { ok: true };

  const reqIds = items.map((i) => i.requirement_id);
  const divMap = await divisionByReq(db, reqIds);

  const rows: any[] = [];
  for (const item of items) {
    const division_id = divMap.get(item.requirement_id);
    if (!division_id) return { ok: false, error: "One of the requirements is missing a division." };
    for (const [metric_id, raw] of Object.entries(item.values)) {
      rows.push({
        recruiter_id: recruiterId,
        requirement_id: item.requirement_id,
        division_id,
        activity_date: date,
        metric_id,
        value: Math.max(0, Math.trunc(raw || 0)),
      });
    }
  }
  if (rows.length === 0) return { ok: true };

  const { error } = await db
    .from("daily_activity_values")
    .upsert(rows, { onConflict: "recruiter_id,requirement_id,activity_date,metric_id" });
  if (error) return { ok: false, error: error.message };

  await rollUpDailySummary(db, recruiterId, date);
  return { ok: true };
}

// Recompute the legacy per-day summary from all values for the date, mapping known
// metric keys into the legacy columns.
export async function rollUpDailySummary(db: SupabaseClient, recruiterId: string, date: string) {
  const { data: all } = await db
    .from("daily_activity_values")
    .select("division_id, value, daily_metrics(key)")
    .eq("recruiter_id", recruiterId)
    .eq("activity_date", date);

  const rows = (all ?? []) as any[];
  if (rows.length === 0) return;

  const sums = { resumes_sourced: 0, applicants_parsed: 0, internal_submissions: 0, client_submissions: 0 };
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.daily_metrics?.key as string | undefined;
    const col = key ? SUMMARY_MAP[key] : undefined;
    if (col) sums[col] += r.value ?? 0;
    counts.set(r.division_id, (counts.get(r.division_id) ?? 0) + 1);
  }
  const division_id = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  await db.from("daily_activity").upsert(
    { recruiter_id: recruiterId, division_id, activity_date: date, ...sums },
    { onConflict: "recruiter_id,activity_date" }
  );
}
