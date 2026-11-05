import React from "react";
import clsx from "clsx";

interface ConnectionStatusIndicatorProps {
  status: "connecting" | "connected" | "disconnected";
  isMobile: boolean;
  isStale?: boolean;
  lastMessageAgeSeconds?: number | null;
  error?: string | null;
}

export const ConnectionStatusIndicator: React.FC<
  ConnectionStatusIndicatorProps
> = ({ status, isMobile, isStale = false, lastMessageAgeSeconds, error }) => {
  const baseStyle = isMobile
    ? "flex items-center rounded-md border font-mono text-[10px] font-semibold px-2 py-1 transition-all duration-200 shadow-[0_0_6px_rgba(0,255,255,0.25)]"
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
    disconnected: "○ Offline",
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

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(baseStyle, stateClasses[status])}
      title={title || undefined}
    >
      {/* Only the connection state is announced, not the ticking packet age. */}
      <span className="sr-only">{announcement}</span>
      <span aria-hidden="true">
        {textMap[status]}
        {shouldShowAgeLabel && ageLabel ? ` ${ageLabel}` : ""}
      </span>
      {showInlineError && (
        <span
          aria-hidden="true"
          className="ml-2 max-w-[200px] truncate font-sans text-[11px] font-normal text-red-200/90"
        >
          {error ? error : "Retrying…"}
        </span>
      )}
    </div>
  );
};
