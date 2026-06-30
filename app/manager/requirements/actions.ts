"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyAllocation } from "@/lib/notify";

type Me = { id: string; role: string; division_id: string | null };
async function gate(): Promise<{ ok: true; me: Me } | { ok: false; error: string }> {
  const me = (await getProfile()) as Me | null;
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, error: "Not authorized" };
  return { ok: true, me };
}
const path = "/manager/requirements";

// Managers oversee ALL divisions here, so we use the service-role client (gated by role above).
// Requirement CREATION stays admin-only; managers may allocate to any recruiter.

export async function createClientCompany(input: { name: string; division_id: string | null }) {
  const g = await gate(); if (!g.ok) return g;
  if (g.me.role !== "admin") return { ok: false, error: "Only an admin can add clients." };
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("clients").insert({ name: input.name, division_id: input.division_id || null }).select("id").single();
  if (error) return { ok: false, error: error.message };
  await logAudit(g.me.id, "client.create", "clients", data.id, { name: input.name });
  revalidatePath(path);
  return { ok: true };
}

export async function createRequirement(_input: { division_id: string; client_id: string | null; title: string; job_code: string; positions: number; priority: string; status: string; date_received: string }) {
  const g = await gate(); if (!g.ok) return g;
  // Managers cannot create requirements — admins do that from the Admin area.
  if (g.me.role !== "admin") return { ok: false, error: "Only an admin can create requirements." };
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("requirements").insert({
    division_id: _input.division_id, client_id: _input.client_id || null, title: _input.title, job_code: _input.job_code?.trim() || null,
    positions: _input.positions, priority: _input.priority || null, status: _input.status as any, date_received: _input.date_received,
  }).select("id").single();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, error: `A requirement with job code "${_input.job_code?.trim()}" already exists.` };
    return { ok: false, error: error.message };
  }
  await logAudit(g.me.id, "requirement.create", "requirements", data.id, { title: _input.title });
  revalidatePath(path);
  return { ok: true };
}

// Managers may assign ANY requirement to ANY recruiter who belongs to that requirement's
// division. Cross-division allocation (e.g. a US req to an India-only recruiter) is blocked.
export async function allocate(input: { requirement_id: string; recruiter_id: string }) {
  const g = await gate(); if (!g.ok) return g;
  const supabase = createAdminClient();

  const { data: req } = await supabase.from("requirements").select("division_id, title, job_code, divisions(name)").eq("id", input.requirement_id).single();
  if (!req) return { ok: false, error: "Requirement not found." };
  const { data: membership } = await supabase
    .from("profile_divisions").select("division_id").eq("profile_id", input.recruiter_id).eq("division_id", req.division_id).maybeSingle();
  if (!membership) {
    const divName = (req as any).divisions?.name ?? "another";
    return { ok: false, error: `This recruiter is not in the ${divName} division, so this requirement can't be allocated to them. Add the division to their profile first, or pick a recruiter in ${divName}.` };
  }

  const { data, error } = await supabase.from("allocations").insert({
    requirement_id: input.requirement_id, recruiter_id: input.recruiter_id,
    allocation_date: new Date().toISOString().slice(0, 10), allocated_by: g.me.id,
  }).select("id").single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That recruiter is already assigned to this requirement." };
    return { ok: false, error: error.message };
  }
  await logAudit(g.me.id, "allocation.create", "requirements", input.requirement_id, { recruiter_id: input.recruiter_id, by: g.me.role });
  await notifyAllocation({ recruiterId: input.recruiter_id, requirementTitle: (req as any).title ?? "a requirement", jobCode: (req as any).job_code ?? null });
  revalidatePath(path);
  return { ok: true, id: data.id };
}

// Client management is admin-only (managers don't create/edit clients); these gate to admin.
export async function updateClient(input: { id: string; name: string; division_id: string | null }) {
  const g = await gate(); if (!g.ok) return g;
  if (g.me.role !== "admin") return { ok: false, error: "Only an admin can edit clients." };
  const supabase = createAdminClient();
  const { error } = await supabase.from("clients").update({ name: input.name.trim(), division_id: input.division_id }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(path);
  return { ok: true };
}

export async function deleteClient(id: string) {
  const g = await gate(); if (!g.ok) return g;
  if (g.me.role !== "admin") return { ok: false, error: "Only an admin can delete clients." };
  const supabase = createAdminClient();
  await supabase.from("requirements").update({ client_id: null }).eq("client_id", id);
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(path);
  return { ok: true };
}

export async function updateRequirement(input: { id: string; title: string; job_code: string; positions: number; priority: string; status: string }) {
  const g = await gate(); if (!g.ok) return g;
  const supabase = createAdminClient();
  const { error } = await supabase.from("requirements").update({ title: input.title, job_code: input.job_code?.trim() || null, positions: input.positions, priority: input.priority || null, status: input.status as any }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  await logAudit(g.me.id, "requirement.update", "requirements", input.id, { status: input.status, by: g.me.role });
  revalidatePath(path);
  return { ok: true };
}

export async function deleteRequirement(id: string) {
  const g = await gate(); if (!g.ok) return g;
  if (g.me.role !== "admin") return { ok: false, error: "Only an admin can delete requirements." };
  const supabase = createAdminClient();
  const { error } = await supabase.from("requirements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(g.me.id, "requirement.delete", "requirements", id, null);
  revalidatePath(path);
  return { ok: true };
}

export async function removeAllocation(id: string) {
  const g = await gate(); if (!g.ok) return g;
  const supabase = createAdminClient();
  const { error } = await supabase.from("allocations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(g.me.id, "allocation.remove", "allocations", id, { by: g.me.role });
  revalidatePath(path);
  return { ok: true };
}
