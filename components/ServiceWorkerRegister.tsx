"use client";
import { useEffect } from "react";

// Registers the service worker and keeps every client on the latest build automatically:
// it forces an update check on load and whenever the tab regains focus, activates a new
// worker the moment it's ready, and reloads clients that were on an older worker — so users
// never have to clear their cache or reinstall to get a fix.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    const reloadOnce = () => { if (refreshing) return; refreshing = true; window.location.reload(); };

    // If the page was already controlled by an older worker, reload when a NEW one takes
    // over. (First-time visitors have no controller, so they don't get a spurious reload.)
    const hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => { if (hadController) reloadOnce(); };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const activateWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        reg.update().catch(() => {});      // force an immediate check for a newer worker
        activateWaiting(reg);              // take over now if one is already waiting
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // A fresh worker finished installing while an old one controls the page → swap now.
            if (installing.state === "installed" && navigator.serviceWorker.controller) activateWaiting(reg);
          });
        });
      } catch { /* registration can fail on http/localhost without https — ignore */ }
    };

    const onLoad = () => void register();
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);

    // Re-check for a new build when the user comes back to the tab/app.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker.getRegistration().then((r) => r?.update().catch(() => {})).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
