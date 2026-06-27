"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";

export default function ForgotPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    if (error) setErr(error.message); else setSent(true);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <h1 className="mb-1 text-xl font-bold">Reset password</h1>
        {sent ? (
          <p className="mt-3 text-sm text-green-700">If that email exists, a reset link is on its way. Check your inbox.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">We'll email you a link to set a new password.</p>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button className="mt-4 w-full" onClick={submit}>Send reset link</Button>
            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          </>
        )}
        <p className="mt-4 text-sm"><Link href="/login" className="text-slate-600 underline">Back to sign in</Link></p>
      </Card>
    </div>
  );
}
