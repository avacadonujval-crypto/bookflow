"use client";

import { useEffect } from "react";

/**
 * Unregisters any legacy BookFlow service workers and clears Cache Storage.
 * (Older builds cached Next.js chunks and broke the live app after deploys.)
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        // Non-fatal
      }
    })();
  }, []);

  return null;
}
