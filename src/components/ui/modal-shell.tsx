"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFocusTrap } from "~/hooks/useFocusTrap";

interface ModalShellProps {
  /** id of the element that names the dialog (usually its heading). */
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  /** When true, Escape and backdrop clicks are ignored (e.g. mid-upload). */
  closeDisabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Accessible modal wrapper: dialog semantics, focus moved inside and trapped,
 * Escape / backdrop to close, page scroll locked, and focus returned to the
 * control that opened it.
 */
export function ModalShell({
  labelledBy,
  describedBy,
  onClose,
  closeDisabled = false,
  className = "",
  children,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  // Shared trap: moves focus in, keeps Tab inside, Escape closes (unless
  // closing is disabled) and focus returns to the opener afterwards.
  useFocusTrap(panelRef, () => {
    if (!closeDisabledRef.current) onCloseRef.current();
  });

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f14] p-6 shadow-2xl focus:outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
