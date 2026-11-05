import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plane, PlaneTakeoff, Search, User } from "lucide-react";
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
  /** "header" is the desktop dropdown; "sheet" is the mobile bottom sheet. */
  variant?: "header" | "sheet";
  autoFocus?: boolean;
  inputDebugId?: string;
  dataTour?: string;
  onSelectAircraft: (aircraft: PositionUpdate) => void;
  onSelectAirport: (airport: Airport) => void;
  onSelectPilot: (pilot: SearchablePilot) => void;
  recentSearches?: RecentSearch[];
  onSelectRecentSearch?: (search: RecentSearch) => void;
  onClearRecentSearches?: () => void;
  /** Called after any option is chosen (used to close the mobile sheet). */
  onAfterSelect?: () => void;
  onEscape?: () => void;
}

interface Option {
  key: string;
  group: "Aircraft" | "Pilots" | "Airports" | "Recent searches";
  title: string;
  subtitle?: string;
  extra?: string;
  icon: React.ReactNode;
  select: () => void;
}

/**
 * Radar search. Implements the WAI-ARIA combobox pattern so results can be
 * reached with the arrow keys and are announced by screen readers. Desktop and
 * mobile share this one component so their behaviour can't drift apart.
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  searchResults,
  isMobile,
  variant = "header",
  autoFocus = false,
  inputDebugId,
  dataTour = "radar-search",
  onSelectAircraft,
  onSelectAirport,
  onSelectPilot,
  recentSearches = [],
  onSelectRecentSearch,
  onClearRecentSearches,
  onAfterSelect,
  onEscape,
}) => {
  const [isOpen, setIsOpen] = useState(variant === "sheet");
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const inputId = useId();
  const optionId = (index: number) => `${listboxId}-opt-${index}`;
  const isSheet = variant === "sheet";
  const trimmed = searchTerm.trim();

  const options = useMemo<Option[]>(() => {
    const done = () => {
      setSearchTerm("");
      onAfterSelect?.();
    };
    if (!trimmed) {
      if (!onSelectRecentSearch) return [];
      return recentSearches.map((search, index) => ({
        key: `recent-${search.type}-${search.id}-${index}`,
        group: "Recent searches" as const,
        title: search.displayName,
        subtitle: search.subtitle,
        icon:
          search.type === "aircraft" ? (
            <Plane className="h-4 w-4" aria-hidden="true" />
          ) : search.type === "pilot" ? (
            <User className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PlaneTakeoff className="h-4 w-4" aria-hidden="true" />
          ),
        select: () => {
          onSelectRecentSearch(search);
          done();
        },
      }));
    }
    return [
      ...searchResults.aircrafts.map((aircraft, index) => ({
        key: `ac-${aircraft.id || aircraft.callsign || aircraft.flightNo || index}`,
        group: "Aircraft" as const,
        title: aircraft.callsign || aircraft.flightNo || "Unknown flight",
        subtitle: `${aircraft.type} · ${aircraft.departure || "—"} → ${aircraft.arrival || "—"}`,
        extra: aircraft.pilotDiscordUsername
          ? `Pilot: ${aircraft.pilotDiscordUsername}`
          : undefined,
        icon: <Plane className="h-4 w-4" aria-hidden="true" />,
        select: () => {
          onSelectAircraft(aircraft);
          done();
        },
      })),
      ...searchResults.pilots.map((pilot) => ({
        key: `pilot-${pilot._id}`,
        group: "Pilots" as const,
        title: pilot.discordUsername ?? "Unknown pilot",
        subtitle: pilot.pilotCallsign
          ? `Pilot profile · ${pilot.pilotCallsign}`
          : "Pilot profile",
        icon: <User className="h-4 w-4" aria-hidden="true" />,
        select: () => {
          onSelectPilot(pilot);
          done();
        },
      })),
      ...searchResults.airports.map((airport) => ({
        key: `ap-${airport.icao}`,
        group: "Airports" as const,
        title: airport.icao,
        subtitle: airport.name,
        icon: <PlaneTakeoff className="h-4 w-4" aria-hidden="true" />,
        select: () => {
          onSelectAirport(airport);
          done();
        },
      })),
    ];
  }, [
    trimmed,
    recentSearches,
    searchResults,
    onSelectRecentSearch,
    onSelectAircraft,
    onSelectPilot,
    onSelectAirport,
    onAfterSelect,
    setSearchTerm,
  ]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmed]);

  // Close when focus or a click moves outside the search (replaces a fragile
  // blur timer that could swallow clicks on slow devices).
  useEffect(() => {
    if (isSheet) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isSheet]);

  const showPanel = isOpen && (options.length > 0 || Boolean(trimmed));
  const showEmpty = isOpen && Boolean(trimmed) && options.length === 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) =>
        options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1,
      );
    } else if (event.key === "Enter") {
      // Enter picks the highlighted option, or the top match while typing.
      const option =
        activeIndex >= 0 ? options[activeIndex] : trimmed ? options[0] : null;
      if (option) {
        event.preventDefault();
        option.select();
        setIsOpen(isSheet);
      }
    } else if (event.key === "Escape") {
      // Handle Escape here so it doesn't also clear the radar selection.
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      if (searchTerm) {
        setSearchTerm("");
      } else {
        setIsOpen(false);
        onEscape?.();
      }
    }
  };

  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView({ block: "nearest" });
    // optionId is derived from a stable id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const panelClass = isSheet
    ? "mt-3 max-h-[50vh] overflow-y-auto rounded-xl border border-white/10 bg-black/40"
    : `mt-2 overflow-y-auto rounded-lg border border-cyan-400/20 bg-black/90 ${
        isMobile ? "max-h-[70vh] w-full" : "max-h-[300px] w-full"
      }`;

  let lastGroup: Option["group"] | null = null;

  return (
    <div
      ref={rootRef}
      className="flex w-full flex-col"
      data-tour={dataTour}
      onBlur={(event) => {
        // Close when keyboard focus moves outside the search entirely.
        if (
          !isSheet &&
          !rootRef.current?.contains(event.relatedTarget as Node | null)
        )
          setIsOpen(false);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Search flights, pilots or airports
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-cyan-400/60"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Search flight, pilot, or airport..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          data-debug-id={inputDebugId}
          className={
            isSheet
              ? "w-full rounded-xl border border-cyan-400/30 bg-black/60 py-3 pr-4 pl-9 text-[15px] text-cyan-300 placeholder-cyan-200/60 focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none"
              : `mt-1 w-full rounded-lg border border-cyan-400/30 bg-black/80 py-2.5 pr-4 pl-9 text-[14px] text-cyan-300 placeholder-cyan-200/60 transition-all duration-200 hover:border-cyan-400/60 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(0,255,255,0.3)] focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none`
          }
        />
      </div>

      <div aria-live="polite" className="sr-only">
        {trimmed
          ? options.length
            ? `${options.length} result${options.length === 1 ? "" : "s"}`
            : "No results"
          : ""}
      </div>

      {showPanel && (
        <div className={panelClass}>
          {!trimmed && onClearRecentSearches && options.length > 0 && (
            <div className="flex items-center justify-between border-b border-cyan-400/20 bg-cyan-950/50 px-4 py-2">
              <span className="text-[11px] font-semibold tracking-wider text-cyan-300 uppercase">
                Recent searches
              </span>
              <button
                type="button"
                onClick={onClearRecentSearches}
                className="rounded px-1 text-[11px] text-cyan-200/80 transition-colors hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none"
              >
                Clear
              </button>
            </div>
          )}
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Search results"
            className="m-0 list-none p-0"
          >
            {options.map((option, index) => {
              const header =
                option.group !== lastGroup && option.group !== "Recent searches"
                  ? option.group
                  : null;
              lastGroup = option.group;
              return (
                <React.Fragment key={option.key}>
                  {header && (
                    <li
                      role="presentation"
                      className="border-b border-cyan-400/20 bg-cyan-950/50 px-4 py-2 text-[11px] font-semibold tracking-wider text-cyan-300 uppercase"
                    >
                      {header}
                    </li>
                  )}
                  <li
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      option.select();
                      setIsOpen(isSheet);
                    }}
                    onMouseEnter={() => !isMobile && setActiveIndex(index)}
                    className={`flex cursor-pointer items-start gap-3 border-b border-cyan-400/10 px-4 py-3 text-[14px] text-cyan-100 transition-colors duration-150 last:border-b-0 active:bg-cyan-400/20 ${
                      index === activeIndex ? "bg-cyan-400/15" : ""
                    }`}
                  >
                    <span className="mt-0.5 text-cyan-300/80">
                      {option.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-cyan-200">
                        {option.title}
                      </span>
                      {option.subtitle && (
                        <span className="mt-1 block text-[12px] text-cyan-100/75">
                          {option.subtitle}
                        </span>
                      )}
                      {option.extra && (
                        <span className="mt-1 block text-[12px] text-cyan-300/90">
                          {option.extra}
                        </span>
                      )}
                    </span>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
          {showEmpty && (
            <div className="px-4 py-4 text-[13px] text-cyan-100/80">
              No flights, pilots or airports match “{trimmed}”.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
