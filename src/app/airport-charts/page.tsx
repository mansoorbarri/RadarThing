"use client";

import { ModalShell } from "~/components/ui/modal-shell";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
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
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import type { ChartType } from "~/types/airportCharts";
import { useProStatus } from "~/hooks/useProStatus";
import Link from "next/link";

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
  { value: "TAXI", label: "Ground / airport diagram" },
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
  const { isAdminUser, isLoading: isProLoading } = useProStatus();

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
  // Kept in state so the "N files selected" badge re-renders.
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
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

  const [icaoError, setIcaoError] = useState<string | null>(null);

  async function handleUploadAndSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Field problems are shown next to the field and focus moves there.
    if (!/^[A-Z0-9]{3,4}$/.test(formData.icao)) {
      setIcaoError(
        formData.icao
          ? "Use the airport's 3–4 character ICAO code, e.g. KJFK."
          : "Enter the airport's ICAO code, e.g. KJFK.",
      );
      setError("Fix the highlighted field.");
      requestAnimationFrame(() =>
        document.getElementById("chart-upload-icao")?.focus(),
      );
      return;
    }
    if (!hasSelectedFiles) {
      setError("Choose at least one chart file to upload.");
      return;
    }
    if (!rightsConfirmed) {
      setError("Confirm that you have permission to share these charts.");
      return;
    }

    setIcaoError(null);
    setError(null);
    setSubmitStage("uploading");
    setSubmitProgress(null);

    const results = await uploaderRef.current?.triggerUpload();

    if (!results || results.length === 0) {
      setSubmitStage("idle");
      return;
    }

    setSubmitStage("submitting");
    setSubmitProgress(`Creating ${results.length} entries…`);

    const dbResults = await Promise.all(
      results.map((upload) =>
        createAirportChart({
          icao: formData.icao,
          chartType: formData.chartType,
          chartName: upload.chartName,
          chartUrl: upload.url,
          imageKey: upload.key,
          discordUsername: formData.discordUsername || undefined,
          rightsConfirmed,
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
        toast.warning(
          `Submitted ${successCount} chart${successCount !== 1 ? "s" : ""} for review; ${failCount} failed. Try those again.`,
        );
      } else {
        toast.success(
          `${successCount} chart${successCount !== 1 ? "s" : ""} submitted for review`,
        );
      }
      setShowUploadModal(false);
      setSubmitStage("idle");
      setSubmitProgress(null);
      setHasSelectedFiles(false);
      setRightsConfirmed(false);
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
            Uploading…
          </>
        );
      case "submitting":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {submitProgress ?? "Submitting…"}
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

  if (!isLoaded || loading || isProLoading) {
    return <GallerySkeleton />;
  }

  if (!isAdminUser) {
    return (
      <div className="bg-site flex min-h-screen flex-col text-white">
        <SiteHeader />
        <main
          id="main-content"
          className="flex flex-1 items-center justify-center px-6 py-16"
        >
          <div className="flex max-w-md flex-col items-center rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <ShieldAlert
              className="mb-4 h-12 w-12 text-red-400"
              aria-hidden="true"
            />
            <h1 className="mb-2 text-xl font-bold">Admin access required</h1>
            <p className="mb-6 text-slate-300">
              This page is for RadarThing administrators. Charts for pilots are
              on the radar: select an airport and open its charts.
            </p>
            <Link
              href="/radar"
              className="rounded-lg bg-cyan-500/20 px-6 py-2.5 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/30"
            >
              Back to the radar
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const canUpload = isSignedIn;

  const closeUploadModal = () => {
    if (isProcessing) return;
    setIcaoError(null);
    setShowUploadModal(false);
    setError(null);
    setSubmitStage("idle");
    setSubmitProgress(null);
    setHasSelectedFiles(false);
    setRightsConfirmed(false);
    uploaderRef.current?.reset();
    setFormData((prev) => ({
      icao: "",
      chartType: "TAXI" as ChartType,
      discordUsername: prev.discordUsername,
    }));
  };

  return (
    <div className="bg-site min-h-screen text-white">
      <SiteHeader />

      <main id="main-content" className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
              <Map className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-400">
                Airport charts
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white">Airport charts</h1>
            <p className="mt-2 text-slate-400">
              Community-contributed airport charts. SIDs, STARs, approaches, and
              more.
            </p>
          </div>
          {canUpload ? (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-300 hover:shadow-cyan-500/40 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
            >
              <Upload className="h-5 w-5" />
              Upload Chart
            </button>
          ) : (
            <GoogleSignInButton>
              <button className="flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-300 hover:shadow-cyan-500/40 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none">
                <Upload className="h-5 w-5" />
                Sign in to Upload
              </button>
            </GoogleSignInButton>
          )}
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search charts"
              placeholder="Search by ICAO or chart name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-400 transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
          </div>
          <div className="flex gap-3">
            <select
              aria-label="Filter by airport"
              value={icaoFilter}
              onChange={(e) => setIcaoFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            >
              <option value="">All airports</option>
              {uniqueIcaos.map((icao) => (
                <option key={icao} value={icao}>
                  {icao}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by chart type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ChartType | "")}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            >
              <option value="">All types</option>
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
            <Search className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-xl font-semibold text-white">
              No Results Found
            </h3>
            <p className="text-slate-400">
              Try adjusting your search or filters
            </p>
          </div>
        ) : charts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <Map className="mx-auto mb-4 h-12 w-12 text-slate-400" />
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
                  <Image
                    src={chart.chartUrl}
                    alt={chart.chartName}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform group-hover:scale-105"
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
      <SiteFooter />

      {/* Upload Modal */}
      {showUploadModal && (
        <ModalShell
          labelledBy="chart-upload-title"
          describedBy="chart-upload-desc"
          onClose={closeUploadModal}
          closeDisabled={isProcessing}
        >
          <button
            type="button"
            aria-label="Close upload dialog"
            onClick={closeUploadModal}
            disabled={isProcessing}
            className="absolute top-4 right-4 cursor-pointer text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">✕</span>
          </button>

          <h2
            id="chart-upload-title"
            className="mb-2 text-xl font-bold text-white"
          >
            Upload Airport Chart
          </h2>
          <p id="chart-upload-desc" className="mb-6 text-sm text-slate-300">
            Your chart will be reviewed by our team before appearing in the
            library.
          </p>

          <form
            ref={formRef}
            onSubmit={handleUploadAndSubmit}
            // Validation is done in handleUploadAndSubmit so every error is
            // shown inline next to its field.
            noValidate
            className="space-y-4"
          >
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="chart-upload-icao"
                  className="mb-2 block font-mono text-xs text-slate-300"
                >
                  ICAO code *
                </label>
                <input
                  id="chart-upload-icao"
                  type="text"
                  aria-invalid={Boolean(icaoError)}
                  aria-describedby={
                    icaoError ? "chart-upload-icao-error" : undefined
                  }
                  value={formData.icao}
                  onChange={(e) => {
                    setIcaoError(null);
                    setError((current) =>
                      current === "Fix the highlighted field." ? null : current,
                    );
                    setFormData({
                      ...formData,
                      icao: e.target.value.toUpperCase(),
                    });
                  }}
                  placeholder="e.g., KJFK"
                  maxLength={4}
                  required
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-400 transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50 aria-[invalid=true]:border-red-400/70"
                />
                {icaoError && (
                  <p
                    id="chart-upload-icao-error"
                    className="mt-1 text-xs text-red-300"
                  >
                    {icaoError}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="chart-upload-type"
                  className="mb-2 block font-mono text-xs text-slate-300"
                >
                  Chart type *
                </label>
                <select
                  id="chart-upload-type"
                  value={formData.chartType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      chartType: e.target.value as ChartType,
                    })
                  }
                  required
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50"
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
              <label
                htmlFor="chart-upload-discord"
                className="mb-2 block font-mono text-xs text-slate-300"
              >
                Your Discord username (optional)
              </label>
              <input
                id="chart-upload-discord"
                autoComplete="username"
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
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-400 transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-5 text-slate-300">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(event) => setRightsConfirmed(event.target.checked)}
                required
                disabled={isProcessing}
                className="mt-0.5 h-4 w-4 accent-cyan-400"
              />
              <span>
                I created these charts, they are public domain, or I have
                permission to upload and share them under the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-cyan-300 hover:underline"
                >
                  submission terms
                </Link>
                .
              </span>
            </label>

            <div>
              <p className="mb-2 block font-mono text-xs text-slate-400">
                Select chart files
                {hasSelectedFiles && selectedFileCount > 0 && (
                  <span className="ml-2 rounded-full bg-cyan-500/20 px-2 py-0.5 text-cyan-400">
                    {selectedFileCount} file
                    {selectedFileCount !== 1 ? "s" : ""} selected
                  </span>
                )}
              </p>
              <ChartUploader
                ref={uploaderRef}
                icao={formData.icao}
                onUploadComplete={() => {
                  // handled via triggerUpload return value
                }}
                onFileSelected={(has) => {
                  setHasSelectedFiles(has);
                  // Read after the uploader has updated its own list.
                  requestAnimationFrame(() =>
                    setSelectedFileCount(uploaderRef.current?.fileCount() ?? 0),
                  );
                }}
                onError={(err) => {
                  toast.error(err);
                  setSubmitStage("idle");
                }}
              />
            </div>

            {/* Success overlay is rendered outside the form */}

            <button
              type="submit"
              disabled={
                isProcessing ||
                !hasSelectedFiles ||
                !rightsConfirmed ||
                submitStage === "success"
              }
              className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-slate-950 shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                submitStage === "success"
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-500/20"
                  : "bg-cyan-400 text-slate-950 shadow-cyan-500/20 hover:bg-cyan-300 hover:shadow-cyan-500/40"
              }`}
            >
              {getButtonContent()}
            </button>
          </form>

          {/* Success Overlay — covers entire modal */}
          {submitStage === "success" && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-[#0a0f14]">
              {/* Subtle grid pattern background */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />

              {/* Expanding location pulse */}
              <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="absolute -inset-10 animate-[mapPulse_1.5s_ease-out_forwards] rounded-full border border-cyan-400/30 opacity-0" />
                <div className="absolute -inset-16 animate-[mapPulse_1.5s_ease-out_0.2s_forwards] rounded-full border border-cyan-400/15 opacity-0" />
                <div className="absolute -inset-24 animate-[mapPulse_1.5s_ease-out_0.4s_forwards] rounded-full border border-cyan-400/[0.07] opacity-0" />
              </div>

              {/* Center content */}
              <div
                className="relative z-10 flex animate-[fadeInUp_0.5s_ease-out_forwards] flex-col items-center"
                style={{ opacity: 0 }}
              >
                {/* Map pin drop effect */}
                <div className="relative mb-5">
                  <div
                    className="absolute -bottom-1 left-1/2 h-2 w-10 -translate-x-1/2 animate-[pinShadow_0.4s_ease-out_forwards] rounded-full bg-cyan-400/20 blur-sm"
                    style={{ opacity: 0 }}
                  />
                  <div
                    className="relative flex h-20 w-20 animate-[pinDrop_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards] items-center justify-center rounded-full border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
                    style={{ transform: "translateY(-20px)", opacity: 0 }}
                  >
                    <Map className="h-9 w-9 text-cyan-400" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-lg font-semibold text-emerald-400">
                    Submitted for Review!
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-400">
                  Your charts are now in the queue
                </p>
              </div>

              <style jsx>{`
                @keyframes mapPulse {
                  0% {
                    transform: scale(0.5);
                    opacity: 0;
                  }
                  30% {
                    opacity: 1;
                  }
                  100% {
                    transform: scale(1);
                    opacity: 0;
                  }
                }
                @keyframes pinDrop {
                  0% {
                    transform: translateY(-20px);
                    opacity: 0;
                  }
                  60% {
                    transform: translateY(2px);
                    opacity: 1;
                  }
                  100% {
                    transform: translateY(0);
                    opacity: 1;
                  }
                }
                @keyframes pinShadow {
                  0% {
                    transform: translateX(-50%) scale(0.3);
                    opacity: 0;
                  }
                  60% {
                    transform: translateX(-50%) scale(1.1);
                    opacity: 0.3;
                  }
                  100% {
                    transform: translateX(-50%) scale(1);
                    opacity: 0.2;
                  }
                }
                @keyframes fadeInUp {
                  0% {
                    transform: translateY(12px);
                    opacity: 0;
                  }
                  100% {
                    transform: translateY(0);
                    opacity: 1;
                  }
                }
              `}</style>
            </div>
          )}
        </ModalShell>
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
    <div className="bg-site min-h-screen text-white">
      <SiteHeader />

      <main id="main-content" className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
              <Map className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-400">
                Airport charts
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
      <SiteFooter />
    </div>
  );
}
