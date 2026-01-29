"use client";

import Image from "next/image";
import type { AircraftImage } from "~/app/actions/aircraft-images";

interface ConflictModalProps {
  isOpen: boolean;
  pendingImage: AircraftImage | null;
  existingImage: AircraftImage | null;
  userInfo: Record<string, { email: string; name: string | null }>;
  isLoading: boolean;
  onKeepPending: () => void;
  onKeepExisting: () => void;
  onCancel: () => void;
}

export function ConflictModal({
  isOpen,
  pendingImage,
  existingImage,
  userInfo,
  isLoading,
  onKeepPending,
  onKeepExisting,
  onCancel,
}: ConflictModalProps) {
  if (!isOpen || !pendingImage || !existingImage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-zinc-900 p-6">
        <h3 className="mb-2 text-lg font-semibold text-white">
          Image Conflict Detected
        </h3>
        <p className="mb-6 text-sm text-slate-400">
          An approved image already exists for{" "}
          <span className="font-mono text-cyan-400">
            {pendingImage.airlineIata}/{pendingImage.airlineIcao}
          </span>{" "}
          +{" "}
          <span className="font-mono text-white">{pendingImage.aircraftType}</span>.
          Choose which image to keep. The other will be permanently deleted.
        </p>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {/* Pending Image */}
          <div className="overflow-hidden rounded-xl border border-yellow-500/30 bg-black/40">
            <div className="relative aspect-video">
              <Image
                src={pendingImage.imageUrl}
                alt={`${pendingImage.airlineIata} ${pendingImage.aircraftType}`}
                fill
                className="object-cover"
              />
              <div className="absolute left-2 top-2 rounded-md bg-yellow-500/80 px-2 py-1 text-xs font-bold text-black">
                NEW (PENDING)
              </div>
            </div>
            <div className="p-4">
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
                  {pendingImage.airlineIata}
                </span>
                <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">
                  {pendingImage.airlineIcao}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">
                  {pendingImage.aircraftType}
                </span>
              </div>
              {pendingImage.discordUsername && (
                <p className="mb-1 text-xs text-slate-500">
                  Discord: {pendingImage.discordUsername}
                </p>
              )}
              <p className="mb-1 text-xs text-slate-500">
                Uploaded by{" "}
                <span className="text-cyan-400">
                  {userInfo[pendingImage.uploadedBy]?.email ?? pendingImage.uploadedBy}
                </span>
              </p>
              <p className="text-xs text-slate-600">
                {new Date(pendingImage.createdAt).toLocaleDateString()}
              </p>
              <button
                onClick={onKeepPending}
                disabled={isLoading}
                className="mt-4 w-full cursor-pointer rounded-lg bg-emerald-500/20 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Keep This (Approve New)"}
              </button>
            </div>
          </div>

          {/* Existing Approved Image */}
          <div className="overflow-hidden rounded-xl border border-emerald-500/30 bg-black/40">
            <div className="relative aspect-video">
              <Image
                src={existingImage.imageUrl}
                alt={`${existingImage.airlineIata} ${existingImage.aircraftType}`}
                fill
                className="object-cover"
              />
              <div className="absolute left-2 top-2 rounded-md bg-emerald-500/80 px-2 py-1 text-xs font-bold text-black">
                CURRENT (APPROVED)
              </div>
            </div>
            <div className="p-4">
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
                  {existingImage.airlineIata}
                </span>
                <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">
                  {existingImage.airlineIcao}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">
                  {existingImage.aircraftType}
                </span>
              </div>
              {existingImage.discordUsername && (
                <p className="mb-1 text-xs text-slate-500">
                  Discord: {existingImage.discordUsername}
                </p>
              )}
              <p className="mb-1 text-xs text-slate-500">
                Uploaded by{" "}
                <span className="text-cyan-400">
                  {userInfo[existingImage.uploadedBy]?.email ?? existingImage.uploadedBy}
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Approved {existingImage.approvedAt ? new Date(existingImage.approvedAt).toLocaleDateString() : "N/A"}
              </p>
              <button
                onClick={onKeepExisting}
                disabled={isLoading}
                className="mt-4 w-full cursor-pointer rounded-lg bg-blue-500/20 py-2.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="cursor-pointer rounded-lg border border-white/10 px-6 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
