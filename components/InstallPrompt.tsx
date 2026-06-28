"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Per-login-session nudge: sessionStorage clears when the app/tab closes (so a new
// session re-shows it), and we also clear it on logout so the next login shows it again.
const DISMISS_KEY = "rt-install-dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);
  const deferredRef = useRef<BIPEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(navigator.userAgent);

    const dismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } };
    const clearDismiss = () => { try { sessionStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ } };
    const canPrompt = () => !!deferredRef.current || (isIOS && isSafari);
    // Only nudge a signed-in user, once per session (until installed or dismissed).
    const maybeShow = () => { if (!standalone && !dismissed() && canPrompt()) setShow(true); };

    if (isIOS && isSafari) setIosHint(true);

    const onBIP = (e: Event) => { e.preventDefault(); deferredRef.current = e as BIPEvent; setDeferred(e as BIPEvent); maybeShow(); };
    window.addEventListener("beforeinstallprompt", onBIP);

    const supabase = createClient();
    // Show for the currently signed-in session…
    supabase.auth.getSession().then(({ data }) => { if (data.session) maybeShow(); });
    // …and re-show on each fresh login; clear the dismissal on logout.
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { clearDismiss(); setShow(false); }
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
    await d.prompt();
    await d.userChoice;
    deferredRef.current = null;
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
        {!iosHint && deferred && (
          <button onClick={install} className="h-9 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 active:translate-y-px">
            Install
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink">✕</button>
      </div>
    </div>
  );
}
