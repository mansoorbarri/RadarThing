"use client";

import { useState, useEffect } from "react";
import { X, Download, Copy, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { FlightCard, type FlightCardData } from "./FlightCard";
import { useFlightCardExport } from "./useFlightCardExport";
import { Analytics } from "~/lib/analytics";

interface FlightCardDialogProps {
  data: FlightCardData;
  onClose: () => void;
}

export function FlightCardDialog({ data, onClose }: FlightCardDialogProps) {
  const { cardRef, isGenerating, downloadPng, copyToClipboard } =
    useFlightCardExport();
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(0.5);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  // Trigger enter animation on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 200);
  };

  // Calculate scale to fit viewport
  useEffect(() => {
    const updateScale = () => {
      const maxWidth = window.innerWidth - 80;
      const maxHeight = window.innerHeight - 200;
      const scaleX = maxWidth / 1200;
      const scaleY = maxHeight / 630;
      setScale(Math.min(scaleX, scaleY, 0.65));
      setIsCompactViewport(window.innerWidth < 640);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Track dialog open
  useEffect(() => {
    Analytics.flightCardOpened({
      callsign: data.callsign,
      aircraftType: data.aircraftType,
      depICAO: data.depICAO,
      arrICAO: data.arrICAO,
      hasRoute: Boolean(data.routeData && data.routeData.length >= 2),
      source: "dialog",
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const analyticsProps = {
    callsign: data.callsign,
    aircraftType: data.aircraftType,
    depICAO: data.depICAO,
    arrICAO: data.arrICAO,
    hasRoute: Boolean(data.routeData && data.routeData.length >= 2),
  };

  const handleDownload = async () => {
    const filename = [data.callsign, data.depICAO, data.arrICAO]
      .filter(Boolean)
      .join("-");
    await downloadPng(filename || "flight-card");
    Analytics.flightCardDownloaded(analyticsProps);
    toast.success("Flight card downloaded");
  };

  const handleCopy = async () => {
    const didCopy = await copyToClipboard();
    Analytics.flightCardCopied(analyticsProps);
    if (didCopy) {
      setCopied(true);
      toast.success("Flight card copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.success("Flight card downloaded (clipboard not supported)");
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[10050] flex items-center justify-center backdrop-blur-sm transition-all duration-200 ease-out ${
        isVisible && !isClosing ? "bg-black/80" : "bg-black/0"
      }`}
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={handleClose} />

      <div
        className={`relative z-10 flex w-full max-w-[calc(100vw-1.5rem)] flex-col items-center gap-4 px-3 transition-all duration-200 ease-out sm:max-w-none sm:gap-6 sm:px-0 ${
          isVisible && !isClosing
            ? "scale-100 opacity-100"
            : "scale-95 opacity-0"
        }`}
      >
        {isCompactViewport && (
          <button
            onClick={handleClose}
            className="absolute top-0 right-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-black/70 text-white/60 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Card preview */}
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <FlightCard ref={cardRef} data={data} />
        </div>

        {/* Action buttons */}
        <div className="grid w-full max-w-sm grid-cols-2 gap-3 sm:flex sm:w-auto sm:max-w-none sm:items-center">
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 font-mono text-sm font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-5"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PNG
          </button>
          <button
            onClick={handleCopy}
            disabled={isGenerating}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm font-semibold text-white/70 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-5"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          {!isCompactViewport && (
            <button
              onClick={handleClose}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
