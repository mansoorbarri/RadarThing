"use client";

import {
  useRef,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useFocusTrap } from "~/hooks/useFocusTrap";

/** A div that traps focus inside itself while mounted and closes on Escape. */
export function FocusTrap({
  onEscape,
  returnFocusTo,
  containerRef,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  onEscape?: () => void;
  returnFocusTo?: string;
  /** Gives the caller the dialog element too (e.g. to measure it). */
  containerRef?: MutableRefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = containerRef ?? internalRef;
  useFocusTrap(ref, onEscape, { returnFocusTo });
  return (
    // tabIndex -1 lets the trap focus the container itself when it has no
    // focusable children yet.
    <div
      ref={ref}
      tabIndex={-1}
      {...props}
      className={`focus:outline-none ${props.className ?? ""}`}
    >
      {children}
    </div>
  );
}
