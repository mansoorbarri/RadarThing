"use client";

import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  createAirportChart,
  validateChartUploadEligibility,
} from "~/app/actions/airport-charts";
import { ChartUploader, type ChartUploaderRef } from "~/components/ui/chart-uploader";
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
  if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(";").shift() || "");
  return "";
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "GENERAL", label: "General" },
  { value: "TAXI", label: "Ground / Airport Diagram" },
  { value: "SID", label: "SID (Departure)" },
  { value: "STAR", label: "STAR (Arrival)" },
  { value: "APPROACH", label: "Approach" },
];

type SubmitStage = "idle" | "validating" | "uploading" | "submitting" | "success";

function matchesSearch(
  chart: { icao?: string; chartName?: string; chartType?: string },
  query: string
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
    chartType: "GENERAL" as ChartType,
    chartName: "",
    chartUrl: "",
    imageKey: "",
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
  const [error, setError] = useState<string | null>(null);
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const uploaderRef = useRef<ChartUploaderRef>(null);
  const uploadedDataRef = useRef<{ url: string; key: string } | null>(null);

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
        const typeCompare = (a.chartType || "").localeCompare(b.chartType || "");
        if (typeCompare !== 0) return typeCompare;
        return (a.chartName || "").localeCompare(b.chartName || "");
      });
  }, [charts, searchQuery, icaoFilter, typeFilter]);

  const handleUploadComplete = (url: string, key: string) => {
    uploadedDataRef.current = { url, key };
    setFormData((prev) => ({ ...prev, chartUrl: url, imageKey: key }));
  };

  async function handleUploadAndSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!hasSelectedFile) {
      toast.error("Please select a chart file first");
      setError("Please select a chart file first");
      return;
    }
    if (!formData.icao || formData.icao.length < 3) {
      toast.error("Valid ICAO code required (3-4 characters)");
      setError("Valid ICAO code required (3-4 characters)");
      return;
    }
    if (!formData.chartName || formData.chartName.length < 3) {
      toast.error("Chart name is required (at least 3 characters)");
      setError("Chart name is required (at least 3 characters)");
      return;
    }

    setError(null);
    uploadedDataRef.current = null;

    setSubmitStage("validating");
    const validation = await validateChartUploadEligibility({
      icao: formData.icao,
      chartType: formData.chartType,
      chartName: formData.chartName,
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
      setError("Failed to upload chart");
      setSubmitStage("idle");
      return;
    }

    const { url: chartUrl, key: imageKey } = uploadedDataRef.current;

    setSubmitStage("submitting");
    const result = await createAirportChart({
      icao: formData.icao,
      chartType: formData.chartType,
      chartName: formData.chartName,
      chartUrl,
      imageKey,
      discordUsername: formData.discordUsername || undefined,
    });

    if (result.success) {
      // Save Discord username to cookie for next time
      if (formData.discordUsername) {
        setCookie("radarthing_discord", formData.discordUsername);
      }

      setSubmitStage("success");

      setTimeout(() => {
        toast.success("Chart submitted for review!");
        setShowUploadModal(false);
        setSubmitStage("idle");
        setHasSelectedFile(false);
        uploadedDataRef.current = null;
        uploaderRef.current?.reset();
        // Keep Discord username when resetting form
        setFormData((prev) => ({
          icao: "",
          chartType: "GENERAL" as ChartType,
          chartName: "",
          chartUrl: "",
          imageKey: "",
          discordUsername: prev.discordUsername,
        }));
      }, 1500);
    } else {
      toast.error(result.error || "Failed to submit chart");
      setError(result.error || "Failed to submit chart");
      setSubmitStage("idle");
    }
  }

  const getButtonContent = () => {
    switch (submitStage) {
      case "validating":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Validating...
          </>
        );
      case "uploading":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading Chart...
          </>
        );
      case "submitting":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Submitting...
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
            Upload & Submit
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
            onClick={() => router.push("/")}
            className="cursor-pointer font-mono text-xl text-cyan-400"
          >
            <Image src="/logo-white.svg" alt="RadarThing" width={100} height={30} />
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
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
              <span className="font-mono text-sm text-cyan-400">AIRPORT CHARTS</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Airport Charts</h1>
            <p className="mt-2 text-slate-400">
              Community-contributed airport charts. SIDs, STARs, approaches, and more.
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
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ICAO, chart name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={icaoFilter}
              onChange={(e) => setIcaoFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50"
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
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50"
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
            <h3 className="mb-2 text-xl font-semibold text-white">No Results Found</h3>
            <p className="text-slate-400">Try adjusting your search or filters</p>
          </div>
        ) : charts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <Map className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <h3 className="mb-2 text-xl font-semibold text-white">No Charts Yet</h3>
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
                <div className="relative aspect-[4/3] bg-slate-900/50 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={chart.chartUrl}
                    alt={chart.chartName}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <ExternalLink className="absolute bottom-2 right-2 h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2 flex-wrap">
                    <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
                      {chart.icao}
                    </span>
                    <span className="rounded-md bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-400">
                      {chart.chartType}
                    </span>
                    <Check className="ml-auto h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-sm text-white truncate">{chart.chartName}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0f14] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                if (isProcessing) return;
                setShowUploadModal(false);
                setError(null);
                setSubmitStage("idle");
                setHasSelectedFile(false);
                uploadedDataRef.current = null;
                uploaderRef.current?.reset();
                // Keep Discord username when closing modal
                setFormData((prev) => ({
                  icao: "",
                  chartType: "GENERAL" as ChartType,
                  chartName: "",
                  chartUrl: "",
                  imageKey: "",
                  discordUsername: prev.discordUsername,
                }));
              }}
              disabled={isProcessing}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              ✕
            </button>

            <h2 className="mb-2 text-xl font-bold text-white">Upload Airport Chart</h2>
            <p className="mb-6 text-sm text-slate-400">
              Your chart will be reviewed by our team before appearing in the library.
            </p>

            <form onSubmit={handleUploadAndSubmit} className="space-y-4">
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
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
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
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
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
                  CHART NAME *
                </label>
                <input
                  type="text"
                  value={formData.chartName}
                  onChange={(e) =>
                    setFormData({ ...formData, chartName: e.target.value })
                  }
                  placeholder="e.g., RNAV (GPS) RWY 22L"
                  required
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
                  YOUR DISCORD USERNAME (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={formData.discordUsername}
                  onChange={(e) =>
                    setFormData({ ...formData, discordUsername: e.target.value })
                  }
                  placeholder="e.g., xyzmani"
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-400">
                  SELECT CHART FILE
                </label>
                <ChartUploader
                  ref={uploaderRef}
                  icao={formData.icao}
                  chartName={formData.chartName}
                  externalUploadTrigger={true}
                  onUploadComplete={handleUploadComplete}
                  onFileSelected={setHasSelectedFile}
                  onError={(err) => {
                    setError(err);
                    setSubmitStage("idle");
                  }}
                />
              </div>

              {/* Success Animation */}
              {submitStage === "success" && (
                <div className="relative flex flex-col items-center justify-center overflow-hidden py-6">
                  <div className="relative z-10">
                    <div className="absolute inset-0 animate-ping rounded-full border-2 border-cyan-400/50" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/40">
                      <Map className="h-8 w-8 text-white" />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="font-semibold text-emerald-400">
                      Submitted for Review!
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Your chart is now in the queue
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing || !hasSelectedFile || submitStage === "success"}
                className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  submitStage === "success"
                    ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-500/20"
                    : "bg-gradient-to-r from-cyan-500 to-blue-500 shadow-cyan-500/20 hover:shadow-cyan-500/40"
                }`}
              >
                {getButtonContent()}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

function ChartCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
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
              <span className="font-mono text-sm text-cyan-400">AIRPORT CHARTS</span>
            </div>
            <Skeleton className="h-9 w-48 mt-2" />
            <Skeleton className="h-4 w-64 mt-2" />
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
