"use client";

import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { createAirportChart } from "~/app/actions/airport-charts";
import {
  ChartUploader,
  type ChartUploaderRef,
} from "~/components/ui/chart-uploader";
import {
  Upload,
  Map,
  Check,
  Search,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";
import type { ChartType } from "~/types/airportCharts";

// Cookie helpers - shared with aircraft-images
function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2)
    return decodeURIComponent(parts.pop()?.split(";").shift() || "");
  return "";
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "TAXI", label: "Ground / Airport Diagram" },
  { value: "SID", label: "SID (Departure)" },
  { value: "STAR", label: "STAR (Arrival)" },
  { value: "APPROACH", label: "Approach" },
];

type SubmitStage = "idle" | "uploading" | "submitting" | "success";

function matchesSearch(
  chart: { icao?: string; chartName?: string; chartType?: string },
  query: string,
): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    chart.icao?.toLowerCase().includes(q) ||
    chart.chartName?.toLowerCase().includes(q) ||
    chart.chartType?.toLowerCase().includes(q) ||
    false
  );
}

export default function AirportChartsPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  const chartsQuery = useQuery(api.airportCharts.getApproved);
  const charts = useMemo(() => chartsQuery ?? [], [chartsQuery]);
  const loading = chartsQuery === undefined;

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [icaoFilter, setIcaoFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<ChartType | "">("");
  const [formData, setFormData] = useState({
    icao: "",
    chartType: "TAXI" as ChartType,
    discordUsername: "",
  });

  // Load Discord username from cookie on mount (shared with aircraft-images)
  useEffect(() => {
    const savedUsername = getCookie("radarthing_discord");
    if (savedUsername) {
      setFormData((prev) => ({ ...prev, discordUsername: savedUsername }));
    }
  }, []);

  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSelectedFiles, setHasSelectedFiles] = useState(false);
  const uploaderRef = useRef<ChartUploaderRef>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!showUploadModal) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showUploadModal]);

  const uniqueIcaos = useMemo(() => {
    const icaos = new Set<string>();
    charts.forEach((chart) => {
      if (!chart.icao) return;
      if (!matchesSearch(chart, searchQuery)) return;
      if (typeFilter && chart.chartType !== typeFilter) return;
      icaos.add(chart.icao);
    });
    return Array.from(icaos).sort();
  }, [charts, searchQuery, typeFilter]);

  useEffect(() => {
    if (icaoFilter && !uniqueIcaos.includes(icaoFilter)) {
      setIcaoFilter("");
    }
  }, [uniqueIcaos, icaoFilter]);

  const filteredCharts = useMemo(() => {
    return charts
      .filter((chart) => {
        if (icaoFilter && chart.icao !== icaoFilter) return false;
        if (typeFilter && chart.chartType !== typeFilter) return false;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matches =
            chart.icao?.toLowerCase().includes(query) ||
            chart.chartName?.toLowerCase().includes(query) ||
            chart.chartType?.toLowerCase().includes(query);
          if (!matches) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const icaoCompare = (a.icao || "").localeCompare(b.icao || "");
        if (icaoCompare !== 0) return icaoCompare;
        const typeCompare = (a.chartType || "").localeCompare(
          b.chartType || "",
        );
        if (typeCompare !== 0) return typeCompare;
        return (a.chartName || "").localeCompare(b.chartName || "");
      });
  }, [charts, searchQuery, icaoFilter, typeFilter]);

  async function handleUploadAndSubmit(e: React.FormEvent) {
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
    setSubmitProgress(null);

    const results = await uploaderRef.current?.triggerUpload();

    if (!results || results.length === 0) {
      if (submitStage !== "idle") {
        setSubmitStage("idle");
      }
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
          discordUsername: formData.discordUsername || undefined,
        }),
      ),
    );

    const successCount = dbResults.filter((r) => r.success).length;
    const failCount = dbResults.length - successCount;

    if (formData.discordUsername) {
      setCookie("radarthing_discord", formData.discordUsername);
    }

    setSubmitStage("success");
    setSubmitProgress(null);

    setTimeout(() => {
      if (failCount > 0) {
        toast.success(
          `${successCount} chart${successCount !== 1 ? "s" : ""} submitted for review! (${failCount} failed)`,
        );
      } else {
        toast.success(
          `${successCount} chart${successCount !== 1 ? "s" : ""} submitted for review!`,
        );
      }
      setShowUploadModal(false);
      setSubmitStage("idle");
      setSubmitProgress(null);
      setHasSelectedFiles(false);
      uploaderRef.current?.reset();
      setFormData((prev) => ({
        icao: "",
        chartType: "TAXI" as ChartType,
        discordUsername: prev.discordUsername,
      }));
    }, 1500);
  }

  const getButtonContent = () => {
    const fileCount = uploaderRef.current?.fileCount() ?? 0;
    switch (submitStage) {
      case "uploading":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading...
          </>
        );
      case "submitting":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {submitProgress ?? "Submitting..."}
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle2 className="h-5 w-5" />
            Success!
          </>
        );
      default:
        return (
          <>
            <Upload className="h-5 w-5" />
            Upload & Submit{fileCount > 1 ? ` (${fileCount})` : ""}
          </>
        );
    }
  };

  const isProcessing = submitStage !== "idle" && submitStage !== "success";

  if (!isLoaded || loading) {
    return <GallerySkeleton />;
  }

  const canUpload = isSignedIn;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/radar")}
            className="cursor-pointer font-mono text-xl text-cyan-400"
          >
            <Image
              src="/logo-white.svg"
              alt="RadarThing"
              width={100}
              height={30}
            />
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/radar")}
              className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white"
            >
              Back to Map
            </button>
            {isSignedIn ? (
              <UserAuth />
            ) : (
              <SignInButton mode="modal">
                <button className="cursor-pointer rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
              <Map className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-400">
                AIRPORT CHARTS
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white">Airport Charts</h1>
            <p className="mt-2 text-slate-400">
              Community-contributed airport charts. SIDs, STARs, approaches, and
              more.
            </p>
          </div>
          {canUpload ? (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40"
            >
              <Upload className="h-5 w-5" />
              Upload Chart
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40">
                <Upload className="h-5 w-5" />
                Sign in to Upload
              </button>
            </SignInButton>
          )}
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ICAO, chart name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={icaoFilter}
              onChange={(e) => setIcaoFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white transition-all outline-none focus:border-cyan-500/50"
            >
              <option value="">All Airports</option>
              {uniqueIcaos.map((icao) => (
                <option key={icao} value={icao}>
                  {icao}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ChartType | "")}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white transition-all outline-none focus:border-cyan-500/50"
            >
              <option value="">All Types</option>
              {CHART_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {(searchQuery || icaoFilter || typeFilter) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setIcaoFilter("");
                  setTypeFilter("");
                }}
                className="cursor-pointer rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        {(searchQuery || icaoFilter || typeFilter) && (
          <p className="mb-4 text-sm text-slate-400">
            Showing {filteredCharts.length} of {charts.length} charts
          </p>
        )}

        {filteredCharts.length === 0 && charts.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <Search className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <h3 className="mb-2 text-xl font-semibold text-white">
              No Results Found
            </h3>
            <p className="text-slate-400">
              Try adjusting your search or filters
            </p>
          </div>
        ) : charts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <Map className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <h3 className="mb-2 text-xl font-semibold text-white">
              No Charts Yet
            </h3>
            <p className="text-slate-400">
              Be the first to contribute an airport chart!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCharts.map((chart) => (
              <a
                key={chart.id}
                href={chart.chartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition-all hover:border-cyan-500/30"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-900/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={chart.chartUrl}
                    alt={chart.chartName}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <ExternalLink className="absolute right-2 bottom-2 h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
                      {chart.icao}
                    </span>
                    <span className="rounded-md bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-400">
                      {chart.chartType}
                    </span>
                    <Check className="ml-auto h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="truncate text-sm text-white">
                    {chart.chartName}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f14] p-6 shadow-2xl">
            <button
              onClick={() => {
                if (isProcessing) return;
                setShowUploadModal(false);
                setError(null);
                setSubmitStage("idle");
                setSubmitProgress(null);
                setHasSelectedFiles(false);
                uploaderRef.current?.reset();
                setFormData((prev) => ({
                  icao: "",
                  chartType: "TAXI" as ChartType,
                  discordUsername: prev.discordUsername,
                }));
              }}
              disabled={isProcessing}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              ✕
            </button>

            <h2 className="mb-2 text-xl font-bold text-white">
              Upload Airport Chart
            </h2>
            <p className="mb-6 text-sm text-slate-400">
              Your chart will be reviewed by our team before appearing in the
              library.
            </p>

            <form
              ref={formRef}
              onSubmit={handleUploadAndSubmit}
              className="space-y-4"
            >
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
                  YOUR DISCORD USERNAME (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={formData.discordUsername}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discordUsername: e.target.value,
                    })
                  }
                  placeholder="e.g., xyzmani"
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
                  SELECT CHART FILES
                  {hasSelectedFiles && uploaderRef.current && (
                    <span className="ml-2 rounded-full bg-cyan-500/20 px-2 py-0.5 text-cyan-400">
                      {uploaderRef.current.fileCount()} file
                      {uploaderRef.current.fileCount() !== 1 ? "s" : ""}{" "}
                      selected
                    </span>
                  )}
                </label>
                <ChartUploader
                  ref={uploaderRef}
                  icao={formData.icao}
                  onUploadComplete={() => {
                    // handled via triggerUpload return value
                  }}
                  onFileSelected={setHasSelectedFiles}
                  onError={(err) => {
                    setError(err);
                    toast.error(err);
                    setSubmitStage("idle");
                  }}
                />
              </div>

              {/* Success overlay is rendered outside the form */}

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
                {getButtonContent()}
              </button>
            </form>

            {/* Success Overlay — covers entire modal */}
            {submitStage === "success" && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-[#0a0f14]">
                {/* Subtle grid pattern background */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
                  style={{ backgroundImage: "linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
                />

                {/* Expanding location pulse */}
                <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="absolute -inset-10 animate-[mapPulse_1.5s_ease-out_forwards] rounded-full border border-cyan-400/30 opacity-0" />
                  <div className="absolute -inset-16 animate-[mapPulse_1.5s_ease-out_0.2s_forwards] rounded-full border border-cyan-400/15 opacity-0" />
                  <div className="absolute -inset-24 animate-[mapPulse_1.5s_ease-out_0.4s_forwards] rounded-full border border-cyan-400/[0.07] opacity-0" />
                </div>

                {/* Center content */}
                <div className="relative z-10 flex flex-col items-center animate-[fadeInUp_0.5s_ease-out_forwards]"
                  style={{ opacity: 0 }}>
                  {/* Map pin drop effect */}
                  <div className="relative mb-5">
                    <div className="absolute -bottom-1 left-1/2 h-2 w-10 -translate-x-1/2 animate-[pinShadow_0.4s_ease-out_forwards] rounded-full bg-cyan-400/20 blur-sm" style={{ opacity: 0 }} />
                    <div className="relative flex h-20 w-20 animate-[pinDrop_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards] items-center justify-center rounded-full border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
                      style={{ transform: "translateY(-20px)", opacity: 0 }}>
                      <Map className="h-9 w-9 text-cyan-400" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="text-lg font-semibold text-emerald-400">
                      Submitted for Review!
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Your charts are now in the queue
                  </p>
                </div>

                <style jsx>{`
                  @keyframes mapPulse {
                    0% { transform: scale(0.5); opacity: 0; }
                    30% { opacity: 1; }
                    100% { transform: scale(1); opacity: 0; }
                  }
                  @keyframes pinDrop {
                    0% { transform: translateY(-20px); opacity: 0; }
                    60% { transform: translateY(2px); opacity: 1; }
                    100% { transform: translateY(0); opacity: 1; }
                  }
                  @keyframes pinShadow {
                    0% { transform: translateX(-50%) scale(0.3); opacity: 0; }
                    60% { transform: translateX(-50%) scale(1.1); opacity: 0.3; }
                    100% { transform: translateX(-50%) scale(1); opacity: 0.2; }
                  }
                  @keyframes fadeInUp {
                    0% { transform: translateY(12px); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                  }
                `}</style>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

function ChartCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="ml-auto h-4 w-4 rounded-full" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Skeleton className="h-8 w-24" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
              <Map className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-400">
                AIRPORT CHARTS
              </span>
            </div>
            <Skeleton className="mt-2 h-9 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <Skeleton className="h-12 w-36 rounded-xl" />
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
          <ChartCardSkeleton />
          <ChartCardSkeleton />
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
      </main>
    </div>
  );
}
