"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getProAndAdminStatus } from "~/app/actions/is-pro";
import { createAirportChart } from "~/app/actions/airport-charts";
import {
  createAircraftImage,
  validateUploadEligibility,
} from "~/app/actions/aircraft-images";
import {
  Plane,
  ImageIcon,
  Map,
  Crown,
  Users,
  Upload,
  Flag,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ChartUploader,
  type ChartUploaderRef,
} from "~/components/ui/chart-uploader";
import {
  ImageUploader,
  type ImageUploaderRef,
} from "~/components/ui/image-uploader";
import type { ChartType } from "~/types/airportCharts";

import { AdminHeader } from "./_components/AdminHeader";
import { AdminAccessDenied } from "./_components/AdminAccessDenied";
import { AdminSkeleton } from "./_components/skeletons";
import { AircraftImagesTab } from "./_components/AircraftImagesTab";
import { AirportChartsTab } from "./_components/AirportChartsTab";
import { ChallengesTab } from "./_components/ChallengesTab";
import { ProManagementTab } from "./_components/ProManagementTab";
import { VirtualAirlinesTab } from "./_components/VirtualAirlinesTab";
import { getAdminTabFromPath, getAdminTabHref } from "./adminTabs";
type SubmitStage =
  | "idle"
  | "validating"
  | "uploading"
  | "submitting"
  | "success";

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const mainTab = getAdminTabFromPath(pathname);

  // Queries for counts in tab badges
  const pendingQuery = useQuery(api.aircraftImages.getPending);
  const approvedChartsQuery = useQuery(api.airportCharts.getApproved);
  const pendingCount = pendingQuery?.length ?? 0;

  const loading = !adminCheckDone || pendingQuery === undefined;

  // Check admin status
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      getProAndAdminStatus()
        .then(({ isAdmin, isSuperAdmin: superAdmin }) => {
          setIsAdminUser(isAdmin);
          setIsSuperAdmin(superAdmin);
          setAdminCheckDone(true);
        })
        .catch(() => setAdminCheckDone(true));
    } else if (isLoaded) {
      setAdminCheckDone(true);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!adminCheckDone || !isAdminUser) return;
    if (mainTab === "pro" && !isSuperAdmin) {
      router.replace("/admin");
    }
  }, [adminCheckDone, isAdminUser, isSuperAdmin, mainTab, router]);

  if (!isLoaded || loading) {
    return <AdminSkeleton />;
  }

  if (!isSignedIn || !isAdminUser) {
    return <AdminAccessDenied />;
  }

  if (mainTab === "pro" && !isSuperAdmin) {
    return <AdminSkeleton />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AdminHeader />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-sm text-cyan-400">ADMIN PANEL</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        </div>

        {/* Main Tabs */}
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
          <button
            onClick={() => router.push(getAdminTabHref("images"))}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "images"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Aircraft Images
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push(getAdminTabHref("charts"))}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "charts"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Map className="h-4 w-4" />
            Airport Charts
          </button>
          <button
            onClick={() => router.push(getAdminTabHref("virtual-airlines"))}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "virtual-airlines"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Users className="h-4 w-4" />
            Virtual Airlines
          </button>
          <button
            onClick={() => router.push(getAdminTabHref("challenges"))}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "challenges"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Flag className="h-4 w-4" />
            Challenges
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => router.push(getAdminTabHref("pro"))}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
                mainTab === "pro"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              <Crown className="h-4 w-4" />
              Pro
            </button>
          )}
        </div>

        {mainTab === "images" && <AircraftImagesTab />}
        {mainTab === "charts" && (
          <AirportChartsTab approvedCharts={approvedChartsQuery} />
        )}
        {mainTab === "challenges" && <ChallengesTab />}
        {mainTab === "virtual-airlines" && <VirtualAirlinesTab />}
        {mainTab === "pro" && <ProManagementTab />}
      </main>

      {/* Floating Upload Button */}
      {(mainTab === "images" || mainTab === "charts") && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed right-8 bottom-8 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30 transition-all hover:scale-110 hover:shadow-cyan-500/50"
          title={
            mainTab === "images"
              ? "Upload Aircraft Image"
              : "Upload Airport Chart"
          }
        >
          <Upload className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Upload Modal */}
      {showUploadModal && mainTab === "images" && (
        <ImageUploadModal onClose={() => setShowUploadModal(false)} />
      )}
      {showUploadModal && mainTab === "charts" && (
        <ChartUploadModal onClose={() => setShowUploadModal(false)} />
      )}
    </div>
  );
}

