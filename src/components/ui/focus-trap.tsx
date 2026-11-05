"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { useFocusTrap } from "~/hooks/useFocusTrap";

/** A div that traps focus inside itself while mounted and closes on Escape. */
export function FocusTrap({
  onEscape,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  onEscape?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onEscape);
  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
