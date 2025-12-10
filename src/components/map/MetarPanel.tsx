import React from "react";

interface MetarPanelProps {
  icaoInput: string;
  onChange: (value: string) => void;
  metarText?: string | null;
  onCloseMetar: () => void;
}

export const MetarPanel: React.FC<MetarPanelProps> = ({
  icaoInput,
  onChange,
  metarText,
  onCloseMetar,
}) => {
  return (
    <div className="absolute bottom-5 left-5 z-[1000] flex flex-col items-start gap-2.5 font-mono">
      {metarText && (
        <div className="relative max-w-[300px] rounded-lg border border-cyan-300/30 bg-gradient-to-br from-black/85 to-cyan-950/90 p-3 text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)] break-words">
          <button
            onClick={onCloseMetar}
            title="Close METAR"
            className="absolute right-1.5 top-1 text-cyan-400 transition-colors hover:text-red-400 text-lg"
          >
            ×
          </button>
          <strong className="text-cyan-300">METAR:</strong>
          <div className="mt-1.5 text-[13px] leading-[1.4]">{metarText}</div>
        </div>
      )}

      <div className="flex flex-row items-center gap-2 rounded-md border border-cyan-300/30 bg-black/80 p-2 shadow-[0_0_6px_rgba(0,255,255,0.15)]">
        <span className="text-cyan-400 font-medium">METAR</span>
        <input
          type="text"
          value={icaoInput}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="ICAO (e.g. KJFK)"
          className="flex-1 rounded border border-cyan-300/40 bg-transparent px-2 py-[5px] text-[13px] text-cyan-400 outline-none transition-all focus:border-cyan-400 focus:bg-cyan-400/10"
        />
      </div>
    </div>
  );
};