import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

interface Notam {
  text: string;
  decoded?: string | null;
}

interface MetarPanelProps {
  icaoInput: string;
  onChange: (value: string) => void;
  metarText?: string | null;
  atisText?: string | null;
  atisCode?: string | null;
  notams?: Notam[] | null;
  notamCount?: number;
  isPro?: boolean;
}

export const MetarPanel: React.FC<MetarPanelProps> = ({
  icaoInput,
  onChange,
  metarText,
  atisText,
  atisCode,
  notams,
  notamCount = 0,
  isPro = false,
}) => {
  const [metarExpanded, setMetarExpanded] = useState(true);
  const [atisExpanded, setAtisExpanded] = useState(false);
  const [notamsExpanded, setNotamsExpanded] = useState(false);

  return (
    <div className="absolute bottom-5 left-5 z-[1000] flex flex-col items-start gap-2.5 font-mono">
      {/* NOTAMs Panel */}
      {notams && notams.length > 0 && (
        <div className="max-w-[350px] rounded-lg border border-orange-400/40 bg-gradient-to-br from-black/90 to-orange-950/80 p-3 text-orange-300 shadow-[0_0_10px_rgba(255,150,0,0.2)]">
          <div
            className="flex cursor-pointer items-center gap-2"
            onClick={() => isPro && setNotamsExpanded(!notamsExpanded)}
          >
            <strong className="text-orange-400">NOTAMs</strong>
            <span className="rounded bg-orange-500/30 px-1.5 py-0.5 text-xs font-bold text-orange-300">
              {notamCount}
            </span>
            {!isPro ? (
              <Link
                href="/pricing"
                className="ml-auto rounded bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide hover:from-amber-400 hover:to-orange-400"
              >
                PRO
              </Link>
            ) : notamsExpanded ? (
              <ChevronUp className="ml-auto h-4 w-4 text-orange-400" />
            ) : (
              <ChevronDown className="ml-auto h-4 w-4 text-orange-400" />
            )}
          </div>

          {isPro && notamsExpanded && (
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
                    <pre className="whitespace-pre-wrap text-[11px] leading-[1.3] text-orange-300/80">
                      {notam.text}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ATIS Panel */}
      {atisText && (
        <div className="max-w-[300px] rounded-lg border border-cyan-300/30 bg-gradient-to-br from-black/85 to-cyan-950/90 p-3 text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]">
          <div
            className="flex cursor-pointer items-center gap-2"
            onClick={() => isPro && setAtisExpanded(!atisExpanded)}
          >
            <strong className="text-cyan-300">
              ATIS{atisCode ? ` ${atisCode}` : ""}
            </strong>
            {!isPro ? (
              <Link
                href="/pricing"
                className="ml-auto rounded bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide hover:from-amber-400 hover:to-orange-400"
              >
                PRO
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
      {metarText && (
        <div className="max-w-[300px] rounded-lg border border-cyan-300/30 bg-gradient-to-br from-black/85 to-cyan-950/90 p-3 text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]">
          <div
            className="flex cursor-pointer items-center gap-2"
            onClick={() => setMetarExpanded(!metarExpanded)}
          >
            <strong className="text-cyan-300">METAR</strong>
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

      {/* ICAO Input */}
      <div className="flex flex-row items-center gap-2 rounded-md border border-cyan-300/30 bg-black/80 p-2 shadow-[0_0_6px_rgba(0,255,255,0.15)]">
        <span className="font-medium text-cyan-400">ICAO</span>
        <input
          type="text"
          value={icaoInput}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="e.g. KJFK"
          className="flex-1 rounded border border-cyan-300/40 bg-transparent px-2 py-[5px] text-[13px] text-cyan-400 transition-all outline-none focus:border-cyan-400 focus:bg-cyan-400/10"
        />
      </div>
    </div>
  );
};
