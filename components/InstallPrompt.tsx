"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "rt-install-dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    if (standalone) return; // already installed
    // Show on every visit until the user actually installs or dismisses it.
    if (localStorage.getItem(DISMISS_KEY)) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(navigator.userAgent);

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); setShow(true); };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS never fires beforeinstallprompt — show the manual hint instead.
    if (isIOS && isSafari) { setIosHint(true); setShow(true); }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="flex w-full max-w-md animate-fade-up items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lg">
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">Install Podium</div>
          {iosHint ? (
            <div className="text-xs text-muted">Tap the Share button, then <span className="font-medium text-ink">Add to Home Screen</span>.</div>
          ) : (
            <div className="text-xs text-muted">Add it to your home screen for one-tap access.</div>
          )}
        </div>
        {!iosHint && (
          <button onClick={install} className="h-9 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 active:translate-y-px">
            Install
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink">✕</button>
      </div>
    </div>
  );
}
