"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";

export default function ResetPage() {
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The recovery link establishes a session automatically (detectSessionInUrl).
  async function submit() {
    setErr(null);
    if (password.length < 8) { setErr("Use at least 8 characters."); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setErr(error.message); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <h1 className="mb-1 text-xl font-bold">Set a new password</h1>
        {done ? (
          <p className="mt-3 text-sm text-green-700">Password updated. Redirecting to sign in…</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">Enter your new password below.</p>
            <Label>New password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button className="mt-4 w-full" onClick={submit}>Update password</Button>
            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          </>
        )}
      </Card>
    </div>
  );
}
