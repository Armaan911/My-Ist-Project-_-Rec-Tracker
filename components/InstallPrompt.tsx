"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Install-app nudge, shown whenever the app isn't installed — on any page, including the
// login screen. sessionStorage clears when the app/tab closes (so a new session re-shows it).
const DISMISS_KEY = "rt-install-dismissed";

// iOS share glyph (square with an up arrow), so the steps look like Safari's toolbar.
function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block -mt-0.5 text-brand-700">
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "mac" | null>(null); // manual-install platforms
  const [show, setShow] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const deferredRef = useRef<BIPEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1); // iPadOS reports as Mac
    const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
    const isSafari = /^((?!chrome|crios|fxios|android|edg|opr|firefox).)*safari/i.test(ua);

    // iOS (every browser there is WebKit) has no beforeinstallprompt — guide the manual install.
    const manual: "ios" | "mac" | null = isIOS ? "ios" : isMac && isSafari ? "mac" : null;
    if (manual) setPlatform(manual);

    const dismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } };
    const clearDismiss = () => { try { sessionStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ } };
    const canPrompt = () => !!deferredRef.current || !!manual;
    const maybeShow = () => { if (!standalone && !dismissed() && canPrompt()) setShow(true); };

    const onBIP = (e: Event) => { e.preventDefault(); deferredRef.current = e as BIPEvent; setDeferred(e as BIPEvent); maybeShow(); };
    window.addEventListener("beforeinstallprompt", onBIP);

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
    try { await d.prompt(); await d.userChoice; } catch { /* user dismissed — ignore */ }
    deferredRef.current = null; setDeferred(null); dismiss();
  }

  if (!show) return null;
  const manualInstall = !deferred && !!platform;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="pointer-events-auto w-full max-w-md animate-fade-up rounded-2xl border border-line bg-surface p-3 shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">Install Podium</div>
            <div className="text-xs text-muted">Add it to your home screen for one-tap access.</div>
          </div>
          {deferred ? (
            <button onClick={install} className="h-9 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 active:translate-y-px">Install</button>
          ) : manualInstall ? (
            <button onClick={() => setShowSteps((s) => !s)} className="h-9 shrink-0 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:translate-y-px">
              {showSteps ? "Hide" : "How to install"}
            </button>
          ) : null}
          <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink">✕</button>
        </div>

        {manualInstall && showSteps && (
          <ol className="mt-3 space-y-2 border-t border-line pt-3 text-xs text-ink">
            {platform === "ios" ? (
              <>
                <li className="flex gap-2"><Num n={1} /><span>Tap the <ShareGlyph /> <b>Share</b> button in Safari’s bottom toolbar.</span></li>
                <li className="flex gap-2"><Num n={2} /><span>Scroll down and tap <b>Add to Home Screen</b>.</span></li>
                <li className="flex gap-2"><Num n={3} /><span>Tap <b>Add</b> — Podium appears on your home screen.</span></li>
                <li className="pt-1 text-[11px] text-muted">If you don’t see “Add to Home Screen”, open this page in <b>Safari</b> (not Chrome) first.</li>
              </>
            ) : (
              <>
                <li className="flex gap-2"><Num n={1} /><span>In Safari, open the <ShareGlyph /> <b>Share</b> menu (or the File menu).</span></li>
                <li className="flex gap-2"><Num n={2} /><span>Choose <b>Add to Dock</b>, then <b>Add</b>.</span></li>
              </>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}

function Num({ n }: { n: number }) {
  return <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">{n}</span>;
}
