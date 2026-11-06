"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { useFocusTrap } from "~/hooks/useFocusTrap";

/** A div that traps focus inside itself while mounted and closes on Escape. */
export function FocusTrap({
  onEscape,
  returnFocusTo,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  onEscape?: () => void;
  returnFocusTo?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onEscape, { returnFocusTo });
  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
