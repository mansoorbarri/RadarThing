"use client";

import { FocusTrap } from "~/components/ui/focus-trap";

export const AIRCRAFT_IMAGE_REJECTION_REASONS = [
  "Low quality image",
  "Image already exists",
  "Invalid aircraft ICAO",
  "Invalid ICAO/IATA",
  "Wrong aircraft in the image",
  "Image too zoomed in.",
  "Simulator images are not allowed",
] as const;

interface RejectModalProps {
  isOpen: boolean;
  targetCount: number;
  selectedReasons: string[];
  customReason: string;
  onSelectedReasonsChange: (reasons: string[]) => void;
  onCustomReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RejectModal({
  isOpen,
  targetCount,
  selectedReasons,
  customReason,
  onSelectedReasonsChange,
  onCustomReasonChange,
  onConfirm,
  onCancel,
}: RejectModalProps) {
  if (!isOpen) return null;

  const hasReason = selectedReasons.length > 0 || Boolean(customReason.trim());

  function toggleReason(reason: string) {
    if (selectedReasons.includes(reason)) {
      onSelectedReasonsChange(
        selectedReasons.filter((selectedReason) => selectedReason !== reason),
      );
      return;
    }

    onSelectedReasonsChange([...selectedReasons, reason]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <FocusTrap
        role="dialog"
        aria-modal="true"
        aria-labelledby="rejectModal-title"
        onEscape={onCancel}
        className="border-border bg-card text-card-foreground w-full max-w-md rounded-2xl border p-6 shadow-2xl"
      >
        <h3
          id="rejectModal-title"
          className="text-foreground mb-4 text-lg font-semibold"
        >
          Reject {targetCount} image{targetCount > 1 ? "s" : ""}
        </h3>
        <p className="text-muted-foreground mb-4 text-sm">
          Choose one or more reasons. The selected reason(s) or your custom
          message will be sent to the uploader.
        </p>
        <div className="mb-4 space-y-2">
          {AIRCRAFT_IMAGE_REJECTION_REASONS.map((reason) => {
            const checked = selectedReasons.includes(reason);

            return (
              <label
                key={reason}
                className="border-border bg-background/60 hover:bg-muted/60 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleReason(reason)}
                  className="border-input mt-0.5 h-4 w-4 rounded text-red-500 focus:ring-red-500/50"
                />
                <span className="text-foreground">{reason}</span>
              </label>
            );
          })}
        </div>
        <div className="mb-4 space-y-2">
          <label
            htmlFor="custom-reject-reason"
            className="text-foreground block text-sm font-medium"
          >
            Custom
          </label>
          <textarea
            id="custom-reject-reason"
            value={customReason}
            onChange={(e) => onCustomReasonChange(e.target.value)}
            placeholder="Type a custom rejection reason if needed"
            className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border p-3 text-sm outline-none focus:border-red-500/50 focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            rows={3}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="border-border text-muted-foreground hover:bg-muted flex-1 cursor-pointer rounded-lg border py-2 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!hasReason}
            className="flex-1 cursor-pointer rounded-lg bg-red-500/15 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
          >
            Reject
          </button>
        </div>
      </FocusTrap>
    </div>
  );
}
