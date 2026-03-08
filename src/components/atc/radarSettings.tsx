"use client";

import React from "react";
import { Switch } from "~/components/ui/switch";
import { ProBadge } from "~/components/ui/pro-badge";
import { Analytics } from "~/lib/analytics";
import { useUnitPreferences } from "~/hooks/useUnitPreferences";
import type { SpeedUnit, AltitudeUnit } from "~/lib/units";

interface RadarSettingsProps {
  isPRO: boolean;

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
  showPrecipitation,
  setShowPrecipitation,
  showAirmets,
  setShowAirmets,
  showSigmets,
  setShowSigmets,
  showConflicts,
  setShowConflicts,
}: RadarSettingsProps) => {
  const { speedUnit, altitudeUnit, setSpeedUnit, setAltitudeUnit } =
    useUnitPreferences();

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
            Analytics.weatherLayerToggled({
              layer: "precipitation",
              enabled: v,
            });
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
          proBadgeSource="radar_settings_airmets_lock"
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
          proBadgeSource="radar_settings_sigmets_lock"
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
          proBadgeSource="radar_settings_conflict_alerts_lock"
        />
      </div>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <span className="text-[11px] tracking-widest text-cyan-300 uppercase">
          DISPLAY UNITS
        </span>

        <UnitSelector<SpeedUnit>
          label="Speed"
          value={speedUnit}
          onChange={setSpeedUnit}
          options={[
            { value: "kts", label: "Knots" },
            { value: "mach", label: "Mach" },
          ]}
        />

        <UnitSelector<AltitudeUnit>
          label="Altitude"
          value={altitudeUnit}
          onChange={setAltitudeUnit}
          options={[
            { value: "auto", label: "Auto" },
            { value: "feet", label: "Feet" },
            { value: "fl", label: "FL" },
          ]}
        />
      </div>
    </div>
  );
};

function SettingsToggle({
  label,
  checked,
  onChange,
  disabled = false,
  proBadgeSource,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  proBadgeSource?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <span className="flex items-center gap-2">
        {label}
        {disabled && <ProBadge source={proBadgeSource} />}
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

function UnitSelector<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
              value === opt.value
                ? "bg-cyan-500 text-black"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
