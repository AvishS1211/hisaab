"use client";

import { useEffect } from "react";

// Registers the hand-rolled service worker (§9). Silent — if it fails (an
// unsupported browser, a dev tooling quirk), the app still works online.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
  }, []);
  return null;
}
