"use client";

import { type PositionUpdate } from "~/lib/aircraft-store";
import { analytics } from "~/lib/posthog";

interface Props {
  aircrafts: PositionUpdate[];
  onTrack: (aircraft: PositionUpdate) => void;
}

export function FIDSPanel({ aircrafts, onTrack }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="font-mono text-xs tracking-widest text-cyan-400 uppercase">
          Live Flights
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {aircrafts.map((ac) => (
          <FIDSRow key={ac.id ?? ac.callsign} aircraft={ac} onTrack={onTrack} />
        ))}
      </div>
    </div>
  );
}

function FIDSRow({
  aircraft,
  onTrack,
}: {
  aircraft: PositionUpdate;
  onTrack: (aircraft: PositionUpdate) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-2 text-xs">
      <div className="font-mono text-cyan-300">
        {aircraft.flightNo || aircraft.callsign || "—"}
      </div>

      <div className="text-slate-400">
        {aircraft.departure || "UNK"} → {aircraft.arrival || "UNK"}
      </div>

      <div className="text-slate-500">{aircraft.callsign || "—"}</div>

      <button
        onClick={() => {
          analytics.aircraftTracked(aircraft.callsign || aircraft.flightNo || "unknown");
          onTrack(aircraft);
        }}
        className="cursor-pointer rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] tracking-wide text-cyan-300 uppercase hover:bg-cyan-500/20"
      >
        Track
      </button>
    </div>
  );
}
