import { buttonLikeProps } from "~/lib/a11y";
import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { Analytics } from "~/lib/analytics";

// Recently looked-up airports for the phone sheet, stored on the device.
const RECENT_KEY = "radarthing-recent-metar";

interface Notam {
  text: string;
  decoded?: string | null;
}

interface MetarPanelProps {
  icaoInput: string;
  onChange: (value: string) => void;
  selectedAirportIcao?: string | null;
  metarText?: string | null;
  metarStatus?: "idle" | "loading" | "ready" | "not-found" | "error";
  onRetryMetar?: () => void;
  atisText?: string | null;
  atisCode?: string | null;
  notams?: Notam[] | null;
  notamCount?: number;
  isPro?: boolean;
  /** "sheet" drops the map-corner positioning for the phone bottom sheet. */
  variant?: "overlay" | "sheet";
}

export const MetarPanel: React.FC<MetarPanelProps> = ({
  icaoInput,
  onChange,
  selectedAirportIcao,
  metarText,
  metarStatus = "idle",
  onRetryMetar,
  atisText,
  atisCode,
  notams,
  notamCount = 0,
  isPro = false,
  variant = "overlay",
}) => {
  // Use either the manual input or the selected airport ICAO
  const effectiveIcao = icaoInput || selectedAirportIcao || "";
  const [metarExpanded, setMetarExpanded] = useState(true);
  const [atisExpanded, setAtisExpanded] = useState(false);
  const [notamsExpanded, setNotamsExpanded] = useState(false);

  // Recently looked-up airports, offered as one-tap chips in the phone sheet.
  const [recentIcaos, setRecentIcaos] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(RECENT_KEY) ?? "[]",
      );
      if (Array.isArray(stored))
        setRecentIcaos(
          stored.filter((v): v is string => typeof v === "string").slice(0, 5),
        );
    } catch {
      // No recents if storage is unavailable.
    }
  }, []);
  // Only airports the pilot typed count as recent, not the selected one.
  useEffect(() => {
    if (metarStatus !== "ready" || icaoInput.length !== 4) return;
    setRecentIcaos((current) =>
      [icaoInput, ...current.filter((icao) => icao !== icaoInput)].slice(0, 5),
    );
  }, [metarStatus, icaoInput]);
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentIcaos));
    } catch {
      // Ignore storage errors.
    }
  }, [recentIcaos]);

  // Only Pro users with NOTAMs can expand the list; for everyone else the
  // header is plain text (with the upgrade link beside it).
  const canExpandNotams = Boolean(isPro && notams && notams.length > 0);

  return (
    <div
      className={
        variant === "sheet"
          ? "flex flex-col items-stretch gap-2.5 font-mono [&>*]:max-w-none"
          : "absolute bottom-5 left-5 z-[1000] flex flex-col items-start gap-2.5 font-mono"
      }
    >
      {/* NOTAMs Panel - show for all users when ICAO is valid */}
      {effectiveIcao.length >= 4 && (
        <div className="max-w-[350px] rounded-lg border border-orange-400/40 bg-gradient-to-br from-black/90 to-orange-950/80 p-3 text-orange-300 shadow-[0_0_10px_rgba(255,150,0,0.2)]">
          <div
            className={`flex items-center gap-2 ${canExpandNotams ? "cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none" : ""}`}
            {...(canExpandNotams
              ? {
                  ...buttonLikeProps(() => setNotamsExpanded(!notamsExpanded)),
                  "aria-expanded": notamsExpanded,
                }
              : {})}
          >
            <strong className="text-orange-400">NOTAMs</strong>
            {isPro && notamCount > 0 && (
              <span className="rounded bg-orange-500/30 px-1.5 py-0.5 text-xs font-bold text-orange-300">
                {notamCount}
              </span>
            )}
            {!isPro ? (
              <Link
                href="/pricing"
                onClick={() =>
                  Analytics.upgradeButtonClicked({
                    source: "metar_panel_notams_lock",
                    feature: "notams",
                  })
                }
                className="ml-auto rounded bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase hover:from-amber-400 hover:to-orange-400"
              >
                Try Pro
              </Link>
            ) : notams && notams.length > 0 ? (
              notamsExpanded ? (
                <ChevronUp
                  className="ml-auto h-4 w-4 text-orange-400"
                  aria-hidden="true"
                />
              ) : (
                <ChevronDown
                  className="ml-auto h-4 w-4 text-orange-400"
                  aria-hidden="true"
                />
              )
            ) : (
              <span className="ml-auto text-xs text-orange-400/50">None</span>
            )}
          </div>

          {isPro && notamsExpanded && notams && notams.length > 0 && (
            <div className="mt-2 max-h-[300px] space-y-3 overflow-y-auto border-t border-orange-400/20 pt-2">
              {notams.map((notam, idx) => (
                <div
                  key={idx}
                  className="border-b border-orange-400/10 pb-2 last:border-b-0"
                >
                  {notam.decoded ? (
                    <div className="text-[12px] leading-[1.4] text-orange-200">
                      {notam.decoded}
                    </div>
                  ) : (
                    <pre className="text-[11px] leading-[1.3] whitespace-pre-wrap text-orange-300/80">
                      {notam.text}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ATIS Panel - only show when ATIS data is available */}
      {atisText && (
        <div className="max-w-[300px] rounded-lg border border-cyan-300/30 bg-gradient-to-br from-black/85 to-cyan-950/90 p-3 text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]">
          <div
            className={`flex items-center gap-2 ${isPro ? "cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none" : ""}`}
            {...(isPro
              ? {
                  ...buttonLikeProps(() => setAtisExpanded(!atisExpanded)),
                  "aria-expanded": atisExpanded,
                }
              : {})}
          >
            <strong className="text-cyan-300">
              ATIS{isPro && atisCode ? ` ${atisCode}` : ""}
            </strong>
            {!isPro ? (
              <Link
                href="/pricing"
                onClick={() =>
                  Analytics.upgradeButtonClicked({
                    source: "metar_panel_atis_lock",
                    feature: "atis",
                  })
                }
                className="ml-auto rounded bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase hover:from-amber-400 hover:to-orange-400"
              >
                Try Pro
              </Link>
            ) : atisExpanded ? (
              <ChevronUp
                className="ml-auto h-4 w-4 text-cyan-400"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="ml-auto h-4 w-4 text-cyan-400"
                aria-hidden="true"
              />
            )}
          </div>

          {isPro && atisExpanded && (
            <div className="mt-1.5 max-h-[200px] overflow-y-auto border-t border-cyan-300/20 pt-2 text-[13px] leading-[1.4] break-words">
              {atisText}
            </div>
          )}
        </div>
      )}

      {/* METAR Panel */}
      {effectiveIcao.length >= 4 && !metarText && metarStatus !== "idle" && (
        <div
          role="status"
          className={`flex max-w-[300px] items-center gap-3 rounded-lg border bg-black/85 px-3 py-2 text-[12px] ${metarStatus === "error" ? "border-red-400/40 text-red-300" : "border-cyan-300/30 text-cyan-200"}`}
        >
          <span>
            {metarStatus === "loading"
              ? `Loading METAR for ${effectiveIcao}…`
              : metarStatus === "not-found"
                ? `No METAR available for ${effectiveIcao}. Check the ICAO code.`
                : `Couldn't load the METAR for ${effectiveIcao}.`}
          </span>
          {metarStatus === "error" && onRetryMetar && (
            <button
              type="button"
              onClick={onRetryMetar}
              className="shrink-0 cursor-pointer rounded-md border border-red-300/40 px-2 py-1 font-sans text-[12px] font-semibold text-red-100 hover:bg-red-500/15 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
            >
              Retry
            </button>
          )}
        </div>
      )}
      {/* Stays in place while typing so the input above never moves. */}
      {variant === "sheet" && recentIcaos.length > 0 && (
        <div
          role="group"
          aria-label="Recent airports"
          className="-order-1 flex flex-wrap items-center gap-2 font-sans"
        >
          <span className="text-xs text-slate-400">Recent:</span>
          {recentIcaos.map((icao) => (
            <button
              key={icao}
              type="button"
              onClick={() => onChange(icao)}
              aria-label={`Weather for ${icao}`}
              aria-pressed={icaoInput === icao}
              className={`min-h-9 cursor-pointer rounded-lg border px-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none ${icaoInput === icao ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100" : "border-cyan-300/30 text-cyan-200 hover:bg-cyan-400/10"}`}
            >
              {icao}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRecentIcaos([])}
            className="ml-auto min-h-9 cursor-pointer rounded-lg px-2 text-xs text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
          >
            Clear
          </button>
        </div>
      )}
      {/* Always rendered so the message is announced when it appears. */}
      <p
        id="metar-icao-partial"
        aria-live="polite"
        className={
          effectiveIcao.length > 0 && effectiveIcao.length < 4
            ? "max-w-[300px] rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-[12px] text-slate-300"
            : "sr-only"
        }
      >
        {effectiveIcao.length > 0 && effectiveIcao.length < 4
          ? "Enter all 4 characters of the ICAO code."
          : ""}
      </p>
      {metarText && (
        <div className="max-w-[300px] rounded-lg border border-cyan-300/30 bg-gradient-to-br from-black/85 to-cyan-950/90 p-3 text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded text-left focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
            onClick={() => setMetarExpanded(!metarExpanded)}
            aria-expanded={metarExpanded}
          >
            <strong className="text-cyan-300">METAR {effectiveIcao}</strong>
            {metarExpanded ? (
              <ChevronUp
                className="ml-auto h-4 w-4 text-cyan-400"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="ml-auto h-4 w-4 text-cyan-400"
                aria-hidden="true"
              />
            )}
          </button>

          {metarExpanded && (
            <div className="mt-1.5 border-t border-cyan-300/20 pt-2 text-[13px] leading-[1.4]">
              {metarText}
            </div>
          )}
        </div>
      )}

      {/* METAR airport input (first in the phone sheet, so it doesn't move
          down when results load) */}
      <div
        className={`${variant === "sheet" ? "order-first" : ""} flex flex-row items-center gap-2 rounded-md border border-cyan-300/30 bg-black/80 p-2 shadow-[0_0_6px_rgba(0,255,255,0.15)]`}
      >
        <label htmlFor="metar-icao-input" className="font-medium text-cyan-400">
          METAR
        </label>
        <input
          id="metar-icao-input"
          type="text"
          value={icaoInput}
          onChange={(e) =>
            onChange(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 4),
            )
          }
          maxLength={4}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. KJFK"
          aria-describedby="metar-icao-hint metar-icao-partial"
          className="w-24 flex-1 rounded border border-cyan-300/40 bg-transparent px-2 py-[5px] text-base text-cyan-300 transition-all outline-none placeholder:text-cyan-200/50 focus:border-cyan-300 focus:bg-cyan-400/10 focus-visible:ring-2 focus-visible:ring-cyan-300 sm:text-[13px]"
        />
        <span id="metar-icao-hint" className="sr-only">
          4-letter ICAO airport code
        </span>
      </div>
    </div>
  );
};
