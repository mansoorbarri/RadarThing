import React from "react";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { type SearchResults } from "~/hooks/useAircraftSearch";

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults: SearchResults;
  isMobile: boolean;
  onSelectAircraft: (aircraft: PositionUpdate) => void;
  onSelectAirport: (airport: Airport) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  searchResults,
  isMobile,
  onSelectAircraft,
  onSelectAirport,
}) => {
  return (
    <div className={`flex flex-col ${isMobile ? "w-full" : "items-start"}`}>
      <input
        type="text"
        placeholder="Search flight or airport..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        autoFocus={isMobile}
        className={`rounded-lg border border-cyan-400/30 bg-black/80 px-4 py-2.5 text-[14px] text-cyan-400 placeholder-cyan-500/50 transition-all duration-200 outline-none ${
          isMobile ? "w-full" : "ml-5 mt-1 w-[280px]"
        } ${
          searchTerm && (searchResults.aircrafts.length > 0 || searchResults.airports.length > 0) ? "mb-2" : ""
        } hover:border-cyan-400/60 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(0,255,255,0.3)]`}
      />

      {searchTerm && (searchResults.aircrafts.length > 0 || searchResults.airports.length > 0) && (
        <div
          className={`overflow-y-auto rounded-lg border border-cyan-400/20 bg-black/90 ${
            isMobile ? "max-h-[70vh] w-full" : "ml-5 max-h-[300px] w-[280px]"
          }`}
        >
          {searchResults.aircrafts.length > 0 && (
            <>
              <div className="bg-cyan-950/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-400 border-b border-cyan-400/20">
                Aircrafts
              </div>
              {searchResults.aircrafts.map((aircraft, index) => (
                <div
                  key={aircraft.callsign || aircraft.flightNo || `ac-${index}`}
                  onClick={() => {
                    onSelectAircraft(aircraft);
                    setSearchTerm("");
                  }}
                  className={`cursor-pointer border-b border-cyan-400/10 px-4 py-3 text-[14px] text-cyan-100 transition-colors duration-150 last:border-b-0 active:bg-cyan-400/20 ${
                    isMobile ? "" : "hover:bg-cyan-400/10"
                  }`}
                >
                  <div className="font-semibold text-cyan-300">
                    {aircraft.callsign || aircraft.flightNo || "N/A"}
                  </div>
                  <div className="mt-1 text-[12px] text-cyan-200/60">
                    {aircraft.type} • {aircraft.departure} → {aircraft.arrival || "UNK"}
                  </div>
                </div>
              ))}
            </>
          )}
          {searchResults.airports.length > 0 && (
            <>
              <div className="bg-cyan-950/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-400 border-b border-cyan-400/20">
                Airports
              </div>
              {searchResults.airports.map((airport) => (
                <div
                  key={`ap-${airport.icao}`}
                  onClick={() => {
                    onSelectAirport(airport);
                    setSearchTerm("");
                  }}
                  className={`cursor-pointer border-b border-cyan-400/10 px-4 py-3 text-[14px] text-cyan-100 transition-colors duration-150 last:border-b-0 active:bg-cyan-400/20 ${
                    isMobile ? "" : "hover:bg-cyan-400/10"
                  }`}
                >
                  <div className="font-semibold text-cyan-300">
                    {airport.icao}
                  </div>
                  <div className="mt-1 text-[12px] text-cyan-200/60">
                    {airport.name}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
