import type { ReactNode } from "react";

/**
 * The one heading style for radar side panels: clearly a step above the
 * 11px data labels beneath it, so every panel reads the same way.
 */
export const PANEL_HEADING_CLASS =
  "text-xs font-semibold tracking-[0.08em] text-white/85";

export function PanelHeading({
  children,
  className = "",
  as: Tag = "h3",
}: {
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3" | "h4" | "span";
}) {
  return (
    <Tag className={`${PANEL_HEADING_CLASS} ${className}`}>{children}</Tag>
  );
}
