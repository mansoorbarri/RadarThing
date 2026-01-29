"use client";

import { useCallback, useState, useImperativeHandle, forwardRef } from "react";
import { useDropzone } from "@uploadthing/react";
import { generateClientDropzoneAccept } from "uploadthing/client";
import { useUploadThing } from "~/lib/uploadthing";
import { X, Loader2, ImageIcon, AlertCircle } from "lucide-react";

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;
const JPEG_QUALITY = 0.8;
const MAX_FILE_SIZE = 512 * 1024; // 512KB

// Compress image using canvas
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to compress image"));
            return;
          }
          // Create new file with same name but .jpg extension
          const baseName = file.name.replace(/\.[^.]+$/, "");
          const compressedFile = new File([blob], `${baseName}.jpg`, {
            type: "image/jpeg",
          });
          resolve(compressedFile);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

interface ImageUploaderProps {
  onUploadComplete: (url: string, key: string) => void;
  onError: (error: string) => void;
  onFileSelected?: (hasFile: boolean) => void;
  airlineIata?: string;
  airlineIcao?: string;
  aircraftType?: string;
  externalUploadTrigger?: boolean;
}

export interface ImageUploaderRef {
  triggerUpload: () => Promise<boolean>;
  hasFile: () => boolean;
  reset: () => void;
}

// Convert technical error messages to human-readable ones
function getHumanReadableError(error: Error | string): string {
  const message = typeof error === "string" ? error : error.message;
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("filesize") || lowerMessage.includes("file size") || lowerMessage.includes("too large") || lowerMessage.includes("size limit")) {
    return "File is too large. Maximum size is 512KB. Please choose a smaller image.";
  }

  if (lowerMessage.includes("file type") || lowerMessage.includes("filetype") || lowerMessage.includes("invalid type")) {
    return "Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.";
  }

  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("not authenticated")) {
    return "You must be signed in to upload images.";
  }

  if (lowerMessage.includes("network") || lowerMessage.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }

  if (lowerMessage.includes("timeout")) {
    return "Upload timed out. Please try again with a smaller file.";
  }

  // Return original message if no match, but clean it up
  return message.replace(/([A-Z])/g, " $1").trim() || "Upload failed. Please try again.";
}

export const ImageUploader = forwardRef<ImageUploaderRef, ImageUploaderProps>(
  function ImageUploader({ onUploadComplete, onError, onFileSelected, airlineIata, airlineIcao, aircraftType, externalUploadTrigger = false }, ref) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [localError, setLocalError] = useState<string | null>(null);

    const { startUpload } = useUploadThing("aircraftImageUploader", {
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

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
      setLocalError(null);
      const selectedFile = acceptedFiles[0];

      if (!selectedFile) return;

      setIsCompressing(true);

      try {
        // Compress the image
        const compressedFile = await compressImage(selectedFile);

        // Check if compressed file is still too large
        if (compressedFile.size > MAX_FILE_SIZE) {
          const errorMsg = "Image is still too large after compression. Please choose a smaller image.";
          setLocalError(errorMsg);
          onError(errorMsg);
          setIsCompressing(false);
          return;
        }

        setFile(compressedFile);
        onFileSelected?.(true);

        // Create preview from compressed file
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(compressedFile);
      } catch (err) {
        const errorMsg = "Failed to process image. Please try another file.";
        setLocalError(errorMsg);
        onError(errorMsg);
      } finally {
        setIsCompressing(false);
      }
    }, [onError, onFileSelected]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: generateClientDropzoneAccept(["image"]),
      maxFiles: 1,
      multiple: false,
    });

    const triggerUpload = useCallback(async (): Promise<boolean> => {
      if (!file) return false;

      // Require both airline codes and aircraft type before upload
      if (!airlineIata || !airlineIcao || !aircraftType) {
        const errorMsg = "Please fill in both Airline codes (IATA and ICAO) and Aircraft Type before uploading.";
        setLocalError(errorMsg);
        onError(errorMsg);
        return false;
      }

      setIsUploading(true);
      setLocalError(null);
      setUploadProgress(0);

      try {
        // Rename file to IATA-ICAO-aircraftType format (e.g., EK-UAE-A380.jpg)
        const extension = file.name.split('.').pop() || 'png';
        const newFileName = `${airlineIata}-${airlineIcao}-${aircraftType}.${extension}`;
        const renamedFile = new File([file], newFileName, { type: file.type });

        const result = await startUpload([renamedFile]);
        return !!result && result.length > 0;
      } catch (error) {
        const humanError = getHumanReadableError(error as Error);
        setLocalError(humanError);
        onError(humanError);
        setIsUploading(false);
        return false;
      }
    }, [file, airlineIata, airlineIcao, aircraftType, startUpload, onError]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      triggerUpload,
      hasFile: () => !!file,
      reset: resetState,
    }), [triggerUpload, file, resetState]);

    const handleRemove = () => {
      resetState();
    };

    // Show preview (with or without upload controls based on externalUploadTrigger)
    if (file && preview) {
      return (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="w-full object-cover"
            />
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

    // Show compressing state
    if (isCompressing) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/50 bg-cyan-500/10 p-8">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <span className="mt-3 font-medium text-white">Compressing image...</span>
          <span className="mt-1 text-sm text-slate-400">This will only take a moment</span>
        </div>
      );
    }

    // Show dropzone
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
            <div className={`rounded-full p-3 ${isDragActive ? "bg-cyan-500/20" : "bg-white/5"}`}>
              <ImageIcon className={`h-8 w-8 ${isDragActive ? "text-cyan-400" : "text-slate-400"}`} />
            </div>

            <div>
              <p className="font-medium text-white">
                {isDragActive ? "Drop image here" : "Drag & drop an image"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                or <span className="text-cyan-400 underline">click to browse</span>
              </p>
            </div>

            <p className="text-xs text-slate-500">
              JPG, PNG, GIF or WebP • Auto-compressed
            </p>
          </div>
        </div>
      </div>
    );
  }
);
