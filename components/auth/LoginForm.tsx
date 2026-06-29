"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label, Spinner } from "@/components/ui";
import AnimatedLogo from "@/components/AnimatedLogo";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePassword() {
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) { setFactorId(totp.id); setNeedsOtp(true); setLoading(false); return; }
    }
    router.push("/dashboard");
  }

  async function handleOtp() {
    if (!factorId) return;
    setLoading(true); setError(null);
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !challenge) { setError(cErr?.message ?? "challenge failed"); setLoading(false); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: otp });
    if (vErr) { setError(vErr.message); setLoading(false); return; }
    router.push("/dashboard");
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-canvas via-surface to-brand-50/60 px-4 animate-gradient">
      {/* Page animation — drifting colour blobs. The logo itself stays still. */}
      <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-brand-400/30 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl animate-blob" style={{ animationDelay: "3s" }} />
      <div className="pointer-events-none absolute right-1/2 top-1/3 h-64 w-64 rounded-full bg-brand-600/15 blur-3xl animate-blob" style={{ animationDelay: "6s" }} />

      <div className="relative grid w-full max-w-5xl items-center gap-12 animate-fade-up md:grid-cols-2 lg:gap-24">
        {/* Left — large static logo, "taped" onto the page */}
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="relative inline-block max-w-full -rotate-1 rounded-2xl bg-surface/70 p-4 shadow-md ring-1 ring-line/60 backdrop-blur-sm sm:p-6">
            {/* curled red & blue cello-tape strips holding the logo in place */}
            <span className="tape tape-red pointer-events-none absolute -left-5 -top-3.5 -rotate-12" />
            <span className="tape tape-blue pointer-events-none absolute -right-5 -top-3.5 rotate-12" />
            <AnimatedLogo size={48} />
          </div>
          <p className="mt-6 max-w-xs text-sm text-muted">Track your desk, your team and every closure — all in one place.</p>
        </div>

        {/* Right — login card */}
        <div className="w-full">
          <div className="mb-4 text-center md:text-left">
            <h2 className="font-display text-xl font-bold">Welcome back</h2>
            <p className="mt-0.5 text-sm text-muted">Sign in to log and track your desk.</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface/90 p-6 shadow-card backdrop-blur-sm">
            {!needsOtp ? (
              <div className="space-y-4">
                <div><Label>Email</Label><Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
                <Button className="w-full" disabled={loading || !email || !password} onClick={handlePassword}>
                  {loading ? <><Spinner /> Signing in…</> : "Sign in"}
                </Button>
                <p className="text-center text-sm"><a href="/forgot" className="text-muted underline hover:text-ink">Forgot password?</a></p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted">Enter the 6-digit code from your authenticator app.</p>
                <div><Label>Authentication code</Label><Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" placeholder="123456" autoFocus /></div>
                <Button className="w-full" disabled={loading || otp.length < 6} onClick={handleOtp}>
                  {loading ? <><Spinner /> Verifying…</> : "Verify & continue"}
                </Button>
              </div>
            )}
            {error && <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
