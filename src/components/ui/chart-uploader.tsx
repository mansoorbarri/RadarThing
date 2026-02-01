"use client";

import { useCallback, useState, useImperativeHandle, forwardRef } from "react";
import { useDropzone } from "@uploadthing/react";
import { generateClientDropzoneAccept } from "uploadthing/client";
import { useUploadThing } from "~/lib/uploadthing";
import { X, Loader2, ImageIcon, AlertCircle } from "lucide-react";

interface ChartUploaderProps {
  onUploadComplete: (url: string, key: string) => void;
  onError: (error: string) => void;
  onFileSelected?: (hasFile: boolean) => void;
  icao?: string;
  chartName?: string;
  externalUploadTrigger?: boolean;
}

export interface ChartUploaderRef {
  triggerUpload: () => Promise<boolean>;
  hasFile: () => boolean;
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
    return "File is too large. Maximum size is 1MB.";
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

export const ChartUploader = forwardRef<ChartUploaderRef, ChartUploaderProps>(
  function ChartUploader(
    {
      onUploadComplete,
      onError,
      onFileSelected,
      icao,
      chartName,
      externalUploadTrigger = false,
    },
    ref
  ) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [localError, setLocalError] = useState<string | null>(null);

    const { startUpload } = useUploadThing("airportChartUploader", {
      onClientUploadComplete: (res) => {
        if (res?.[0]) {
          onUploadComplete(res[0].ufsUrl, res[0].key);
        }
        setIsUploading(false);
      },
      onUploadError: (error) => {
        const humanError = getHumanReadableError(error);
        setLocalError(humanError);
        onError(humanError);
        setIsUploading(false);
      },
      onUploadProgress: (progress) => {
        setUploadProgress(progress);
      },
    });

    const resetState = useCallback(() => {
      setFile(null);
      setPreview(null);
      setIsUploading(false);
      setUploadProgress(0);
      setLocalError(null);
      onFileSelected?.(false);
    }, [onFileSelected]);

    const onDrop = useCallback(
      (acceptedFiles: File[]) => {
        setLocalError(null);
        const selectedFile = acceptedFiles[0];

        if (!selectedFile) return;

        setFile(selectedFile);
        onFileSelected?.(true);

        const reader = new FileReader();
        reader.onload = (e) => {
          setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
      },
      [onFileSelected]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: {
        "image/png": [".png"],
      },
      maxFiles: 1,
      multiple: false,
    });

    const triggerUpload = useCallback(async (): Promise<boolean> => {
      if (!file) return false;

      if (!icao) {
        const errorMsg = "Please fill in the ICAO code before uploading.";
        setLocalError(errorMsg);
        onError(errorMsg);
        return false;
      }

      if (!chartName) {
        const errorMsg = "Please fill in the chart name before uploading.";
        setLocalError(errorMsg);
        onError(errorMsg);
        return false;
      }

      setIsUploading(true);
      setLocalError(null);
      setUploadProgress(0);

      try {
        const safeName = chartName.replace(/[^a-zA-Z0-9-_]/g, "-");
        const newFileName = `${icao}-${safeName}.png`;
        const renamedFile = new File([file], newFileName, { type: "image/png" });

        const result = await startUpload([renamedFile]);
        return !!result && result.length > 0;
      } catch (error) {
        const humanError = getHumanReadableError(error as Error);
        setLocalError(humanError);
        onError(humanError);
        setIsUploading(false);
        return false;
      }
    }, [file, icao, chartName, startUpload, onError]);

    useImperativeHandle(
      ref,
      () => ({
        triggerUpload,
        hasFile: () => !!file,
        reset: resetState,
      }),
      [triggerUpload, file, resetState]
    );

    const handleRemove = () => {
      resetState();
    };

    if (file) {
      return (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg border border-white/10">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="w-full object-cover" />
            )}
            {!isUploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 cursor-pointer rounded-lg bg-red-500/80 p-1.5 text-white transition-colors hover:bg-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {isUploading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                <span className="mt-2 font-mono text-sm text-white">
                  {uploadProgress}%
                </span>
              </div>
            )}
          </div>

          {localError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{localError}</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {localError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{localError}</span>
          </div>
        )}

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
                {isDragActive ? "Drop chart here" : "Drag & drop a chart"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                or <span className="text-cyan-400 underline">click to browse</span>
              </p>
            </div>

            <p className="text-xs text-slate-500">
              PNG only (max 1MB)
            </p>
          </div>
        </div>
      </div>
    );
  }
);
