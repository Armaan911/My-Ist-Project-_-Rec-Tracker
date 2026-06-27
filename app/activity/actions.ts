"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { evaluateAndAward } from "@/lib/badges";
import { notifyApprovalRequest } from "@/lib/notify";
import { istDateStr } from "@/lib/dates";
import { getDailyItems, isDayLocked, saveDailyItems } from "@/lib/dailyData";
import type { DailyItem, DailyItemInput } from "@/lib/types";

// A recruiter may file at most ONE approval request per calendar day (IST).
const ONE_PER_DAY_MSG = "You can only send one approval request per day — you've already sent one today. Please try again tomorrow.";
async function hasRequestedToday(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const startIst = `${istDateStr()}T00:00:00+05:30`; // start of today in IST
  const { count } = await supabase
    .from("change_requests").select("id", { count: "exact", head: true })
    .eq("recruiter_id", userId).gte("created_at", startIst);
  return (count ?? 0) >= 1;
}

// ---- NEW: per-requirement daily updates (multiple requirements per day) ----

// Load saved items for a given date (used when the recruiter switches the date picker).
export async function loadDailyForDate(date: string): Promise<{ items: DailyItem[]; locked: boolean }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], locked: false };
  const items = await getDailyItems(supabase, user.id, date);
  const today = istDateStr();
  const locked = date < today || (await isDayLocked(supabase, user.id, date));
  return { items, locked };
}

// Save a day's per-requirement items. Past days (or locked days) route to the
// admin approval queue instead of writing directly.
export async function saveDailyItemsAction(date: string, items: DailyItemInput[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const today = istDateStr();
  const locked = date < today || (await isDayLocked(supabase, user.id, date));

  if (locked) {
    if (await hasRequestedToday(supabase, user.id)) return { ok: false, error: ONE_PER_DAY_MSG };
    const { error } = await supabase.from("change_requests").insert({
      entity_type: "daily_activity_item",
      entity_id: user.id,
      recruiter_id: user.id,
      payload: { date, items },
      reason: "Edit to a locked (past) day",
    });
    if (error) return { ok: false, error: error.message };
    await notifyApprovalRequest({ recruiterId: user.id, what: "Daily update edit", forDate: date });
    revalidatePath("/dashboard");
    return { ok: true, queued: true };
  }

  const res = await saveDailyItems(supabase, user.id, date, items);
  if (!res.ok) return res;
  await evaluateAndAward(user.id);
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---- legacy aggregate form (kept for backward compatibility) ----

type ActivityInput = {
  activity_date: string;        // 'YYYY-MM-DD'
  resumes_sourced: number;
  applicants_parsed: number;
  internal_submissions: number;
  client_submissions: number;
  notes: string;
};

// Save today's activity. If the target date row is locked (a past day),
// we DON'T edit it directly — we file a change_request for admin approval.
export async function saveActivity(input: ActivityInput) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles").select("division_id").eq("id", user.id).single();
  if (!profile?.division_id) return { ok: false, error: "No division set on your profile" };

  const { data: existing } = await supabase
    .from("daily_activity").select("id, is_locked")
    .eq("recruiter_id", user.id).eq("activity_date", input.activity_date).maybeSingle();

  if (existing?.is_locked) {
    if (await hasRequestedToday(supabase, user.id)) return { ok: false, error: ONE_PER_DAY_MSG };
    const { error } = await supabase.from("change_requests").insert({
      entity_type: "daily_activity",
      entity_id: existing.id,
      recruiter_id: user.id,
      payload: input,
      reason: "Edit to a locked (past) day",
    });
    if (error) return { ok: false, error: error.message };
    await notifyApprovalRequest({ recruiterId: user.id, what: "Daily activity edit", forDate: input.activity_date });
    revalidatePath("/dashboard");
    return { ok: true, queued: true };
  }

  const { error } = await supabase.from("daily_activity").upsert(
    {
      recruiter_id: user.id,
      division_id: profile.division_id,
      activity_date: input.activity_date,
      resumes_sourced: input.resumes_sourced,
      applicants_parsed: input.applicants_parsed,
      internal_submissions: input.internal_submissions,
      client_submissions: input.client_submissions,
      notes: input.notes,
    },
    { onConflict: "recruiter_id,activity_date" }
  );
  if (error) return { ok: false, error: error.message };
  await evaluateAndAward(user.id); // consistency badge tracks logged days
  revalidatePath("/dashboard");
  return { ok: true };
}
