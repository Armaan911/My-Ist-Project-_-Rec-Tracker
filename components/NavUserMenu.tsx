"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, KeyRound, Loader2, Moon, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setMyAvatar, sendMyPasswordReset } from "@/app/account/actions";
import { toast } from "@/components/uikit";
import { Avatar } from "@/components/ui";

// Top-bar profile picture + menu — available to every signed-in user, on every dashboard.
// Click the avatar for: Change image · Remove picture · Reset password.
export default function NavUserMenu({ userId, name, initialUrl }: { userId: string; name: string; initialUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* ignore */ }
    setDark(next); setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function save(next: string | null) { setUrl(next); await setMyAvatar(next); }

  async function resetPassword() {
    setOpen(false);
    toast("Sending reset link…");
    const res = await sendMyPasswordReset();
    toast(res.ok ? "Password reset link sent to your email." : (res.error ?? "Couldn't send the reset email."), res.ok ? "success" : "error");
  }

  async function pick(file: File) {
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (!error) { const { data } = supabase.storage.from("avatars").getPublicUrl(path); await save(data.publicUrl); }
    } finally { setBusy(false); setOpen(false); }
  }

  return (
    <div ref={rootRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account menu"
        className="rounded-full ring-2 ring-transparent transition [@media(hover:hover)]:hover:ring-brand-200">
        {busy
          ? <span className="grid h-9 w-9 place-items-center rounded-full bg-canvas"><Loader2 size={16} className="animate-spin" /></span>
          : <Avatar name={name} src={url} size={36} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop">
          <button onClick={() => inputRef.current?.click()} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-canvas">
            <Camera size={14} /> Change image
          </button>
          {url && (
            <button onClick={() => { save(null); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-600 hover:bg-danger-50">
              <Trash2 size={14} /> Remove picture
            </button>
          )}
          <button onClick={resetPassword} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-canvas">
            <KeyRound size={14} /> Reset password
          </button>
          <button onClick={toggleTheme} className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm text-ink hover:bg-canvas">
            {dark ? <Sun size={14} /> : <Moon size={14} />} {dark ? "Light mode" : "Dark mode"}
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.currentTarget.value = ""; }} />
    </div>
  );
}
