"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Switch } from "~/components/ui/switch";
import { ProBadge } from "~/components/ui/pro-badge";
import { Analytics } from "~/lib/analytics";
import { useUnitPreferences } from "~/hooks/useUnitPreferences";
import type { SpeedUnit, AltitudeUnit } from "~/lib/units";
import type { MapLayerPreset } from "~/lib/mapLayerPresets";

interface RadarSettingsProps {
  isPRO: boolean;
  presets: MapLayerPreset[];
  activePresetId: string | null;
  selectedPresetId: string | null;
  onApplyPreset: (presetId: string) => void;
  onSavePreset: (
    name: string,
  ) => { ok: true } | { ok: false; error: string };
  onUpdatePreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;

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
  presets,
  activePresetId,
  selectedPresetId,
  onApplyPreset,
  onSavePreset,
  onUpdatePreset,
  onDeletePreset,
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
  const [presetName, setPresetName] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId) ?? null,
    [activePresetId, presets],
  );
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );

  useEffect(() => {
    setDeleteArmed(false);
  }, [selectedPresetId]);

  const targetPreset = activePreset ?? selectedPreset;

  const handleSavePreset = () => {
    const result = onSavePreset(presetName);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPresetName("");
    setDeleteArmed(false);
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border border-cyan-400/30 bg-black/90 p-4 font-mono text-cyan-400 shadow-xl backdrop-blur-md">
      <h3 className="text-[14px] font-bold tracking-widest text-white uppercase">
        RADAR CONFIGURATION
      </h3>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] tracking-widest text-cyan-300 uppercase">
            Layer Presets
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] tracking-wider uppercase ${
              activePreset
                ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                : "border-white/10 bg-white/5 text-white/55"
            }`}
          >
            {activePreset ? activePreset.name : "Manual"}
          </span>
        </div>

        <p className="text-[11px] leading-5 text-white/45">
          Saves your current base layer, OpenAIP overlay, weather layers, and
          conflict monitor state.
        </p>

        <div className="flex flex-wrap gap-2">
          {presets.length === 0 ? (
            <div className="w-full rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/45">
              No presets saved yet.
            </div>
          ) : (
            presets.map((preset) => {
              const isActive = preset.id === activePresetId;
              const isSelected = preset.id === selectedPresetId;

              return (
                <button
                  key={preset.id}
                  onClick={() => onApplyPreset(preset.id)}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                    isActive
                      ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                      : isSelected
                        ? "border-cyan-400/30 bg-white/[0.05] text-white"
                        : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {preset.name}
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSavePreset();
                }
              }}
              maxLength={32}
              placeholder="Preset name"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={handleSavePreset}
              className="cursor-pointer rounded-md bg-cyan-500 px-3 py-2 text-[11px] font-bold text-black transition-colors hover:bg-cyan-400"
            >
              Save Current
            </button>
          </div>

          {targetPreset && (
            <div className="space-y-2">
              <div className="text-[11px] text-white/45">
                Selected preset:{" "}
                <span className="text-white/75">{targetPreset.name}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onUpdatePreset(targetPreset.id);
                    setDeleteArmed(false);
                  }}
                  className="cursor-pointer rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-200 transition-colors hover:bg-cyan-500/15"
                >
                  Update Preset
                </button>
                <button
                  onClick={() => {
                    if (deleteArmed) {
                      onDeletePreset(targetPreset.id);
                      setDeleteArmed(false);
                      return;
                    }
                    setDeleteArmed(true);
                  }}
                  className={`cursor-pointer rounded-md border px-3 py-2 text-[11px] transition-colors ${
                    deleteArmed
                      ? "border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/20"
                      : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {deleteArmed ? "Click Again to Delete" : "Delete Preset"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
