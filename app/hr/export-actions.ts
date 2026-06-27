"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";

const STATUS_LABEL: Record<string, string> = {
  pending_manager: "Awaiting manager",
  manager_confirmed: "Awaiting HR",
  hr_approved: "Approved (payroll notified)",
  hr_rejected: "Declined by HR",
  rejected: "Rejected by manager",
  initiated: "Paid",
};

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Build a CSV of incentives for finance. HR + admin export everything; a manager
// exports only their own division(s).
export async function buildIncentivesCsv() {
  const me = await getProfile();
  if (!me || (me.role !== "hr" && me.role !== "admin" && me.role !== "manager")) return { ok: false as const, error: "Not authorized" };
  const admin = createAdminClient();

  const { data: rows } = await admin.from("reward_requests")
    .select("created_at, candidate_name, requirement_title, recruiter_id, manager_id, hr_id, status, amount, currency, hr_comment, hr_decided_at, initiated_at, division_id")
    .order("created_at", { ascending: false }).limit(5000);
  let list = (rows ?? []) as Array<Record<string, any>>;

  if (me.role === "manager") {
    const { data: pd } = await admin.from("profile_divisions").select("division_id").eq("profile_id", me.id);
    const myDivs = new Set<string>(((pd ?? []) as { division_id: string }[]).map((r) => r.division_id));
    if ((me as { division_id?: string | null }).division_id) myDivs.add((me as { division_id: string }).division_id);
    list = list.filter((r) => r.division_id && myDivs.has(r.division_id));
  }

  const ids = Array.from(new Set(list.flatMap((r) => [r.recruiter_id, r.manager_id, r.hr_id].filter(Boolean) as string[])));
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) nameById.set(p.id, p.full_name);
  }

  const header = ["Created", "Candidate", "Requirement", "Recruiter", "Manager", "HR", "Status", "Amount", "Currency", "Comment", "Decided", "Paid"];
  const lines = [header.join(",")];
  for (const r of list) {
    lines.push([
      (r.created_at ?? "").slice(0, 10),
      r.candidate_name ?? "",
      r.requirement_title ?? "",
      nameById.get(r.recruiter_id) ?? "",
      r.manager_id ? nameById.get(r.manager_id) ?? "" : "",
      r.hr_id ? nameById.get(r.hr_id) ?? "" : "",
      STATUS_LABEL[r.status] ?? r.status,
      r.amount ?? "",
      r.currency ?? "",
      r.hr_comment ?? "",
      (r.hr_decided_at ?? "").slice(0, 10),
      (r.initiated_at ?? "").slice(0, 10),
    ].map(cell).join(","));
  }

  return { ok: true as const, csv: lines.join("\n"), filename: `incentives_${new Date().toISOString().slice(0, 10)}.csv` };
}
