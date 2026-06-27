import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllocatedReqs, getDailyItems, getActiveMetrics } from "@/lib/dailyData";
import { prettyDate } from "@/lib/dates";
import DailyUpdateEditor from "@/components/DailyUpdateEditor";
import TokenSubmissionEntry from "@/components/TokenSubmissionEntry";
import { saveDailyTokenForm, loadDailyTokenForm, saveTokenSubmission } from "./actions";

export const dynamic = "force-dynamic";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export default async function DailyTokenPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: tok } = await admin
    .from("daily_form_tokens")
    .select("recruiter_id, for_date, expires_at, used_at")
    .eq("token_hash", sha256(params.token))
    .maybeSingle();

  let error: string | null = null;
  let profile: { full_name: string; is_active: boolean } | null = null;
  if (!tok) error = "This link isn't valid.";
  else if (tok.used_at) error = "This link was already used — your update is saved.";
  else if (new Date(tok.expires_at) < new Date()) error = "This link has expired. Ask for a fresh one.";
  else {
    const { data } = await admin.from("profiles").select("full_name, is_active").eq("id", tok.recruiter_id).single();
    profile = (data as any) ?? null;
    if (!profile?.is_active) error = "Your account is inactive.";
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">R</span>
          <span className="font-display text-[15px] font-bold tracking-tight">Recruit Tracker</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {error || !tok || !profile ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
            <h1 className="text-xl font-bold">{tok?.used_at ? "All done ✅" : "Link unavailable"}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{error ?? "Please request a new link."}</p>
          </div>
        ) : (
          <TokenForm token={params.token} recruiterId={tok.recruiter_id} forDate={tok.for_date} name={profile.full_name} />
        )}
      </main>
    </div>
  );
}

async function TokenForm({ token, recruiterId, forDate, name }: { token: string; recruiterId: string; forDate: string; name: string }) {
  const admin = createAdminClient();
  const [reqs, items, metrics, { data: statuses }] = await Promise.all([
    getAllocatedReqs(admin, recruiterId),
    getDailyItems(admin, recruiterId, forDate),
    getActiveMetrics(admin),
    admin.from("submission_statuses").select("id, label, sort_order").order("sort_order"),
  ]);
  const save = saveDailyTokenForm.bind(null, token);
  const loadDate = loadDailyTokenForm.bind(null, token);
  const saveSub = saveTokenSubmission.bind(null, token);
  const first = name?.split(/\s+/)[0] ?? "there";
  const pretty = prettyDate(forDate, { weekday: "long" });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Hi {first} 👋</h1>
        <p className="text-sm text-muted">Your update for <b>{pretty}</b> — under a minute. No login needed.</p>
      </div>

      <TokenSubmissionEntry reqs={reqs as any} statuses={(statuses as any) ?? []} forDate={forDate} save={saveSub} />

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-3 text-[15px] font-semibold">Daily activity counts</div>
        <DailyUpdateEditor
          reqs={reqs}
          metrics={metrics}
          date={forDate}
          initialItems={items}
          locked={false}
          allowDateChange={false}
          save={save}
          loadDate={loadDate}
        />
      </div>
    </div>
  );
}
