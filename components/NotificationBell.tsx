"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Check, X, Volume2, VolumeX } from "lucide-react";
import { prettyDate } from "@/lib/dates";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const POLL_MS = 25_000;
const MUTE_KEY = "notif-muted";

// Relative-ish, locale-independent timestamp ("just now", "5m", "2h", or a date).
function ago(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return prettyDate(iso.slice(0, 10), { weekday: "short" });
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const prevUnread = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Restore mute preference.
  useEffect(() => {
    try { setMuted(localStorage.getItem(MUTE_KEY) === "1"); } catch { /* ignore */ }
  }, []);

  // A short "buzz" via Web Audio (no asset), plus a haptic buzz on supporting devices.
  const playBuzz = useCallback(() => {
    try {
      if (localStorage.getItem(MUTE_KEY) === "1") return;
    } catch { /* ignore */ }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = audioRef.current ?? (audioRef.current = new Ctx());
        if (ctx.state === "suspended") void ctx.resume();
        const now = ctx.currentTime;
        for (let i = 0; i < 2; i++) {
          const t0 = now + i * 0.18;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(185, t0);
          osc.frequency.linearRampToValueAtTime(150, t0 + 0.12);
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.17);
        }
      }
    } catch { /* audio blocked before user gesture — ignore */ }
    try { navigator.vibrate?.([90, 40, 90]); } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Notif[]; unread: number };
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
      // Buzz only when the unread count goes UP (a genuinely new notification),
      // never on the first load.
      if (prevUnread.current !== null && (data.unread ?? 0) > prevUnread.current) playBuzz();
      prevUnread.current = data.unread ?? 0;
    } catch { /* ignore network hiccups */ }
  }, [playBuzz]);

  // Poll on mount, on an interval, and whenever the tab regains focus.
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  // Prime the AudioContext on the first user gesture so buzzes can play later.
  useEffect(() => {
    const prime = () => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx && !audioRef.current) audioRef.current = new Ctx();
        if (audioRef.current?.state === "suspended") void audioRef.current.resume();
      } catch { /* ignore */ }
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
    window.addEventListener("pointerdown", prime);
    window.addEventListener("keydown", prime);
    return () => { window.removeEventListener("pointerdown", prime); window.removeEventListener("keydown", prime); };
  }, []);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function markAllRead() {
    setItems((xs) => xs.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    prevUnread.current = 0;
    try { await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "read" }) }); } catch { /* ignore */ }
  }

  async function openItem(n: Notif) {
    setOpen(false);
    if (!n.is_read) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      prevUnread.current = Math.max(0, (prevUnread.current ?? 1) - 1);
      try { await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "read", ids: [n.id] }) }); } catch { /* ignore */ }
    }
    if (n.link) router.push(n.link);
  }

  async function dismiss(e: React.MouseEvent, n: Notif) {
    e.stopPropagation();
    setItems((xs) => xs.filter((x) => x.id !== n.id));
    if (!n.is_read) setUnread((u) => Math.max(0, u - 1));
    try { await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "dismiss", id: n.id }) }); } catch { /* ignore */ }
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-1">
              <button onClick={toggleMute} title={muted ? "Unmute sound" : "Mute sound"}
                className="rounded-md p-1 text-muted hover:bg-canvas hover:text-ink">
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              {unread > 0 && (
                <button onClick={markAllRead} title="Mark all read"
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-canvas hover:text-ink">
                  <Check size={13} /> Mark all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <button key={n.id} onClick={() => openItem(n)}
                  className={`group flex w-full items-start gap-2 border-b border-line px-3 py-2.5 text-left transition-colors hover:bg-canvas ${n.is_read ? "" : "bg-brand-50/40"}`}>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  <span className={`min-w-0 flex-1 ${n.is_read ? "pl-4" : ""}`}>
                    <span className="block text-sm font-medium text-ink">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-xs text-muted">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-muted/70">{ago(n.created_at)}</span>
                  </span>
                  <span onClick={(e) => dismiss(e, n)} title="Dismiss"
                    className="shrink-0 rounded p-0.5 text-muted/0 transition-colors group-hover:text-muted/60 hover:!text-danger-600">
                    <X size={14} />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
