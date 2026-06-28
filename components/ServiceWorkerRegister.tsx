"use client";
import { useEffect } from "react";

// Registers the service worker once the app is interactive. Safe no-op where unsupported.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // If a page was already controlled by an old SW, reload once when a NEW SW takes over,
    // so clients holding a stale/broken cache recover to the fresh build automatically.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    const hadController = !!navigator.serviceWorker.controller;
    if (hadController) navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration can fail on http/localhost without https — ignore */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);

    return () => {
      window.removeEventListener("load", onLoad);
      if (hadController) navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
