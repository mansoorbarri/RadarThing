"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { type FlightData, useFlightReplay } from "~/hooks/useFlightReplay";
import { Analytics } from "~/lib/analytics";

// Inline SVG icons
const PlayIcon = ({ className = "" }: { className?: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ className = "" }: { className?: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const CloseIcon = ({ className = "" }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ShareIcon = ({ className = "" }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

const ReplayIcon = ({ className = "" }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface FlightReplayControlsProps {
  flight: FlightData;
  onClose: () => void;
  onStateChange: (state: {
    currentPosition: [number, number] | null;
    currentHeading: number;
    traversedPath: [number, number][];
    remainingPath: [number, number][];
    isPlaying: boolean;
  }) => void;
  isMobile?: boolean;
}

export function FlightReplayControls({
  flight,
  onClose,
  onStateChange,
  isMobile = false,
}: FlightReplayControlsProps) {
  const replay = useFlightReplay(flight);

  // Use ref to store onStateChange to avoid triggering effect
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  // Notify parent of state changes - use elapsedTime as trigger instead of arrays
  useEffect(() => {
    onStateChangeRef.current({
      currentPosition: replay.currentPosition,
      currentHeading: replay.currentHeading,
      traversedPath: replay.traversedPath,
      remainingPath: replay.remainingPath,
      isPlaying: replay.isPlaying,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally using elapsedTime to batch updates
  }, [replay.elapsedTime, replay.isPlaying]);

  // Helper for analytics props
  const getAnalyticsProps = useCallback(
    () => ({
      callsign: flight.callsign,
      aircraftType: flight.aircraftType,
      depICAO: flight.depICAO,
      arrICAO: flight.arrICAO,
      duration: replay.totalDuration,
    }),
    [
      flight.callsign,
      flight.aircraftType,
      flight.depICAO,
      flight.arrICAO,
      replay.totalDuration,
    ],
  );

  // Track play/pause
  const handleTogglePlay = useCallback(() => {
    if (replay.isPlaying) {
      Analytics.flightReplayPaused(getAnalyticsProps());
    } else {
      Analytics.flightReplayStarted(getAnalyticsProps());
    }
    replay.togglePlay();
  }, [replay, getAnalyticsProps]);

  // Track speed change
  const handleSpeedChange = useCallback(
    (speed: number) => {
      Analytics.flightReplaySpeedChanged({ ...getAnalyticsProps(), speed });
      replay.setSpeed(speed as 1 | 2 | 4 | 8 | 16);
    },
    [replay, getAnalyticsProps],
  );

  // Track close
  const handleClose = useCallback(() => {
    Analytics.flightReplayClosed(getAnalyticsProps());
    onClose();
  }, [onClose, getAnalyticsProps]);

  // Share flight replay link
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/radar?replay=${flight.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Flight replay link copied to clipboard");
      Analytics.flightReplayShared({
        ...getAnalyticsProps(),
        flightId: flight.id,
      });
    });
  }, [flight.id, getAnalyticsProps]);

  // Track completion
  const prevProgressRef = useRef(replay.progress);
  useEffect(() => {
    if (prevProgressRef.current < 1 && replay.progress >= 1) {
      Analytics.flightReplayCompleted(getAnalyticsProps());
    }
    prevProgressRef.current = replay.progress;
  }, [replay.progress, getAnalyticsProps]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    replay.seek(value);
  };

  const route = [flight.depICAO, flight.arrICAO].filter(Boolean).join(" → ");

  return (
    <div
      className={`animate-fade-in-up fixed z-[10015] ${
        isMobile ? "inset-x-3 bottom-3" : "bottom-6 left-1/2 -translate-x-1/2"
      }`}
    >
      <div
        className={`rounded-2xl border border-white/10 bg-[#0a1219]/95 shadow-2xl backdrop-blur-xl ${
          isMobile ? "p-3" : "p-4"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between ${isMobile ? "mb-2" : "mb-3"}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
              <ReplayIcon className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-white">
                  {flight.callsign || "Flight Replay"}
                </span>
                {route && (
                  <span className="font-mono text-[10px] text-white/50">
                    {route}
                  </span>
                )}
              </div>
              <div className="font-mono text-[10px] text-white/40">
                {flight.aircraftType || "Unknown Aircraft"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors hover:border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-400"
              title="Copy share link"
            >
              <ShareIcon />
            </button>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className={`flex ${isMobile ? "flex-col gap-2" : "items-center gap-4"}`}>
          <div className={`flex items-center ${isMobile ? "gap-2" : "gap-4"}`}>
            {/* Play/Pause Button */}
            <button
              onClick={handleTogglePlay}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-amber-500 text-black transition-colors hover:bg-amber-400"
            >
              {replay.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            {/* Progress Section */}
            <div className="flex flex-1 flex-col gap-1">
              {/* Progress bar */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={replay.progress}
                onChange={handleProgressChange}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
              />
              {/* Time display */}
              <div className="flex justify-between font-mono text-[10px] text-white/50">
                <span>{formatTime(replay.elapsedTime)}</span>
                <span>{formatTime(replay.totalDuration)}</span>
              </div>
            </div>

            {/* Speed selector - inline on desktop */}
            {!isMobile && (
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                {replay.speedOptions.map((speedOption) => (
                  <button
                    key={speedOption}
                    onClick={() => handleSpeedChange(speedOption)}
                    className={`cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] font-bold transition-colors ${
                      replay.speed === speedOption
                        ? "bg-amber-500 text-black"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {speedOption}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Speed selector - full-width row on mobile */}
          {isMobile && (
            <div className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
              {replay.speedOptions.map((speedOption) => (
                <button
                  key={speedOption}
                  onClick={() => handleSpeedChange(speedOption)}
                  className={`flex-1 cursor-pointer rounded-md py-1.5 font-mono text-[10px] font-bold transition-colors ${
                    replay.speed === speedOption
                      ? "bg-amber-500 text-black"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {speedOption}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
