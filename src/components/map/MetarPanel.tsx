import { buttonLikeProps } from "~/lib/a11y";
import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { Analytics } from "~/lib/analytics";

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
  atisText?: string | null;
  atisCode?: string | null;
  notams?: Notam[] | null;
  notamCount?: number;
  isPro?: boolean;
}

export const MetarPanel: React.FC<MetarPanelProps> = ({
  icaoInput,
  onChange,
  selectedAirportIcao,
  metarText,
  metarStatus = "idle",
  atisText,
  atisCode,
  notams,
  notamCount = 0,
  isPro = false,
}) => {
  // Use either the manual input or the selected airport ICAO
  const effectiveIcao = icaoInput || selectedAirportIcao || "";
  const [metarExpanded, setMetarExpanded] = useState(true);
  const [atisExpanded, setAtisExpanded] = useState(false);
  const [notamsExpanded, setNotamsExpanded] = useState(false);

  // Only Pro users with NOTAMs can expand the list; for everyone else the
  // header is plain text (with the upgrade link beside it).
  const canExpandNotams = Boolean(isPro && notams && notams.length > 0);

  return (
    <div className="absolute bottom-5 left-5 z-[1000] flex flex-col items-start gap-2.5 font-mono">
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
                TRIAL
              </Link>
            ) : notams && notams.length > 0 ? (
              notamsExpanded ? (
                <ChevronUp className="ml-auto h-4 w-4 text-orange-400" />
              ) : (
                <ChevronDown className="ml-auto h-4 w-4 text-orange-400" />
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
                TRIAL
              </Link>
            ) : atisExpanded ? (
              <ChevronUp className="ml-auto h-4 w-4 text-cyan-400" />
            ) : (
              <ChevronDown className="ml-auto h-4 w-4 text-cyan-400" />
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
        <p
          role="status"
          className={`max-w-[300px] rounded-lg border bg-black/85 px-3 py-2 text-[12px] ${metarStatus === "error" ? "border-red-400/40 text-red-300" : "border-cyan-300/30 text-cyan-200"}`}
        >
          {metarStatus === "loading"
            ? `Loading METAR for ${effectiveIcao}…`
            : metarStatus === "not-found"
              ? `No METAR available for ${effectiveIcao}. Check the ICAO code.`
              : `Couldn't load the METAR for ${effectiveIcao}. It will retry in a few minutes.`}
        </p>
      )}
      {metarText && (
        <div className="max-w-[300px] rounded-lg border border-cyan-300/30 bg-gradient-to-br from-black/85 to-cyan-950/90 p-3 text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]">
          <div
            className="flex cursor-pointer items-center gap-2 rounded focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
            {...buttonLikeProps(() => setMetarExpanded(!metarExpanded))}
            aria-expanded={metarExpanded}
          >
            <strong className="text-cyan-300">METAR {effectiveIcao}</strong>
            {metarExpanded ? (
              <ChevronUp className="ml-auto h-4 w-4 text-cyan-400" />
            ) : (
              <ChevronDown className="ml-auto h-4 w-4 text-cyan-400" />
            )}
          </div>

          {metarExpanded && (
            <div className="mt-1.5 border-t border-cyan-300/20 pt-2 text-[13px] leading-[1.4]">
              {metarText}
            </div>
          )}
        </div>
      )}

      {/* METAR airport input */}
      <div className="flex flex-row items-center gap-2 rounded-md border border-cyan-300/30 bg-black/80 p-2 shadow-[0_0_6px_rgba(0,255,255,0.15)]">
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
          aria-describedby="metar-icao-hint"
          className="w-24 flex-1 rounded border border-cyan-300/40 bg-transparent px-2 py-[5px] text-[13px] text-cyan-300 transition-all outline-none placeholder:text-cyan-200/50 focus:border-cyan-300 focus:bg-cyan-400/10 focus-visible:ring-2 focus-visible:ring-cyan-300"
        />
        <span id="metar-icao-hint" className="sr-only">
          4-letter ICAO airport code
        </span>
      </div>
    </div>
  );
};
