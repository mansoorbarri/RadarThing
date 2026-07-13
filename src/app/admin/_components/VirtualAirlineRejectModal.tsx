"use client";

import { useEffect, useRef, useState } from "react";

export function VirtualAirlineRejectModal({
  isOpen,
  virtualAirlineName,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  virtualAirlineName: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setReason("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements =
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm dark:bg-black/70">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="va-reject-title"
        className="border-border bg-card text-card-foreground w-full max-w-md rounded-2xl border p-6 shadow-2xl"
      >
        <h3
          id="va-reject-title"
          className="text-foreground text-lg font-semibold"
        >
          Reject VA registration
        </h3>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Tell the owner why{" "}
          <span className="text-foreground font-medium">
            {virtualAirlineName}
          </span>{" "}
          was not approved. This reason will be sent to their email address.
        </p>
        <label className="text-foreground mt-5 block text-sm font-medium">
          Rejection reason
          <textarea
            autoFocus
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain what needs to be corrected before resubmitting"
            rows={4}
            className="border-input bg-background text-foreground placeholder:text-muted-foreground mt-2 w-full rounded-xl border p-3 text-sm transition outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/15"
          />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-border text-muted-foreground hover:bg-muted rounded-xl border px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={isSubmitting || !reason.trim()}
            className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Rejecting…" : "Reject & email owner"}
          </button>
        </div>
      </div>
    </div>
  );
}
