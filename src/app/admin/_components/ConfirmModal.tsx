"use client";

import { AlertTriangle, Trash2, X as XIcon } from "lucide-react";

export type ConfirmVariant = "danger" | "warning";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              isDanger ? "bg-red-500/20" : "bg-yellow-500/20"
            }`}
          >
            {isDanger ? (
              <Trash2 className="h-7 w-7 text-red-400" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-yellow-400" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-center text-lg font-semibold text-foreground">
          {title}
        </h3>

        {/* Message */}
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 cursor-pointer rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isDanger
                ? "bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400"
                : "bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 dark:text-yellow-400"
            }`}
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
