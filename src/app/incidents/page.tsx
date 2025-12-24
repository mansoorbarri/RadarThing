"use client";

import React, { useEffect, useState } from "react";
import { activeAircraft } from "~/lib/aircraft-store";
import { useAircraftStream } from "~/hooks/useAircraftStream";
import { type Incident } from "~/types/flight";

function LiveBadge({ ts }: { ts: number }) {
  const ageSec = Math.floor((Date.now() - ts) / 1000);
  const live = ageSec < 120;
  return (
    <span
      className={`ml-2 rounded px-2 py-[2px] text-[11px] ${
        live
          ? "bg-green-500/20 text-green-300 border border-green-400/40"
          : "bg-yellow-500/20 text-yellow-300 border border-yellow-400/40"
      }`}
    >
      {live ? "LIVE" : `${ageSec}s ago`}
    </span>
  );
}

export default function IncidentsPage() {
  // Keep stream active so store updates
  useAircraftStream();
  const [incidents, setIncidents] = useState<Incident[]>(activeAircraft.getIncidents());

  useEffect(() => {
    const unsub = activeAircraft.subscribe(() => {
      setIncidents(activeAircraft.getIncidents());
    });
    const t = setInterval(() => setIncidents(activeAircraft.getIncidents()), 5000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#010b10] text-cyan-200 p-6">
      <h1 className="text-cyan-300 text-xl font-semibold mb-4">Incidents (Emergency Squawks)</h1>
      {incidents.length === 0 ? (
        <div className="opacity-70">No incidents in the last 3 hours.</div>
      ) : (
        <div className="rounded-md border border-cyan-400/20 bg-black/70">
          <div className="grid grid-cols-5 gap-2 px-3 py-2 text-cyan-300 border-b border-cyan-400/10 text-[13px]">
            <div>Callsign</div>
            <div>Flight</div>
            <div>Squawk</div>
            <div>Time (UTC)</div>
            <div>Status</div>
          </div>
          {incidents.map((i, idx) => (
            <div
              key={`${i.id}-${i.ts}-${idx}`}
              className="grid grid-cols-5 gap-2 px-3 py-2 text-[13px] border-b border-cyan-400/5 last:border-b-0"
            >
              <div className="text-cyan-200">{i.callsign || "N/A"}</div>
              <div className="text-cyan-200">{i.flightNo || "N/A"}</div>
              <div className="text-red-400 font-semibold">{i.squawk}</div>
              <div className="text-cyan-300">
                {new Date(i.ts).toISOString().replace(".000Z", "Z")}
              </div>
              <div>
                <LiveBadge ts={i.ts} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
