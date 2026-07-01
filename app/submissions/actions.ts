"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { evaluateAndAward } from "@/lib/badges";
import { createRewardOnClosure } from "@/lib/rewards";

type CandidateFields = {
  candidate_email?: string;
  phone?: string;
  current_location?: string;
  total_experience?: string;   // form sends string; coerced to number/null below
  current_company?: string;
  current_title?: string;
  current_ctc?: string;
  expected_ctc?: string;
  notice_period?: string;
  source?: string;
  key_skills?: string;
  resume_url?: string;
  linkedin_url?: string;
  candidate_photo_url?: string;
};

export async function createSubmission(input: {
  requirement_id: string;
  candidate_name: string;
  status_id: string;
  submitted_date: string;
} & CandidateFields) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles").select("division_id").eq("id", user.id).single();
  if (!profile?.division_id) return { ok: false, error: "No division set" };

  const exp = input.total_experience ? Number(input.total_experience) : null;
  const { data: sub, error } = await supabase.from("submissions").insert({
    recruiter_id: user.id,
    requirement_id: input.requirement_id,
    division_id: profile.division_id,
    candidate_name: input.candidate_name,
    candidate_email: input.candidate_email || null,
    phone: input.phone || null,
    current_location: input.current_location || null,
    total_experience: Number.isFinite(exp as number) ? exp : null,
    current_company: input.current_company || null,
    current_title: input.current_title || null,
    current_ctc: input.current_ctc || null,
    expected_ctc: input.expected_ctc || null,
    notice_period: input.notice_period || null,
    source: input.source || null,
    key_skills: input.key_skills || null,
    resume_url: input.resume_url || null,
    linkedin_url: input.linkedin_url || null,
    candidate_photo_url: input.candidate_photo_url || null,
    current_status_id: input.status_id,
    submitted_date: input.submitted_date,
  }).select("id").single();
  if (error) {
    if ((error as { code?: string }).code === "23505")
      return { ok: false, error: "This candidate has already been submitted for this requirement (same LinkedIn URL)." };
    return { ok: false, error: error.message };
  }

  await supabase.from("submission_status_history").insert({
    submission_id: sub.id,
    old_status_id: null,
    new_status_id: input.status_id,
    changed_by: user.id,
  });

  await evaluateAndAward(user.id); // award any newly-earned badges

  const { data: st0 } = await supabase.from("submission_statuses").select("counts_as_closure").eq("id", input.status_id).maybeSingle();
  if ((st0 as { counts_as_closure?: boolean } | null)?.counts_as_closure) {
    await createRewardOnClosure(sub.id, user.id);
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

// Move a submission to a new pipeline stage (this is how closures get recorded).
// Works for past entries too — the whole point of the lifecycle.
export async function updateSubmissionStatus(submission_id: string, new_status_id: string, note?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: current } = await supabase
    .from("submissions").select("current_status_id").eq("id", submission_id).single();

  const { error } = await supabase.from("submissions")
    .update({ current_status_id: new_status_id, last_status_at: new Date().toISOString() })
    .eq("id", submission_id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("submission_status_history").insert({
    submission_id,
    old_status_id: current?.current_status_id ?? null,
    new_status_id,
    changed_by: user.id,
    note: note || null,
  });

  await evaluateAndAward(user.id); // closures/placements may unlock badges

  // Entering a closure stage kicks off the reward workflow (idempotent per submission).
  const { data: st } = await supabase.from("submission_statuses").select("counts_as_closure").eq("id", new_status_id).maybeSingle();
  if ((st as { counts_as_closure?: boolean } | null)?.counts_as_closure) {
    await createRewardOnClosure(submission_id, user.id);
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteSubmission(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("submissions").delete().eq("id", id); // RLS: own only
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateSubmissionName(id: string, candidate_name: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("submissions").update({ candidate_name }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

// Edit the submitted (past) date of a submission.
export async function updateSubmissionDate(id: string, submitted_date: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(submitted_date)) return { ok: false, error: "Invalid date" };
  const { error } = await supabase.from("submissions").update({ submitted_date }).eq("id", id); // RLS: own only
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

import { createAdminClient } from "@/lib/supabase/admin";

export type DuplicateHit = {
  candidate_name: string; recruiter: string; requirement: string; status: string;
  submitted_date: string; matchedOn: ("email" | "phone" | "linkedin")[];
};

const normLinkedIn = (u: string) => (u || "").trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");

// Org-wide duplicate check: has this candidate (by email, phone, or LinkedIn URL) already
// been submitted — by anyone, on any requirement? Surfaces it before a recruiter re-submits
// the same candidate (e.g. the same LinkedIn URL) for a different requirement.
export async function findDuplicateSubmissions(email: string, phone: string, linkedin = ""): Promise<{ ok: boolean; hits: DuplicateHit[] }> {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return { ok: false, hits: [] };

  const e = (email || "").trim().toLowerCase();
  const pDigits = (phone || "").replace(/\D/g, "");
  const li = normLinkedIn(linkedin);
  if (e.length < 3 && pDigits.length < 6 && li.length < 5) return { ok: true, hits: [] };

  const admin = createAdminClient();
  const { data } = await admin
    .from("submissions")
    .select("candidate_name, candidate_email, phone, linkedin_url, submitted_date, profiles(full_name), requirements(title), submission_statuses(label)")
    .order("submitted_date", { ascending: false })
    .limit(500);

  const hits: DuplicateHit[] = [];
  for (const s of (data ?? []) as any[]) {
    const matched: ("email" | "phone" | "linkedin")[] = [];
    if (e.length >= 3 && (s.candidate_email || "").trim().toLowerCase() === e) matched.push("email");
    const sp = (s.phone || "").replace(/\D/g, "");
    if (pDigits.length >= 6 && sp.length >= 6 && sp.slice(-10) === pDigits.slice(-10)) matched.push("phone");
    if (li.length >= 5 && normLinkedIn(s.linkedin_url) === li) matched.push("linkedin");
    if (matched.length) {
      hits.push({
        candidate_name: s.candidate_name, recruiter: s.profiles?.full_name ?? "—",
        requirement: s.requirements?.title ?? "—", status: s.submission_statuses?.label ?? "—",
        submitted_date: s.submitted_date, matchedOn: matched,
      });
    }
    if (hits.length >= 8) break;
  }
  return { ok: true, hits };
}
