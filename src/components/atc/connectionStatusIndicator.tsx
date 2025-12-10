import React from "react";
import clsx from "clsx";

interface ConnectionStatusIndicatorProps {
  status: "connecting" | "connected" | "disconnected";
  isMobile: boolean;
}

export const ConnectionStatusIndicator: React.FC<
  ConnectionStatusIndicatorProps
> = ({ status }) => {
  const baseStyle =
    "flex items-center rounded-md border font-mono text-[12px] font-semibold px-3 py-1.5 transition-all duration-200 shadow-[0_0_6px_rgba(0,255,255,0.25)]";

  const stateClasses = {
    connected:
      "border-cyan-400/30 bg-black/70 text-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.4)] animate-radarPulse",
    connecting:
      "border-yellow-400/30 bg-black/70 text-yellow-400 shadow-[0_0_8px_rgba(255,255,0,0.4)]",
    disconnected:
      "border-red-500/30 bg-black/70 text-red-400 shadow-[0_0_8px_rgba(255,0,0,0.4)]",
  };

  const textMap: Record<typeof status, string> = {
    connected: "● Live",
    connecting: "◐ Connecting...",
    disconnected: "○ Disconnected",
  };

  return (
    <div className={clsx(baseStyle, stateClasses[status])}>
      <span>{textMap[status]}</span>
    </div>
  );
};