// components/atc/ConnectionStatusIndicator.tsx
import React from "react";

interface ConnectionStatusIndicatorProps {
  status: "connecting" | "connected" | "disconnected";
  isMobile: boolean; // Assuming the parent needs to know this for positioning
}

export const ConnectionStatusIndicator: React.FC<
  ConnectionStatusIndicatorProps
> = ({ status }) => {
  let backgroundColor;
  let text;

  switch (status) {
    case "connected":
      backgroundColor = "rgba(16, 185, 129, 0.9)";
      text = "● Live";
      break;
    case "connecting":
      backgroundColor = "rgba(251, 191, 36, 0.9)";
      text = "◐ Connecting...";
      break;
    case "disconnected":
      backgroundColor = "rgba(239, 68, 68, 0.9)";
      text = "○ Disconnected";
      break;
    default:
      backgroundColor = "rgba(128, 128, 128, 0.9)";
      text = "Unknown";
  }

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: "600",
        backgroundColor: backgroundColor,
        color: "white",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        backdropFilter: "blur(8px)",
      }}
    >
      {text}
    </div>
  );
};
