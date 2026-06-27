"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { parseCsv, rowToFetched, toCsvUrl, isValidStatus } from "@/lib/fetchedProfiles";

const AI_EDITABLE = ["candidate_name", "linkedin_url", "location", "email", "phone", "open_to_work", "ownership", "status"];

// AI team / admin edit any field on a parsed candidate (recruiters can only change status).
export async function aiUpdateProfile(id: string, patch: Record<string, any>) {
  const me = await getProfile();
  if (!me || (me.role !== "ai_team" && me.role !== "admin")) return { ok: false as const, error: "Not authorized" };
  const clean: Record<string, any> = {};
  for (const k of AI_EDITABLE) if (k in patch) clean[k] = patch[k];
  if (Object.keys(clean).length === 0) return { ok: false as const, error: "Nothing to update" };
  if ("status" in clean && !isValidStatus(clean.status)) return { ok: false as const, error: "Invalid status" };
  const now = new Date().toISOString();
  clean.updated_at = now;
  if ("status" in clean) clean.status_changed_at = now;
  const admin = createAdminClient();
  const { error } = await admin.from("fetched_profiles").update(clean).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/ai"); revalidatePath("/dashboard");
  return { ok: true as const };
}

// AI team / admin replace or delete a parsed candidate's resume.
export async function aiSetResume(id: string, url: string | null) {
  const me = await getProfile();
  if (!me || (me.role !== "ai_team" && me.role !== "admin")) return { ok: false as const, error: "Not authorized" };
  const admin = createAdminClient();
  const { error } = await admin.from("fetched_profiles").update({ resume_url: url, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/ai"); revalidatePath("/dashboard");
  return { ok: true as const };
}

// Resolve raw CSV text from either an uploaded file's text or a sheet/CSV link.
async function resolveText(input: { csvText?: string; link?: string }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let text = (input.csvText ?? "").trim();
  if (!text && input.link) {
    try {
      const res = await fetch(toCsvUrl(input.link), { redirect: "follow" });
      if (!res.ok) return { ok: false, error: `Couldn't read the sheet (HTTP ${res.status}). Share it as “anyone with the link”.` };
      text = await res.text();
      if (text.trim().startsWith("<")) return { ok: false, error: "That link returned a web page, not CSV. Share the sheet (anyone with the link) or use a CSV export link." };
    } catch (e: any) {
      return { ok: false, error: "Couldn't fetch the link: " + (e?.message ?? "unknown error") };
    }
  }
  if (!text) return { ok: false, error: "Provide a sheet/CSV link or upload a CSV file." };
  return { ok: true, text };
}

// Parse a sheet/CSV (no DB write) so the AI team can review the tabulated rows before importing.
export async function previewFetched(input: { csvText?: string; link?: string }) {
  const me = await getProfile();
  if (!me || (me.role !== "ai_team" && me.role !== "admin")) return { ok: false as const, error: "Not authorized" };
  const t = await resolveText(input);
  if (!t.ok) return { ok: false as const, error: t.error };
  const rows = parseCsv(t.text).map(rowToFetched).filter((r) => r.candidate_name || r.email || r.linkedin_url);
  if (rows.length === 0) return { ok: false as const, error: "No candidate rows found — check the column headers." };
  return { ok: true as const, rows };
}

// AI team imports candidate rows from a sheet/CSV link or an uploaded CSV's text,
// creates fetched_profiles (all starting at "Yet to review"), assigns ALL rows to ALL POCs, notifies them.
export async function importFetchedProfiles(input: { csvText?: string; link?: string; requirementId?: string | null; pocIds: string[] }) {
  const me = await getProfile();
  if (!me || (me.role !== "ai_team" && me.role !== "admin")) return { ok: false as const, error: "Not authorized" };
  const pocIds = Array.from(new Set((input.pocIds ?? []).filter(Boolean)));
  if (pocIds.length === 0) return { ok: false as const, error: "Pick at least one POC recruiter." };

  const t = await resolveText(input);
  if (!t.ok) return { ok: false as const, error: t.error };
  const rows = parseCsv(t.text).map(rowToFetched).filter((r) => r.candidate_name || r.email || r.linkedin_url);
  if (rows.length === 0) return { ok: false as const, error: "No candidate rows found — check the column headers." };

  const admin = createAdminClient();
  const inserted: string[] = [];
  for (const r of rows) {
    const { data, error } = await admin.from("fetched_profiles").insert({
      requirement_id: input.requirementId || null, ai_team_id: me.id,
      candidate_name: r.candidate_name, linkedin_url: r.linkedin_url, location: r.location,
      email: r.email, phone: r.phone, open_to_work: r.open_to_work, ownership: r.ownership,
      status: "yet_to_review", // every imported candidate waits for a recruiter to review
    }).select("id").single();
    if (!error && data) inserted.push((data as { id: string }).id);
  }
  if (inserted.length === 0) return { ok: false as const, error: "Could not save the rows." };

  const links = inserted.flatMap((pid) => pocIds.map((rid) => ({ fetched_profile_id: pid, recruiter_id: rid })));
  await admin.from("fetched_profile_pocs").insert(links);

  await notify({
    userIds: pocIds, type: "message", title: "New AI-team profiles to review",
    body: `${inserted.length} candidate profile${inserted.length === 1 ? "" : "s"} were assigned to you to review.`,
    link: "/dashboard",
  });

  revalidatePath("/ai");
  revalidatePath("/dashboard");
  return { ok: true as const, count: inserted.length };
}
