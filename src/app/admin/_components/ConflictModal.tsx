"use client";

import Image from "next/image";
import type { AircraftImage } from "~/app/actions/aircraft-images";

interface ConflictModalProps {
  isOpen: boolean;
  pendingImage: AircraftImage | null;
  existingImage: AircraftImage | null;
  isLoading: boolean;
  onKeepPending: () => void;
  onKeepExisting: () => void;
  onCancel: () => void;
}

export function ConflictModal({
  isOpen,
  pendingImage,
  existingImage,
  isLoading,
  onKeepPending,
  onKeepExisting,
  onCancel,
}: ConflictModalProps) {
  if (!isOpen || !pendingImage || !existingImage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          Image Conflict Detected
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">
          An approved image already exists for{" "}
          <span className="font-mono text-cyan-600 dark:text-cyan-400">
            {pendingImage.airlineIata}/{pendingImage.airlineIcao}
          </span>{" "}
          +{" "}
          <span className="font-mono text-foreground">
            {pendingImage.aircraftType}
          </span>
          . Choose which image to keep. The other will be permanently deleted.
        </p>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {/* Pending Image */}
          <div className="overflow-hidden rounded-xl border border-yellow-500/30 bg-background">
            <div className="relative aspect-video">
              <Image
                src={pendingImage.imageUrl}
                alt={`${pendingImage.airlineIata} ${pendingImage.aircraftType}`}
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute top-2 left-2 rounded-md bg-yellow-500/80 px-2 py-1 text-xs font-bold text-black">
                NEW (PENDING)
              </div>
            </div>
            <div className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-cyan-500/15 px-2 py-1 font-mono text-sm font-bold text-cyan-700 dark:text-cyan-400">
                  {pendingImage.airlineIata}
                </span>
                <span className="rounded-md bg-blue-500/15 px-2 py-1 font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
                  {pendingImage.airlineIcao}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground">
                  {pendingImage.aircraftType}
                </span>
              </div>
              <p className="mb-1 text-xs text-muted-foreground">
                Uploaded by{" "}
                <span className="text-cyan-700 dark:text-cyan-400">
                  {pendingImage.discordUsername ?? pendingImage.uploadedBy}
                </span>
              </p>
              <p className="text-xs text-muted-foreground/80">
                {new Date(pendingImage.createdAt).toLocaleDateString()}
              </p>
              <button
                onClick={onKeepPending}
                disabled={isLoading}
                className="mt-4 w-full cursor-pointer rounded-lg bg-emerald-500/15 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
              >
                {isLoading ? "Processing..." : "Keep This (Approve New)"}
              </button>
            </div>
          </div>

          {/* Existing Approved Image */}
          <div className="overflow-hidden rounded-xl border border-emerald-500/30 bg-background">
            <div className="relative aspect-video">
              <Image
                src={existingImage.imageUrl}
                alt={`${existingImage.airlineIata} ${existingImage.aircraftType}`}
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute top-2 left-2 rounded-md bg-emerald-500/80 px-2 py-1 text-xs font-bold text-black">
                CURRENT (APPROVED)
              </div>
            </div>
            <div className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-cyan-500/15 px-2 py-1 font-mono text-sm font-bold text-cyan-700 dark:text-cyan-400">
                  {existingImage.airlineIata}
                </span>
                <span className="rounded-md bg-blue-500/15 px-2 py-1 font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
                  {existingImage.airlineIcao}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground">
                  {existingImage.aircraftType}
                </span>
              </div>
              <p className="mb-1 text-xs text-muted-foreground">
                Uploaded by{" "}
                <span className="text-cyan-700 dark:text-cyan-400">
                  {existingImage.discordUsername ?? existingImage.uploadedBy}
                </span>
              </p>
              <p className="text-xs text-muted-foreground/80">
                Approved{" "}
                {existingImage.approvedAt
                  ? new Date(existingImage.approvedAt).toLocaleDateString()
                  : "N/A"}
              </p>
              <button
                onClick={onKeepExisting}
                disabled={isLoading}
                className="mt-4 w-full cursor-pointer rounded-lg bg-blue-500/15 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400"
              >
                {isLoading ? "Processing..." : "Keep This (Reject New)"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="cursor-pointer rounded-lg border border-border px-6 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
