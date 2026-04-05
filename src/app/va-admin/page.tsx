"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { Loader2, Trash2, Upload, CheckCircle2, Plane } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  createVirtualAirlineAircraftImage,
  deleteVirtualAirlineAircraftImage,
} from "~/app/actions/virtual-airlines";
import {
  ImageUploader,
  type ImageUploaderRef,
} from "~/components/ui/image-uploader";

type SubmitStage =
  | "idle"
  | "uploading"
  | "submitting"
  | "success";

export default function VirtualAirlineAdminPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const managedVirtualAirlines = useQuery(
    api.virtualAirlines.getManagedByAdmin,
    user?.id ? { adminClerkId: user.id } : "skip",
  );

  const [selectedVaId, setSelectedVaId] = useState<string>("");
  const [aircraftType, setAircraftType] = useState("");
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const uploadedDataRef = useRef<{ url: string; key: string } | null>(null);
  const uploaderRef = useRef<ImageUploaderRef>(null);

  const virtualAirlines = useMemo(
    () => managedVirtualAirlines ?? [],
    [managedVirtualAirlines],
  );

  useEffect(() => {
    if (!selectedVaId && virtualAirlines.length > 0) {
      setSelectedVaId(virtualAirlines[0]!.id);
    }
  }, [selectedVaId, virtualAirlines]);

  useEffect(() => {
    if (
      selectedVaId &&
      virtualAirlines.length > 0 &&
      !virtualAirlines.some((virtualAirline) => virtualAirline.id === selectedVaId)
    ) {
      setSelectedVaId(virtualAirlines[0]!.id);
    }
  }, [selectedVaId, virtualAirlines]);

  const selectedVirtualAirline = useMemo(
    () => virtualAirlines.find((va) => va.id === selectedVaId) ?? null,
    [selectedVaId, virtualAirlines],
  );

  const vaImages = useQuery(
    api.virtualAirlineAircraftImages.getByVirtualAirlineId,
    selectedVaId
      ? { virtualAirlineId: selectedVaId as Id<"virtualAirlines"> }
      : "skip",
  );

  const isProcessing = submitStage !== "idle" && submitStage !== "success";

  const resetUploadForm = () => {
    setAircraftType("");
    setSubmitStage("idle");
    setError(null);
    setHasSelectedFile(false);
    uploadedDataRef.current = null;
    uploaderRef.current?.reset();
  };

  const handleUploadComplete = (url: string, key: string) => {
    uploadedDataRef.current = { url, key };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedVirtualAirline) {
      toast.error("Select a VA first");
      return;
    }

    if (!selectedVirtualAirline.isActive) {
      toast.error("This VA is currently disabled");
      return;
    }

    if (!aircraftType.trim()) {
      toast.error("Aircraft type is required");
      return;
    }

    if (!hasSelectedFile) {
      toast.error("Please select an image first");
      return;
    }

    setError(null);
    uploadedDataRef.current = null;

    setSubmitStage("uploading");
    const uploadSuccess = await uploaderRef.current?.triggerUpload();

    if (!uploadSuccess || !uploadedDataRef.current) {
      setError("Failed to upload image");
      setSubmitStage("idle");
      return;
    }

    setSubmitStage("submitting");

    const uploadedData = uploadedDataRef.current as { url: string; key: string } | null;
    if (!uploadedData) {
      setError("Failed to upload image");
      setSubmitStage("idle");
      return;
    }

    const result = await createVirtualAirlineAircraftImage({
      virtualAirlineId: selectedVirtualAirline.id,
      aircraftType,
      imageUrl: uploadedData.url,
      imageKey: uploadedData.key,
    });

    if (!result.success) {
      setError(result.error || "Failed to save VA aircraft image");
      toast.error(result.error || "Failed to save VA aircraft image");
      setSubmitStage("idle");
      return;
    }

    setSubmitStage("success");
    toast.success("VA aircraft image saved");

    setTimeout(() => {
      resetUploadForm();
    }, 900);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteVirtualAirlineAircraftImage(id);
    setDeletingId(null);

    if (!result.success) {
      toast.error(result.error || "Failed to delete image");
      return;
    }

    toast.success("VA aircraft image deleted");
  };

  if (!isLoaded || (isSignedIn && managedVirtualAirlines === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-semibold">VA Admin Access</h1>
          <p className="mt-3 text-sm text-slate-400">
            Sign in with the RadarThing account assigned to your virtual
            airline.
          </p>
          <div className="mt-6">
            <SignInButton mode="modal">
              <button className="cursor-pointer rounded-xl bg-cyan-500 px-5 py-3 font-medium text-black">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </div>
    );
  }

  if (virtualAirlines.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-2xl font-semibold">No VA Assigned</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This account is not assigned as a virtual airline admin. A
            RadarThing admin needs to register your VA first and pick your
            account as the owner.
          </p>
          <Link
            href="/radar"
            className="mt-6 inline-flex rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-white/10"
          >
            Back to Radar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
              <Plane className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-400">VA ADMIN</span>
            </div>
            <h1 className="text-3xl font-bold text-white">
              Virtual Airline Fleet Images
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Upload fleet images for your VA. These images publish immediately
              and override the community image when your VA callsign prefix is
              used on the radar.
            </p>
          </div>
          <Link
            href="/radar"
            className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-white/10"
          >
            Back to Radar
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <h2 className="text-lg font-semibold text-white">Upload Fleet Image</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
                  VIRTUAL AIRLINE
                </label>
                <select
                  value={selectedVaId}
                  onChange={(event) => {
                    setSelectedVaId(event.target.value);
                    resetUploadForm();
                  }}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition-colors focus:border-cyan-500/50"
                >
                  {virtualAirlines.map((virtualAirline) => (
                    <option key={virtualAirline.id} value={virtualAirline.id}>
                      {virtualAirline.name} ({virtualAirline.callsignPrefix})
                      {virtualAirline.isActive ? "" : " - disabled"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
                  AIRCRAFT TYPE
                </label>
                <input
                  type="text"
                  value={aircraftType}
                  onChange={(event) => setAircraftType(event.target.value.toUpperCase())}
                  placeholder="B737"
                  maxLength={12}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Uploading the same aircraft type again replaces the current VA
                  image.
                </p>
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
                  SELECT IMAGE
                </label>
                <ImageUploader
                  ref={uploaderRef}
                  fileNameBase={
                    selectedVirtualAirline && aircraftType.trim()
                      ? `${selectedVirtualAirline.callsignPrefix}-${aircraftType.trim().toUpperCase()}`
                      : undefined
                  }
                  externalUploadTrigger={true}
                  onUploadComplete={handleUploadComplete}
                  onFileSelected={setHasSelectedFile}
                  onError={(nextError) => {
                    setError(nextError);
                    setSubmitStage("idle");
                  }}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isProcessing ||
                  !hasSelectedFile ||
                  !selectedVirtualAirline?.isActive
                }
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitStage === "uploading" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Uploading...
                  </>
                ) : submitStage === "submitting" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : submitStage === "success" ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Upload VA Image
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">
                {selectedVirtualAirline?.name} Fleet
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Prefix: {selectedVirtualAirline?.callsignPrefix}
              </p>
            </div>

            <div className="space-y-3">
              {(vaImages ?? []).map((image) => (
                <div
                  key={image.id}
                  className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/20 p-4 md:flex-row md:items-center"
                >
                  <div className="relative h-28 w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 md:w-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.imageUrl}
                      alt={image.aircraftType}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-cyan-500/15 px-2 py-1 font-mono text-xs text-cyan-300">
                        {image.aircraftType}
                      </span>
                      <span className="text-xs text-slate-500">
                        Updated {new Date(image.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deletingId === image.id}
                    onClick={() => handleDelete(image.id)}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === image.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </button>
                </div>
              ))}

              {(vaImages ?? []).length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                  No fleet images uploaded yet for this VA.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
