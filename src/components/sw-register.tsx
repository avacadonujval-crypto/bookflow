"use client";

import { useEffect } from "react";

/** Optional: register the minimal service worker for static asset caching. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal in dev or unsupported contexts
    });
  }, []);

  return null;
}
