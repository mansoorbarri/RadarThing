"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import {
  createAircraftImage,
  validateUploadEligibility,
} from "~/app/actions/aircraft-images";
import {
  ImageUploader,
  type ImageUploaderRef,
} from "~/components/ui/image-uploader";

type SubmitStage =
  | "idle"
  | "validating"
  | "uploading"
  | "submitting"
  | "success";

export function ImageUploadModal({ onClose }: { onClose: () => void }) {
  const [isMilitary, setIsMilitary] = useState(false);
  const [formData, setFormData] = useState({
    airlineIata: "",
    airlineIcao: "",
    aircraftType: "",
  });
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const uploaderRef = useRef<ImageUploaderRef>(null);
  const uploadedDataRef = useRef<{ url: string; key: string } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isProcessing = submitStage !== "idle" && submitStage !== "success";

  function handleUploadComplete(url: string, key: string) {
    uploadedDataRef.current = { url, key };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!hasSelectedFile) {
      toast.error("Please select an image first");
      setError("Please select an image first");
      return;
    }
    if (isMilitary) {
      if (!formData.airlineIcao) {
        toast.error("Air force name is required (e.g., USAF, PAF)");
        setError("Air force name is required (e.g., USAF, PAF)");
        return;
      }
    } else {
      if (!formData.airlineIata || !formData.airlineIcao) {
        toast.error("Both IATA and ICAO airline codes are required");
        setError("Both IATA and ICAO airline codes are required");
        return;
      }
    }
    if (!formData.aircraftType) {
      toast.error("Aircraft type is required");
      setError("Aircraft type is required");
      return;
    }

    const effectiveIata = isMilitary ? "MIL" : formData.airlineIata;

    setError(null);
    uploadedDataRef.current = null;

    setSubmitStage("validating");
    const validation = await validateUploadEligibility({
      airlineIata: effectiveIata,
      airlineIcao: formData.airlineIcao,
      aircraftType: formData.aircraftType,
      isMilitary,
    });

    if (!validation.canUpload) {
      setError(validation.error || "Validation failed");
      toast.error(validation.error || "Validation failed");
      setSubmitStage("idle");
      return;
    }

    setSubmitStage("uploading");
    const uploadSuccess = await uploaderRef.current?.triggerUpload();

    if (!uploadSuccess || !uploadedDataRef.current) {
      setError("Failed to upload image");
      setSubmitStage("idle");
      return;
    }

    const { url: imageUrl, key: imageKey } = uploadedDataRef.current;

    setSubmitStage("submitting");
    const result = await createAircraftImage({
      airlineIata: effectiveIata,
      airlineIcao: formData.airlineIcao,
      aircraftType: formData.aircraftType,
      imageUrl,
      imageKey,
      isMilitary,
      rightsConfirmed: true,
    });

    if (result.success) {
      setSubmitStage("success");
      setTimeout(() => {
        toast.success("Image uploaded!");
        onClose();
      }, 1000);
    } else {
      toast.error(result.error || "Failed to submit image");
      setError(result.error || "Failed to submit image");
      setSubmitStage("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="border-border bg-card text-card-foreground relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-2xl">
        <button
          onClick={() => !isProcessing && onClose()}
          disabled={isProcessing}
          className="text-muted-foreground hover:text-foreground absolute top-4 right-4 cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-foreground mb-2 text-xl font-bold">
          Upload Aircraft Image
        </h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Image will be published immediately.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3">
            <div
              className={`relative h-5 w-9 rounded-full transition-colors ${isMilitary ? "bg-cyan-500/40" : "bg-muted"}`}
              onClick={() => {
                setIsMilitary(!isMilitary);
                setFormData((prev) => ({
                  ...prev,
                  airlineIata: "",
                  airlineIcao: "",
                }));
              }}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-slate-200 transition-[left] ${isMilitary ? "left-[18px]" : "left-0.5"}`}
              />
            </div>
            <span className="text-muted-foreground font-mono text-xs">
              MILITARY AIRCRAFT
            </span>
          </label>

          {isMilitary ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-muted-foreground mb-2 block font-mono text-xs">
                  AIR FORCE *
                </label>
                <input
                  type="text"
                  value={formData.airlineIcao}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      airlineIcao: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g., USAF"
                  maxLength={10}
                  required
                  disabled={isProcessing}
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-4 py-3 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-2 block font-mono text-xs">
                  AIRCRAFT *
                </label>
                <input
                  type="text"
                  value={formData.aircraftType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      aircraftType: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="F16"
                  maxLength={10}
                  required
                  disabled={isProcessing}
                  title="Use base model only (e.g., F16, C130)"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-4 py-3 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-muted-foreground mb-2 block font-mono text-xs">
                  IATA CODE *
                </label>
                <input
                  type="text"
                  value={formData.airlineIata}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      airlineIata: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g., EK"
                  maxLength={2}
                  required
                  disabled={isProcessing}
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-4 py-3 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-2 block font-mono text-xs">
                  ICAO CODE *
                </label>
                <input
                  type="text"
                  value={formData.airlineIcao}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      airlineIcao: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g., UAE"
                  maxLength={4}
                  required
                  disabled={isProcessing}
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-4 py-3 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-2 block font-mono text-xs">
                  AIRCRAFT *
                </label>
                <input
                  type="text"
                  value={formData.aircraftType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      aircraftType: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="B777"
                  maxLength={10}
                  required
                  disabled={isProcessing}
                  title="Use base model only (e.g., B777, A350) — not variants"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-4 py-3 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            {isMilitary
              ? "Enter the air force name (e.g., USAF, PAF, RAF) and aircraft model."
              : "Aircraft should be base model only, not the variant. Like: B777. Not: B77W."}
          </p>

          <div>
            <label className="text-muted-foreground mb-2 block font-mono text-xs">
              SELECT IMAGE
            </label>
            <ImageUploader
              ref={uploaderRef}
              airlineIata={isMilitary ? "MIL" : formData.airlineIata}
              airlineIcao={formData.airlineIcao}
              aircraftType={formData.aircraftType}
              externalUploadTrigger={true}
              onUploadComplete={handleUploadComplete}
              onFileSelected={setHasSelectedFile}
              onError={(err) => {
                setError(err);
                setSubmitStage("idle");
              }}
            />
          </div>

          <button
            type="submit"
            disabled={
              isProcessing || !hasSelectedFile || submitStage === "success"
            }
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              submitStage === "success"
                ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-500/20"
                : "bg-gradient-to-r from-cyan-500 to-blue-500 shadow-cyan-500/20 hover:shadow-cyan-500/40"
            }`}
          >
            {submitStage === "validating" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Validating...
              </>
            ) : submitStage === "uploading" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : submitStage === "submitting" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : submitStage === "success" ? (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Uploaded!
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Upload
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
