import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { RotateCw } from "lucide-react";

interface ConnectionStatusIndicatorProps {
  status: "connecting" | "connected" | "disconnected";
  isMobile: boolean;
  isStale?: boolean;
  /** When the last stream message arrived; the pill counts its own age. */
  lastMessageAt?: number | null;
  error?: string | null;
  onReconnect?: () => void;
  /** When the next automatic reconnect happens, for the countdown. */
  nextRetryAt?: number | null;
}

export const ConnectionStatusIndicator: React.FC<
  ConnectionStatusIndicatorProps
> = ({
  status,
  isMobile,
  isStale = false,
  lastMessageAt,
  error,
  onReconnect,
  nextRetryAt,
}) => {
  const lastMessageAgeSeconds = useAgeSeconds(
    status === "connected" ? (lastMessageAt ?? null) : null,
  );
  const retryInSeconds = useRetryCountdown(
    status === "disconnected" ? (nextRetryAt ?? null) : null,
  );
  const isOffline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  const baseStyle = isMobile
    ? "flex items-center rounded-md border font-mono text-[11px] font-semibold px-2 py-1 transition-all duration-200 shadow-[0_0_6px_rgba(0,255,255,0.25)]"
    : "flex items-center rounded-md border font-mono text-[12px] font-semibold px-3 py-1.5 transition-all duration-200 shadow-[0_0_6px_rgba(0,255,255,0.25)]";

  const connectedClass = isStale
    ? "border-yellow-400/30 bg-black/70 text-yellow-300 shadow-[0_0_8px_rgba(255,255,0,0.3)]"
    : "border-cyan-400/30 bg-black/70 text-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.4)] animate-radarPulse";
  const stateClasses = {
    connected: connectedClass,
    connecting:
      "border-yellow-400/30 bg-black/70 text-yellow-400 shadow-[0_0_8px_rgba(255,255,0,0.4)]",
    disconnected:
      "border-red-500/30 bg-black/70 text-red-400 shadow-[0_0_8px_rgba(255,0,0,0.4)]",
  };

  const ageLabel =
    typeof lastMessageAgeSeconds === "number"
      ? `${lastMessageAgeSeconds}s`
      : null;
  const shouldShowAgeLabel =
    status === "connected" &&
    typeof lastMessageAgeSeconds === "number" &&
    lastMessageAgeSeconds >= 5;
  const textMap: Record<typeof status, string> = {
    connected: isStale ? "◔ Stale" : "● Live",
    connecting: "◐ Connecting…",
    disconnected: "● Offline",
  };
  const title = [ageLabel ? `Last packet ${ageLabel} ago` : null, error ?? null]
    .filter(Boolean)
    .join(" | ");

  const announcement =
    status === "connected"
      ? isStale
        ? "Live traffic is delayed"
        : "Live traffic connected"
      : status === "connecting"
        ? "Connecting to live traffic"
        : "Live traffic disconnected, retrying";
  const showInlineError = status === "disconnected" && !isMobile;

  const showReconnect = status === "disconnected" && Boolean(onReconnect);
  const pillText = (
    <span aria-hidden="true" className="whitespace-nowrap">
      {textMap[status]}
      {shouldShowAgeLabel && ageLabel ? ` ${ageLabel}` : ""}
    </span>
  );

  // Phones have no room for a second button, so the offline pill itself
  // becomes the retry button there.
  if (isMobile && showReconnect) {
    return (
      <>
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
        <button
          type="button"
          onClick={onReconnect}
          aria-label={
            isOffline
              ? "Live traffic disconnected: no network. Reconnect now"
              : typeof retryInSeconds === "number" && retryInSeconds > 0
                ? `Live traffic disconnected, retrying in ${retryInSeconds} seconds. Reconnect now`
                : "Live traffic disconnected. Reconnect now"
          }
          title={title || undefined}
          className={clsx(
            baseStyle,
            stateClasses[status],
            "cursor-pointer gap-1 whitespace-nowrap hover:bg-red-500/15 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none",
          )}
        >
          {pillText}
          {/* The refresh icon marks the number as "retry in", not "offline
              for"; the full wording is in the accessible name. */}
          <RotateCw className="h-3 w-3 shrink-0" aria-hidden="true" />
          {!isOffline &&
            typeof retryInSeconds === "number" &&
            retryInSeconds > 0 && (
              <span aria-hidden="true" className="tabular-nums">
                {retryInSeconds}s
              </span>
            )}
        </button>
      </>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div
        role="status"
        aria-live="polite"
        className={clsx(baseStyle, stateClasses[status])}
        title={title || undefined}
      >
        {/* Only the connection state is announced, not the ticking packet age. */}
        <span className="sr-only">{announcement}</span>
        {pillText}
        {showInlineError && (
          <span
            aria-hidden="true"
            className="ml-2 max-w-[260px] truncate font-sans text-[11px] font-normal text-red-200/90"
          >
            {[
              error,
              isOffline
                ? "Waiting for network…"
                : typeof retryInSeconds === "number" && retryInSeconds > 0
                  ? `Retrying in ${retryInSeconds}s`
                  : "Retrying…",
            ]
              .filter(Boolean)
              .join(" ")}
          </span>
        )}
      </div>
      {showReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="h-8 cursor-pointer rounded-md border border-red-400/40 bg-black/70 px-3 font-sans text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/15 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
        >
          Reconnect now
        </button>
      )}
    </div>
  );
};

/** Seconds left until `target`, ticking once a second. */
function useRetryCountdown(target: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target === null) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);
  if (target === null) return null;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/** Whole seconds since `since`, ticking once a second while it's set. */
function useAgeSeconds(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [since]);
  if (since === null) return null;
  return Math.max(0, Math.floor((now - since) / 1000));
}
