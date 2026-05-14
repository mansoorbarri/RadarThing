import React, { useState } from "react";
import { type PositionUpdate } from "~/lib/aircraft-store";
import {
  type SearchResults,
  type SearchablePilot,
} from "~/hooks/useAircraftSearch";
import { type RecentSearch } from "~/hooks/useRecentSearches";

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
  autoFocus?: boolean;
  inputDebugId?: string;
  onSelectAircraft: (aircraft: PositionUpdate) => void;
  onSelectAirport: (airport: Airport) => void;
  onSelectPilot: (pilot: SearchablePilot) => void;
  recentSearches?: RecentSearch[];
  onSelectRecentSearch?: (search: RecentSearch) => void;
  onClearRecentSearches?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  searchResults,
  isMobile,
  autoFocus = false,
  inputDebugId,
  onSelectAircraft,
  onSelectAirport,
  onSelectPilot,
  recentSearches = [],
  onSelectRecentSearch,
  onClearRecentSearches,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const showRecentSearches =
    isFocused && !searchTerm && recentSearches.length > 0;
  const showSearchResults =
    searchTerm &&
    (searchResults.aircrafts.length > 0 ||
      searchResults.airports.length > 0 ||
      searchResults.pilots.length > 0);

  return (
    <div className="flex w-full flex-col">
      <input
        type="text"
        placeholder="Search flight, pilot, or airport..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        autoFocus={autoFocus}
        data-debug-id={inputDebugId}
        className={`rounded-lg border border-cyan-400/30 bg-black/80 px-4 py-2.5 text-[14px] text-cyan-400 placeholder-cyan-500/50 transition-all duration-200 outline-none ${
          isMobile ? "w-full" : "mt-1 w-full"
        } ${
          showSearchResults || showRecentSearches ? "mb-2" : ""
        } hover:border-cyan-400/60 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(0,255,255,0.3)]`}
      />

      {searchTerm &&
        (searchResults.aircrafts.length > 0 ||
          searchResults.airports.length > 0 ||
          searchResults.pilots.length > 0) && (
          <div
            className={`overflow-y-auto rounded-lg border border-cyan-400/20 bg-black/90 ${
              isMobile ? "max-h-[70vh] w-full" : "max-h-[300px] w-full"
            }`}
          >
            {searchResults.aircrafts.length > 0 && (
              <>
                <div className="border-b border-cyan-400/20 bg-cyan-950/50 px-4 py-2 text-[11px] font-semibold tracking-wider text-cyan-400 uppercase">
                  Aircrafts
                </div>
                {searchResults.aircrafts.map((aircraft, index) => (
                  <div
                    key={
                      aircraft.callsign || aircraft.flightNo || `ac-${index}`
                    }
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
                      {aircraft.type} • {aircraft.departure} →{" "}
                      {aircraft.arrival || "UNK"}
                    </div>
                    {aircraft.pilotDiscordUsername && (
                      <div className="mt-1 text-[12px] text-cyan-300/80">
                        Pilot: {aircraft.pilotDiscordUsername}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
            {searchResults.pilots.length > 0 && (
              <>
                <div className="border-b border-cyan-400/20 bg-cyan-950/50 px-4 py-2 text-[11px] font-semibold tracking-wider text-cyan-400 uppercase">
                  Pilots
                </div>
                {searchResults.pilots.map((pilot) => (
                  <div
                    key={`pilot-${pilot._id}`}
                    onClick={() => {
                      onSelectPilot(pilot);
                      setSearchTerm("");
                    }}
                    className={`cursor-pointer border-b border-cyan-400/10 px-4 py-3 text-[14px] text-cyan-100 transition-colors duration-150 last:border-b-0 active:bg-cyan-400/20 ${
                      isMobile ? "" : "hover:bg-cyan-400/10"
                    }`}
                  >
                    <div className="font-semibold text-cyan-300">
                      {pilot.discordUsername ?? "Unknown Pilot"}
                    </div>
                    <div className="mt-1 text-[12px] text-cyan-200/60">
                      {pilot.pilotCallsign
                        ? `Pilot profile • ${pilot.pilotCallsign}`
                        : "Pilot profile"}
                    </div>
                  </div>
                ))}
              </>
            )}
            {searchResults.airports.length > 0 && (
              <>
                <div className="border-b border-cyan-400/20 bg-cyan-950/50 px-4 py-2 text-[11px] font-semibold tracking-wider text-cyan-400 uppercase">
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

      {showRecentSearches && onSelectRecentSearch && (
        <div
          className={`overflow-y-auto rounded-lg border border-cyan-400/20 bg-black/90 ${
            isMobile ? "max-h-[70vh] w-full" : "max-h-[300px] w-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-cyan-400/20 bg-cyan-950/50 px-4 py-2">
            <div className="text-[11px] font-semibold tracking-wider text-cyan-400 uppercase">
              Recent Searches
            </div>
            {onClearRecentSearches && (
              <button
                onClick={onClearRecentSearches}
                className="text-[10px] text-cyan-400/60 transition-colors hover:text-cyan-400"
              >
                Clear
              </button>
            )}
          </div>
          {recentSearches.map((search, index) => (
            <div
              key={`${search.type}-${search.id}-${index}`}
              onClick={() => {
                onSelectRecentSearch(search);
                setSearchTerm("");
              }}
              className={`cursor-pointer border-b border-cyan-400/10 px-4 py-3 text-[14px] text-cyan-100 transition-colors duration-150 last:border-b-0 active:bg-cyan-400/20 ${
                isMobile ? "" : "hover:bg-cyan-400/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-cyan-400/60 uppercase">
                  {search.type === "aircraft"
                    ? "✈"
                    : search.type === "pilot"
                      ? "👤"
                      : "🛫"}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-cyan-300">
                    {search.displayName}
                  </div>
                  {search.subtitle && (
                    <div className="mt-1 text-[12px] text-cyan-200/60">
                      {search.subtitle}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
