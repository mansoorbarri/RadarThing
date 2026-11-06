import { useEffect, useRef } from "react";

// Back navigations this hook starts itself (when a sheet closes another
// way). Their popstate must not close a sheet that opened in the meantime.
// Remembered as a short time window rather than a counter, so it can never
// get stuck when no sheet is listening.
let ignorePopsUntil = 0;

/**
 * Lets the phone's Back button (or browser back) close a sheet instead of
 * leaving the page. While `open`, an extra history entry is pushed with the
 * current state kept intact (so Next.js' router state isn't disturbed);
 * going back pops it and calls `onClose`. Closing the sheet any other way
 * removes the entry again.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const marker = `sheet-${Math.random().toString(36).slice(2)}`;
    const baseState: Record<string, unknown> =
      (window.history.state as Record<string, unknown> | null) ?? {};
    window.history.pushState({ ...baseState, __radarSheet: marker }, "");
    let closedByBack = false;

    const onPopState = (event: PopStateEvent) => {
      if (Date.now() < ignorePopsUntil) return;
      const state = event.state as Record<string, unknown> | null;
      if (state?.__radarSheet === marker) return;
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      // Closed with a button or Escape: drop the entry we added.
      const current = window.history.state as Record<string, unknown> | null;
      if (!closedByBack && current?.__radarSheet === marker) {
        ignorePopsUntil = Date.now() + 400;
        window.history.back();
      }
    };
  }, [open]);
}
