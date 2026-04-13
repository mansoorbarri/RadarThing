"use client";

import { useCallback, useState, useImperativeHandle, forwardRef } from "react";
import Image from "next/image";
import { useDropzone } from "@uploadthing/react";
import { useUploadThing } from "~/lib/uploadthing";
import { X, Loader2, ImageIcon, AlertCircle, Pencil } from "lucide-react";

interface FileEntry {
  id: string;
  file: File;
  preview: string;
  chartName: string;
}

export interface UploadResult {
  url: string;
  key: string;
  chartName: string;
}

interface ChartUploaderProps {
  onUploadComplete: (results: UploadResult[]) => void;
  onError: (error: string) => void;
  onFileSelected?: (hasFiles: boolean) => void;
  icao?: string;
  disabled?: boolean;
}

export interface ChartUploaderRef {
  triggerUpload: () => Promise<UploadResult[]>;
  hasFiles: () => boolean;
  fileCount: () => number;
  reset: () => void;
}

function getHumanReadableError(error: Error | string): string {
  const message = typeof error === "string" ? error : error.message;
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("filesize") ||
    lowerMessage.includes("file size") ||
    lowerMessage.includes("too large") ||
    lowerMessage.includes("size limit")
  ) {
    return "File is too large. Maximum size is 3MB.";
  }

  if (
    lowerMessage.includes("file type") ||
    lowerMessage.includes("filetype") ||
    lowerMessage.includes("invalid type")
  ) {
    return "Invalid file type. Please upload a PNG image.";
  }

  if (
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("not authenticated")
  ) {
    return "You must be signed in to upload charts.";
  }

  if (lowerMessage.includes("network") || lowerMessage.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }

  if (lowerMessage.includes("timeout")) {
    return "Upload timed out. Please try again with a smaller file.";
  }

  return (
    message.replace(/([A-Z])/g, " $1").trim() ||
    "Upload failed. Please try again."
  );
}

