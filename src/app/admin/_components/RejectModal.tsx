"use client";

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

  const hasReason =
    selectedReasons.length > 0 || Boolean(customReason.trim());

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
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Reject {targetCount} image{targetCount > 1 ? "s" : ""}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Choose one or more reasons. The selected reason(s) or your custom
          message will be sent to the uploader.
        </p>
        <div className="mb-4 space-y-2">
          {AIRCRAFT_IMAGE_REJECTION_REASONS.map((reason) => {
            const checked = selectedReasons.includes(reason);

            return (
              <label
                key={reason}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleReason(reason)}
                  className="mt-0.5 h-4 w-4 rounded border-input text-red-500 focus:ring-red-500/50"
                />
                <span className="text-foreground">{reason}</span>
              </label>
            );
          })}
        </div>
        <div className="mb-4 space-y-2">
          <label
            htmlFor="custom-reject-reason"
            className="block text-sm font-medium text-foreground"
          >
            Custom
          </label>
          <textarea
            id="custom-reject-reason"
            value={customReason}
            onChange={(e) => onCustomReasonChange(e.target.value)}
            placeholder="Type a custom rejection reason if needed"
            className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-red-500/50"
            rows={3}
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!hasReason}
            className="flex-1 cursor-pointer rounded-lg bg-red-500/15 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
