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
    // tabIndex -1 lets the trap focus the container itself when it has no
    // focusable children yet.
    <div ref={ref} tabIndex={-1} {...props}>
      {children}
    </div>
  );
}
