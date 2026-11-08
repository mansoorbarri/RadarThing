import { useEffect, useRef } from "react";

/*
 * Phone sheets close with the Back button instead of leaving the radar.
 *
 * All open sheets share ONE extra history entry. It's pushed when the first
 * sheet opens and removed when the last one closes. Back pops it and closes
 * the most recently opened sheet; if others are still open the entry is
 * pushed again for them. Removing the entry is deferred a tick, so when one
 * sheet replaces another in the same render there's no back-then-push race.
 */

interface Closer {
  close: () => void;
}

const openSheets: Closer[] = [];
let entryPushed = false;
let listening = false;
let pendingRemoval: ReturnType<typeof setTimeout> | null = null;

function isOurEntry(state: unknown) {
  return Boolean(
    state &&
    typeof state === "object" &&
    (state as Record<string, unknown>).__radarSheet,
  );
}

function pushEntry() {
  const base = (window.history.state as Record<string, unknown> | null) ?? {};
  // Keep the existing state so Next.js' router data is untouched.
  window.history.pushState({ ...base, __radarSheet: true }, "");
  entryPushed = true;
}

function onPopState(event: PopStateEvent) {
  if (!entryPushed || isOurEntry(event.state)) return;
  entryPushed = false;
  const top = openSheets.pop();
  top?.close();
  if (openSheets.length > 0) pushEntry();
}

export function useBackToClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    if (!listening) {
      window.addEventListener("popstate", onPopState);
      listening = true;
    }
    const entry: Closer = { close: () => onCloseRef.current() };
    openSheets.push(entry);
    if (pendingRemoval) {
      // Another sheet just closed; reuse its history entry.
      clearTimeout(pendingRemoval);
      pendingRemoval = null;
    }
    if (!entryPushed) pushEntry();

    return () => {
      const index = openSheets.indexOf(entry);
      // Already removed: this sheet was closed by Back.
      if (index === -1) return;
      openSheets.splice(index, 1);
      if (openSheets.length > 0 || !entryPushed) return;
      pendingRemoval = setTimeout(() => {
        pendingRemoval = null;
        if (openSheets.length > 0 || !entryPushed) return;
        entryPushed = false;
        if (isOurEntry(window.history.state)) window.history.back();
      }, 0);
    };
  }, [open]);
}
