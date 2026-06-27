"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";

export default function TwoFactorSetup() {
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "off" | "enrolling" | "on">("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === "verified");
    setFactorId(verified?.id ?? null);
    setStatus(verified ? "on" : "off");
  }
  useEffect(() => { refresh(); }, []);

  async function enable() {
    setErr(null);
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of (list?.all ?? []).filter((x) => x.factor_type === "totp" && x.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
    if (error || !data) { setErr(error?.message ?? "Enrollment failed"); return; }
    setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret); setStatus("enrolling");
  }

  async function verify() {
    if (!factorId) return;
    setErr(null);
    const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !ch) { setErr(cErr?.message ?? "Challenge failed"); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
    if (vErr) { setErr(vErr.message); return; }
    setQr(null); setSecret(null); setCode(""); setStatus("on");
  }

  async function disable() {
    if (!factorId) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { setErr(error.message); return; }
    setStatus("off"); setFactorId(null);
  }

  return (
    <Card className="max-w-xl">
      <h2 className="mb-1 text-lg font-semibold">Two-factor authentication</h2>
      <p className="mb-4 text-sm text-slate-500">Add a one-time code from an authenticator app to your sign-in.</p>

      {status === "loading" && <p className="text-sm text-slate-400">Checking…</p>}

      {status === "on" && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-green-700">● 2FA is enabled on your account.</p>
          <Button variant="danger" onClick={disable}>Disable 2FA</Button>
        </div>
      )}

      {status === "off" && (
        <Button onClick={enable}>Enable 2FA</Button>
      )}

      {status === "enrolling" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">1. Scan this QR in your authenticator app (Google Authenticator, Authy, 1Password…).</p>
          {qr && <img src={qr} alt="2FA QR code" className="h-44 w-44 rounded border border-slate-200 bg-white p-1" />}
          {secret && <p className="text-xs text-slate-500">Or enter this key manually: <span className="font-mono">{secret}</span></p>}
          <div>
            <Label>2. Enter the 6-digit code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" className="max-w-[180px]" />
          </div>
          <Button onClick={verify}>Verify & turn on</Button>
        </div>
      )}

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </Card>
  );
}
