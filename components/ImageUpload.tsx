"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Uploads an image to a public Supabase Storage bucket and hands back its public URL.
// Used for recruiter avatars and candidate photos. Shows a live preview while picking.
// variant="inline" (default): circle + "Change"/"Remove" text buttons beside it.
// variant="menu": click the circle to reveal a Change / Remove popover (nothing beside it).
export default function ImageUpload({
  bucket, prefix, value, onChange, shape = "circle", label = "Add photo", size = 72, variant = "inline",
}: {
  bucket: "avatars" | "candidates";
  prefix: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  shape?: "circle" | "square";
  label?: string;
  size?: number;
  variant?: "inline" | "menu";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const radius = shape === "circle" ? "rounded-full" : "rounded-xl";

  async function pick(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) { setErr("Pick an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setErr("Keep it under 5 MB."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) { setErr(error.message); setBusy(false); return; }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed.");
    }
    setBusy(false);
  }

  const fileInput = (
    <input ref={inputRef} type="file" accept="image/*" className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.currentTarget.value = ""; }} />
  );

  // Close the popover on outside click (menu variant).
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  if (variant === "menu") {
    // Click the circle: if there's a photo, open the Change/Remove menu; otherwise pick directly.
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button" disabled={busy} aria-label={value ? "Edit photo" : label}
          onClick={() => (value ? setMenuOpen((o) => !o) : inputRef.current?.click())}
          className={`group relative grid shrink-0 place-items-center overflow-hidden border border-line bg-canvas text-muted transition hover:border-brand-600/50 ${radius}`}
          style={{ width: size, height: size }}
        >
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <Camera size={20} />}
          {/* hover hint so it's clearly clickable */}
          <span className="absolute inset-0 grid place-items-center bg-black/0 text-white/0 transition group-hover:bg-black/35 group-hover:text-white">
            <Camera size={18} />
          </span>
          {busy && <span className="absolute inset-0 grid place-items-center bg-black/30 text-white"><Loader2 size={18} className="animate-spin" /></span>}
        </button>

        {menuOpen && value && (
          <div className="absolute left-0 top-full z-30 mt-2 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop">
            <button type="button" onClick={() => { inputRef.current?.click(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-canvas">
              <Pencil size={14} /> Change photo
            </button>
            <button type="button" onClick={() => { onChange(null); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-600 hover:bg-danger-50">
              <Trash2 size={14} /> Remove photo
            </button>
          </div>
        )}
        {err && <p className="mt-1 text-xs text-danger-600">{err}</p>}
        {fileInput}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        className={`relative grid shrink-0 place-items-center overflow-hidden border border-line bg-canvas text-muted transition hover:border-brand-600/50 ${radius}`}
        style={{ width: size, height: size }}
      >
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <Camera size={20} />}
        {busy && <span className="absolute inset-0 grid place-items-center bg-black/30 text-white"><Loader2 size={18} className="animate-spin" /></span>}
      </button>
      <div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="text-sm font-medium text-brand-700 hover:underline disabled:opacity-50">
          {busy ? "Uploading…" : value ? "Change" : label}
        </button>
        {value && !busy && (
          <button type="button" onClick={() => onChange(null)} className="ml-3 inline-flex items-center gap-1 text-sm text-muted hover:text-danger-600"><X size={13} /> Remove</button>
        )}
        {err && <p className="mt-1 text-xs text-danger-600">{err}</p>}
      </div>
      {fileInput}
    </div>
  );
}
