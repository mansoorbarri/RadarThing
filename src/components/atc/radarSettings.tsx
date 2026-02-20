"use client";

import React from "react";
import { Switch } from "~/components/ui/switch";
import { ProBadge } from "~/components/ui/pro-badge";
import { useRouter } from "next/navigation";
import { Plane, Shield, Map } from "lucide-react";
import { Analytics } from "~/lib/analytics";

interface RadarSettingsProps {
  isPRO: boolean;
  isADMIN: boolean;

  showPrecipitation: boolean;
  setShowPrecipitation: (v: boolean) => void;

  showAirmets: boolean;
  setShowAirmets: (v: boolean) => void;

  showSigmets: boolean;
  setShowSigmets: (v: boolean) => void;

  showConflicts: boolean;
  setShowConflicts: (v: boolean) => void;
}

export const RadarSettings = ({
  isPRO,
  isADMIN,
  showPrecipitation,
  setShowPrecipitation,
  showAirmets,
  setShowAirmets,
  showSigmets,
  setShowSigmets,
  showConflicts,
  setShowConflicts,
}: RadarSettingsProps) => {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 rounded-md border border-cyan-400/30 bg-black/90 p-4 font-mono text-cyan-400 shadow-xl backdrop-blur-md">
      <h3 className="text-[14px] font-bold tracking-widest text-white uppercase">
        RADAR CONFIGURATION
      </h3>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <span className="text-[11px] tracking-widest text-cyan-300 uppercase">
          WEATHER LAYERS
        </span>

        <SettingsToggle
          label="Precipitation"
          checked={showPrecipitation}
          onChange={(v) => {
            setShowPrecipitation(v);
            Analytics.weatherLayerToggled({ layer: "precipitation", enabled: v });
          }}
        />

        <SettingsToggle
          label="AIRMETs"
          checked={showAirmets}
          onChange={(v) => {
            if (!isPRO) {
              Analytics.proFeatureBlocked({ feature: "airmets" });
              return;
            }
            setShowAirmets(v);
            Analytics.weatherLayerToggled({ layer: "airmet", enabled: v });
          }}
          disabled={!isPRO}
        />

        <SettingsToggle
          label="SIGMETs"
          checked={showSigmets}
          onChange={(v) => {
            if (!isPRO) {
              Analytics.proFeatureBlocked({ feature: "sigmets" });
              return;
            }
            setShowSigmets(v);
            Analytics.weatherLayerToggled({ layer: "sigmet", enabled: v });
          }}
          disabled={!isPRO}
        />
      </div>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <span className="text-[11px] tracking-widest text-cyan-300 uppercase">
          TRAFFIC
        </span>

        <SettingsToggle
          label="Conflict Alerts"
          checked={showConflicts}
          onChange={(v) => {
            if (!isPRO) {
              Analytics.proFeatureBlocked({ feature: "traffic_conflicts" });
              return;
            }
            setShowConflicts(v);
            Analytics.conflictLayerToggled({ enabled: v });
          }}
          disabled={!isPRO}
        />
      </div>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <span className="text-[11px] tracking-widest text-cyan-300 uppercase">
          COMMUNITY UPLOADS
        </span>

        <button
          onClick={() => router.push("/aircraft-images")}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10"
        >
          <Plane className="h-4 w-4 text-cyan-400" />
          <span>Upload Aircraft Images</span>
        </button>

        <button
          onClick={() => router.push("/airport-charts")}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10"
        >
          <Map className="h-4 w-4 text-cyan-400" />
          <span>Upload Airport Charts</span>
        </button>

        {isADMIN && (
          <button
            onClick={() => router.push("/admin")}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md bg-cyan-500/10 px-3 py-2 text-left text-sm text-cyan-400 transition-colors hover:bg-cyan-500/20"
          >
            <Shield className="h-4 w-4" />
            <span>Admin Panel</span>
            <span className="ml-auto text-[10px] text-cyan-500 uppercase">ADMIN</span>
          </button>
        )}
      </div>
    </div>
  );
};

function SettingsToggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <span className="flex items-center gap-2">
        {label}
        {disabled && <ProBadge />}
      </span>

      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-gray-600"
      />
    </div>
  );
}
