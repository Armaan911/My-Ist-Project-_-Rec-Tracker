"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Install-app nudge, shown whenever the app isn't installed — on any page, including the
// login screen. sessionStorage clears when the app/tab closes (so a new session re-shows
// it), and we clear it on logout so the login screen shows it again.
const DISMISS_KEY = "rt-install-dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [hint, setHint] = useState<string | null>(null); // manual-install steps (Safari)
  const [show, setShow] = useState(false);
  const deferredRef = useRef<BIPEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
    // Safari only — exclude Chrome/Edge/Opera/Firefox which all include "Safari" in the UA.
    const isSafari = /^((?!chrome|crios|fxios|android|edg|opr|firefox).)*safari/i.test(ua);

    // Safari can't be triggered programmatically (no beforeinstallprompt), so we guide the
    // manual install instead of showing a dead button.
    const manualHint = (isIOS && isSafari)
      ? "Tap the Share button, then choose “Add to Home Screen”."
      : (isMac && isSafari)
      ? "Open Safari’s File or Share menu, then choose “Add to Dock”."
      : null;
    if (manualHint) setHint(manualHint);

    const dismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } };
    const clearDismiss = () => { try { sessionStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ } };
    const canPrompt = () => !!deferredRef.current || !!manualHint;
    const maybeShow = () => { if (!standalone && !dismissed() && canPrompt()) setShow(true); };

    const onBIP = (e: Event) => { e.preventDefault(); deferredRef.current = e as BIPEvent; setDeferred(e as BIPEvent); maybeShow(); };
    window.addEventListener("beforeinstallprompt", onBIP);

    // Nudge whenever the app isn't installed — on every page, including the login screen.
    // Once per session (dismissible); re-shows on a fresh session and after logout.
    maybeShow();
    const supabase = createClient();
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { clearDismiss(); maybeShow(); }
      else if (event === "SIGNED_IN") { maybeShow(); }
    });

    return () => { window.removeEventListener("beforeinstallprompt", onBIP); authSub.subscription.unsubscribe(); };
  }, []);

  function dismiss() {
    setShow(false);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  async function install() {
    const d = deferredRef.current;
    if (!d) return;
    try {
      await d.prompt();
      await d.userChoice;
    } catch { /* user dismissed the native dialog — ignore */ }
    deferredRef.current = null;
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    // pointer-events-none on the wrapper so the full-width strip never blocks clicks on the
    // page behind it; the card itself re-enables pointer events.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="pointer-events-auto flex w-full max-w-md animate-fade-up items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lg">
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">Install Podium</div>
          <div className="text-xs text-muted">{hint && !deferred ? hint : "Add it to your home screen for one-tap access."}</div>
        </div>
        {deferred && (
          <button onClick={install} className="h-9 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 active:translate-y-px">
            Install
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink">✕</button>
      </div>
    </div>
  );
}
