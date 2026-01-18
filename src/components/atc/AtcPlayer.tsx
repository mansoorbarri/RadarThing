"use client";

import { Radio, X, ExternalLink, Headphones } from "lucide-react";

interface AtcPlayerProps {
  icao: string;
  onClose: () => void;
}

export function AtcPlayer({ icao, onClose }: AtcPlayerProps) {
  const searchUrl = `https://www.liveatc.net/search/?icao=${icao}`;

  const openLiveATC = () => {
    window.open(searchUrl, "liveatc", "width=800,height=600,menubar=no,toolbar=no");
  };

  return (
    <div className="fixed bottom-24 left-1/2 z-[10013] w-[320px] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/90 p-4 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-sm text-cyan-400">{icao} ATC</span>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="mb-4 flex flex-col items-center rounded-xl bg-gradient-to-b from-cyan-500/10 to-transparent py-6">
        <Headphones className="mb-3 h-10 w-10 text-cyan-400" />
        <p className="mb-1 text-sm font-medium text-white">Live ATC Audio</p>
        <p className="text-xs text-slate-400">Listen to air traffic control</p>
      </div>

      {/* Actions */}
      <button
        onClick={openLiveATC}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-500/20 py-3 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30"
      >
        <ExternalLink className="h-4 w-4" />
        Open LiveATC for {icao}
      </button>

      <p className="mt-3 text-center text-[10px] text-slate-500">
        Opens in a popup window with all available feeds
      </p>
    </div>
  );
}
