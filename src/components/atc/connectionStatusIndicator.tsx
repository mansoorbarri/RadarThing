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
    lastMessageAgeSeconds === null ? null : `${lastMessageAgeSeconds}s`;
  const textMap: Record<typeof status, string> = {
    connected: isStale ? "◔ Stale" : "● Live",
    connecting: "◐ Connecting...",
    disconnected: "○ Disconnected",
  };
  const title = [
    ageLabel ? `Last packet ${ageLabel} ago` : null,
    error ?? null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <div
      className={clsx(baseStyle, stateClasses[status])}
      title={title || undefined}
    >
      <span>
        {textMap[status]}
        {status === "connected" && ageLabel ? ` ${ageLabel}` : ""}
      </span>
    </div>
  );
};
