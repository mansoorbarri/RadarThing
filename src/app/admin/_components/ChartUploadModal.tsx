"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { createAirportChart } from "~/app/actions/airport-charts";
import {
  ChartUploader,
  type ChartUploaderRef,
} from "~/components/ui/chart-uploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ChartType } from "~/types/airportCharts";

type SubmitStage =
  | "idle"
  | "validating"
  | "uploading"
  | "submitting"
  | "success";

export function ChartUploadModal({ onClose }: { onClose: () => void }) {
  const chartTypes: { value: ChartType; label: string }[] = [
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
          rightsConfirmed: true,
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
      <div className="border-border bg-card text-card-foreground relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-4 shadow-2xl sm:p-6">
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

          <div className="grid gap-4 sm:grid-cols-2">
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
              <Select
                value={formData.chartType}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    chartType: value as ChartType,
                  })
                }
                disabled={isProcessing}
              >
                <SelectTrigger className="h-12 w-full rounded-lg border-white/10 bg-black/40 px-4 text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0b1118] text-white">
                  {chartTypes.map((type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                      className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