function deriveChartName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export const ChartUploader = forwardRef<ChartUploaderRef, ChartUploaderProps>(
  function ChartUploader(
    { onUploadComplete, onError, onFileSelected, icao, disabled},
    ref,
  ) {
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { startUpload } = useUploadThing("airportChartUploader", {
      onUploadProgress: () => {
        // noop — progress is tracked per-file in triggerUpload
      },
    });

    const resetState = useCallback(() => {
      setFiles([]);
      setIsUploading(false);

      setLocalError(null);
      setEditingId(null);
      onFileSelected?.(false);
    }, [onFileSelected]);

    const onDrop = useCallback(
      (acceptedFiles: File[]) => {
        setLocalError(null);
        if (acceptedFiles.length === 0) return;

        const newEntries: FileEntry[] = acceptedFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          chartName: deriveChartName(file.name),
        }));

        setFiles((prev) => [...prev, ...newEntries].slice(0, 20));
        // Defer parent state update to avoid setState-during-render
        setTimeout(() => onFileSelected?.(true), 0);
      },
      [onFileSelected],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: { "image/png": [".png"] },
      multiple: true,
      maxFiles: 20,
    });

    const removeFile = useCallback(
      (id: string) => {
        setFiles((prev) => {
          const entry = prev.find((f) => f.id === id);
          if (entry) URL.revokeObjectURL(entry.preview);
          const next = prev.filter((f) => f.id !== id);
          // Defer parent state update to avoid setState-during-render
          setTimeout(() => onFileSelected?.(next.length > 0), 0);
          return next;
        });
      },
      [onFileSelected],
    );

    const updateChartName = useCallback((id: string, chartName: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, chartName } : f)),
      );
    }, []);

    const triggerUpload = useCallback(async (): Promise<UploadResult[]> => {
      if (files.length === 0) return [];

      if (!icao) {
        const errorMsg = "Please fill in the ICAO code before uploading.";
        setLocalError(errorMsg);
        onError(errorMsg);
        return [];
      }

      const invalidNames = files.filter((f) => f.chartName.trim().length < 1);
      if (invalidNames.length > 0) {
        const errorMsg = "All files must have a chart name.";
        setLocalError(errorMsg);
        onError(errorMsg);
        return [];
      }

      setIsUploading(true);
      setLocalError(null);

      try {
        // Rename all files and upload in a single batch
        const renamedFiles = files.map((entry) => {
          const safeName = entry.chartName.replace(/[^a-zA-Z0-9-_]/g, "-");
          const newFileName = `${icao}-${safeName}.png`;
          return new File([entry.file], newFileName, { type: "image/png" });
        });

        const uploadResults = await startUpload(renamedFiles);

        if (!uploadResults || uploadResults.length === 0) {
          const errorMsg = "Upload failed. Please try again.";
          setLocalError(errorMsg);
          onError(errorMsg);
          setIsUploading(false);
          return [];
        }

        const results: UploadResult[] = uploadResults.map((res, i) => ({
          url: res.ufsUrl,
          key: res.key,
          chartName: files[i]!.chartName,
        }));

        setIsUploading(false);

        onUploadComplete(results);
        return results;
      } catch (error) {
        const humanError = getHumanReadableError(error as Error);
        setLocalError(humanError);
        onError(humanError);
        setIsUploading(false);

        return [];
      }
    }, [files, icao, startUpload, onError, onUploadComplete]);

    useImperativeHandle(
      ref,
      () => ({
        triggerUpload,
        hasFiles: () => files.length > 0,
        fileCount: () => files.length,
        reset: resetState,
      }),
      [triggerUpload, files.length, resetState],
    );

    return (
      <div className="space-y-3">
        {localError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-2"
              >
                <div className="relative h-10 w-10 overflow-hidden rounded">
                  <Image
                    src={entry.preview}
                    alt={entry.chartName}
                    fill
                    unoptimized
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {editingId === entry.id ? (
                    <input
                      type="text"
                      value={entry.chartName}
                      onChange={(e) =>
                        updateChartName(entry.id, e.target.value)
                      }
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setEditingId(null);
                      }}
                      autoFocus
                      className="w-full rounded border border-cyan-500/50 bg-black/40 px-2 py-1 text-sm text-white outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => !isUploading && setEditingId(entry.id)}
                      className="flex w-full cursor-pointer items-center gap-1.5 text-left"
                      disabled={isUploading}
                    >
                      <span className="truncate text-sm text-white">
                        {entry.chartName}
                      </span>
                      {!isUploading && (
                        <Pencil className="h-3 w-3 flex-shrink-0 text-slate-500" />
                      )}
                    </button>
                  )}
                </div>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => removeFile(entry.id)}
                    className="cursor-pointer rounded p-1 text-slate-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            <span className="font-mono text-sm text-cyan-400">
              Uploading {files.length} file{files.length !== 1 ? "s" : ""}...
            </span>
          </div>
        )}

        {/* Dropzone */}
        {!isUploading && !disabled && (
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all ${
              isDragActive
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-white/20 bg-black/20 hover:border-cyan-500/50 hover:bg-black/30"
            }`}
          >
            <input {...getInputProps()} />

            <div className="flex flex-col items-center gap-3">
              <div
                className={`rounded-full p-3 ${isDragActive ? "bg-cyan-500/20" : "bg-white/5"}`}
              >
                <ImageIcon
                  className={`h-8 w-8 ${isDragActive ? "text-cyan-400" : "text-slate-400"}`}
                />
              </div>

              <div>
                <p className="font-medium text-white">
                  {isDragActive
                    ? "Drop charts here"
                    : files.length > 0
                      ? "Drop more charts or click to add"
                      : "Drag & drop charts"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  or{" "}
                  <span className="text-cyan-400 underline">
                    click to browse
                  </span>
                </p>
              </div>

              <p className="text-xs text-slate-500">
                PNG only (max 3MB each, up to 20 files)
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);