function ChartUploadModal({ onClose }: { onClose: () => void }) {
  const CHART_TYPES: { value: ChartType; label: string }[] = [
    { value: "TAXI", label: "Ground / Airport Diagram" },
    { value: "SID", label: "SID (Departure)" },
    { value: "STAR", label: "STAR (Arrival)" },
    { value: "APPROACH", label: "Approach" },
  ];

  const [formData, setFormData] = useState({
    icao: "",
    chartType: "TAXI" as ChartType,
  });
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSelectedFiles, setHasSelectedFiles] = useState(false);
  const uploaderRef = useRef<ChartUploaderRef>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isProcessing = submitStage !== "idle" && submitStage !== "success";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!hasSelectedFiles) {
      toast.error("Please select at least one chart file");
      setError("Please select at least one chart file");
      return;
    }
    if (!formData.icao || formData.icao.length < 3) {
      toast.error("Valid ICAO code required (3-4 characters)");
      setError("Valid ICAO code required (3-4 characters)");
      return;
    }

    setError(null);
    setSubmitStage("uploading");

    const results = await uploaderRef.current?.triggerUpload();
    if (!results || results.length === 0) {
      setSubmitStage("idle");
      return;
    }

    setSubmitStage("submitting");
    setSubmitProgress(`Creating ${results.length} entries...`);

    const dbResults = await Promise.all(
      results.map((upload) =>
        createAirportChart({
          icao: formData.icao,
          chartType: formData.chartType,
          chartName: upload.chartName,
          chartUrl: upload.url,
          imageKey: upload.key,
        }),
      ),
    );

    const successCount = dbResults.filter((r) => r.success).length;
    const failCount = dbResults.length - successCount;

    setSubmitStage("success");
    setSubmitProgress(null);

    setTimeout(() => {
      toast.success(
        failCount > 0
          ? `${successCount} chart${successCount !== 1 ? "s" : ""} uploaded! (${failCount} failed)`
          : `${successCount} chart${successCount !== 1 ? "s" : ""} uploaded!`,
      );
      onClose();
    }, 1000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f14] p-6 shadow-2xl">
        <button
          onClick={() => !isProcessing && onClose()}
          disabled={isProcessing}
          className="absolute top-4 right-4 cursor-pointer text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-2 text-xl font-bold text-white">
          Upload Airport Charts
        </h2>
        <p className="mb-6 text-sm text-slate-400">
          Charts will be published immediately.
        </p>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block font-mono text-xs text-slate-400">
                ICAO CODE *
              </label>
              <input
                type="text"
                value={formData.icao}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    icao: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., KJFK"
                maxLength={4}
                required
                disabled={isProcessing}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-2 block font-mono text-xs text-slate-400">
                CHART TYPE *
              </label>
              <select
                value={formData.chartType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    chartType: e.target.value as ChartType,
                  })
                }
                required
                disabled={isProcessing}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
              >
                {CHART_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block font-mono text-xs text-slate-400">
              SELECT CHART FILES
              {hasSelectedFiles && uploaderRef.current && (
                <span className="ml-2 rounded-full bg-cyan-500/20 px-2 py-0.5 text-cyan-400">
                  {uploaderRef.current.fileCount()} file
                  {uploaderRef.current.fileCount() !== 1 ? "s" : ""} selected
                </span>
              )}
            </label>
            <ChartUploader
              ref={uploaderRef}
              icao={formData.icao}
              disabled={isProcessing || submitStage === "success"}
              onUploadComplete={() => {
                // handled via triggerUpload return value
              }}
              onFileSelected={setHasSelectedFiles}
              onError={(err) => {
                toast.error(err);
                setSubmitStage("idle");
              }}
            />
          </div>

          <button
            type="submit"
            disabled={
              isProcessing || !hasSelectedFiles || submitStage === "success"
            }
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              submitStage === "success"
                ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-500/20"
                : "bg-gradient-to-r from-cyan-500 to-blue-500 shadow-cyan-500/20 hover:shadow-cyan-500/40"
            }`}
          >
            {submitStage === "uploading" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : submitStage === "submitting" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {submitProgress ?? "Submitting..."}
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
                {(uploaderRef.current?.fileCount() ?? 0) > 1
                  ? ` (${uploaderRef.current?.fileCount()})`
                  : ""}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function ImageUploadModal({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f14] p-6 shadow-2xl">
        <button
          onClick={() => !isProcessing && onClose()}
          disabled={isProcessing}
          className="absolute top-4 right-4 cursor-pointer text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-2 text-xl font-bold text-white">
          Upload Aircraft Image
        </h2>
        <p className="mb-6 text-sm text-slate-400">
          Image will be published immediately.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3">
            <div
              className={`relative h-5 w-9 rounded-full transition-colors ${isMilitary ? "bg-cyan-500/40" : "bg-white/12"}`}
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
            <span className="font-mono text-xs text-slate-400">
              MILITARY AIRCRAFT
            </span>
          </label>

          {isMilitary ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
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
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
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
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
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
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
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
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
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
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">
            {isMilitary
              ? "Enter the air force name (e.g., USAF, PAF, RAF) and aircraft model."
              : "Aircraft should be base model only, not the variant. Like: B777. Not: B77W."}
          </p>

          <div>
            <label className="mb-2 block font-mono text-xs text-slate-400">
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
