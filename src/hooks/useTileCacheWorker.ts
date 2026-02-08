"use client";

import { useEffect } from "react";

export function useTileCacheWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/tile-cache-sw.js")
      .then((registration) => {
        // Trim cache periodically (every 5 minutes)
        const interval = setInterval(() => {
          registration.active?.postMessage("trim-cache");
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
      })
      .catch(() => {
        // Service worker registration failed — tiles still work, just uncached
      });
  }, []);
}
