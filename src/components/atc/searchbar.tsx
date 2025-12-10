import React from "react";
import { type PositionUpdate } from "~/lib/aircraft-store";

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults: (PositionUpdate | Airport)[];
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
  const widthClass = isMobile ? "w-[90vw] max-w-[320px]" : "w-[280px]";

  return (
    <div
      className={`flex flex-col ${
        isMobile ? "items-center" : "items-start"
      } `}
    >
      <input
        type="text"
        placeholder="Search a flight or airport"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={`rounded-md border border-cyan-400/30 bg-black/95 px-4 py-2 mt-1 ml-5 text-[14px] text-cyan-400 placeholder-cyan-500/50 outline-none transition-all duration-200 ${widthClass} ${
          searchTerm && searchResults.length > 0 ? "mb-2.5" : ""
        } 
        hover:border-cyan-400/60 hover:shadow-[0_0_10px_rgba(0,255,255,0.3)]
        focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(0,255,255,0.5)]`}
      />

      {searchTerm && searchResults.length > 0 && (
        <div
          className={`max-h-[300px] overflow-y-auto ml-5 rounded-md border border-cyan-400/20 bg-black/90 shadow-[0_0_10px_rgba(0,255,255,0.15)] ${widthClass}`}
        >
          {searchResults.map((result, index) => (
            <div
              key={
                "callsign" in result
                  ? result.callsign || result.flightNo || `ac-${index}`
                  : `ap-${result.icao}`
              }
              onClick={() => {
                if ("callsign" in result) {
                  onSelectAircraft(result);
                } else {
                  onSelectAirport(result);
                }
                setSearchTerm("");
              }}
              className={`cursor-pointer px-4 py-2 text-cyan-100 text-[14px] border-b border-cyan-400/10 last:border-b-0 hover:bg-cyan-400/10 transition-colors duration-150`}
            >
              {"callsign" in result ? (
                <>
                  <div className="font-semibold text-cyan-300">
                    {result.callsign || result.flightNo || "N/A"}
                  </div>
                  <div className="mt-[2px] text-[11px] text-cyan-200/60">
                    {result.type} ({result.departure} →{" "}
                    {result.arrival || "UNK"})
                    {result.squawk && (
                      <span className="ml-2 opacity-80">
                        SQK: {result.squawk}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-cyan-300">
                    {result.icao}
                  </div>
                  <div className="mt-[2px] text-[11px] text-cyan-200/60">
                    {result.name} (Airport)
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};