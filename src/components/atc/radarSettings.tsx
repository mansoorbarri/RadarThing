"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import { ProBadge } from "~/components/ui/pro-badge";
import { Analytics } from "~/lib/analytics";
import { useUnitPreferences } from "~/hooks/useUnitPreferences";
import { useTimeDisplayPreference } from "~/hooks/useTimeDisplayPreference";
import type { TimeDisplayMode } from "~/lib/timeDisplay";
import type { SpeedUnit, AltitudeUnit } from "~/lib/units";
import type { MapLayerPreset } from "~/lib/mapLayerPresets";
import {
  type RadarTrailMode,
  type RadarTrailPreferences,
} from "~/lib/radarTrailPreferences";

const SETTINGS_SECTION_IDS = [
  "presets",
  "weather",
  "trail",
  "traffic",
  "units",
] as const;

type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

const COLLAPSED_SECTIONS: Record<SettingsSectionId, boolean> = {
  presets: false,
  weather: false,
  trail: false,
  traffic: false,
  units: false,
};

interface RadarSettingsProps {
  isPRO: boolean;
  mapRenderer?: "flat" | "globe";
  onMapRendererChange?: (renderer: "flat" | "globe") => void;
  radarTrailPreferences?: RadarTrailPreferences;
  onRadarTrailPreferencesChange?: (preferences: RadarTrailPreferences) => void;
  presets: MapLayerPreset[];
  activePresetId: string | null;
  selectedPresetId: string | null;
  onApplyPreset: (presetId: string) => void;
  onSavePreset: (name: string) => { ok: true } | { ok: false; error: string };
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
  mapRenderer,
  onMapRendererChange,
  radarTrailPreferences,
  onRadarTrailPreferencesChange,
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
  const { timeDisplayMode, setUseLocalTime } = useTimeDisplayPreference();
  const [presetName, setPresetName] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [openSections, setOpenSections] = useState(COLLAPSED_SECTIONS);

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
  const allExpanded = SETTINGS_SECTION_IDS.every((id) => openSections[id]);
  const allCollapsed = SETTINGS_SECTION_IDS.every((id) => !openSections[id]);
  const currentTrailIntervalLabel = radarTrailPreferences
    ? radarTrailPreferences.mode === "minutes"
      ? `${radarTrailPreferences.minutes} sec`
      : `${radarTrailPreferences.distanceNm} NM`
    : null;

  const handleSavePreset = () => {
    const result = onSavePreset(presetName);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPresetName("");
    setDeleteArmed(false);
  };

  const toggleSection = (sectionId: SettingsSectionId) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  const setAllSections = (open: boolean) => {
    setOpenSections({
      presets: open,
      weather: open,
      trail: open,
      traffic: open,
      units: open,
    });
  };

  const updateRadarTrailPreferences = (
    updates: Partial<RadarTrailPreferences>,
    trackChange = true,
  ) => {
    if (!radarTrailPreferences || !onRadarTrailPreferencesChange) return;

    const nextPreferences = {
      ...radarTrailPreferences,
      ...updates,
    };
    onRadarTrailPreferencesChange(nextPreferences);
    if (trackChange) {
      Analytics.track("radar_trail_preference_changed", {
        enabled: nextPreferences.enabled,
        mode: nextPreferences.mode,
        seconds: nextPreferences.minutes,
        distance_nm: nextPreferences.distanceNm,
      });
    }
  };

  return (
    <div className="flex flex-col rounded-md border border-cyan-400/30 bg-black/90 font-mono text-cyan-400 shadow-xl backdrop-blur-md">
      <div className="flex flex-col gap-3 border-b border-white/10 p-3.5 sm:p-4">
        <div>
          <h3 className="text-[14px] font-bold tracking-widest text-white uppercase">
            RADAR CONFIGURATION
          </h3>
          <p className="mt-1 text-[10px] tracking-[0.22em] text-cyan-300/60 uppercase">
            Compact controls
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAllSections(false)}
            disabled={allCollapsed}
            className="cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] tracking-wider text-white/70 uppercase transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Collapse All
          </button>
          <button
            type="button"
            onClick={() => setAllSections(true)}
            disabled={allExpanded}
            className="cursor-pointer rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] tracking-wider text-cyan-200 uppercase transition-colors hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Expand All
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3.5 pr-2.5 sm:p-4 sm:pr-3">
        {mapRenderer && onMapRendererChange ? (
          <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold tracking-[0.16em] text-white uppercase">
                  Map Renderer
                </div>
                <p className="mt-1 text-[11px] leading-5 text-white/45">
                  Switch between the flat Leaflet map and globe renderer.
                </p>
              </div>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] tracking-wider text-cyan-200 uppercase">
                {mapRenderer === "globe" ? "Globe" : "Flat"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onMapRendererChange("flat")}
                className={`cursor-pointer rounded-md border px-3 py-2 text-[11px] transition-colors ${
                  mapRenderer === "flat"
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:text-white"
                }`}
              >
                Flat Map
              </button>
              <button
                type="button"
                onClick={() => onMapRendererChange("globe")}
                className={`cursor-pointer rounded-md border px-3 py-2 text-[11px] transition-colors ${
                  mapRenderer === "globe"
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:text-white"
                }`}
              >
                Globe View
              </button>
            </div>
          </div>
        ) : null}

        <SettingsSection
          title="Layer Presets"
          isOpen={openSections.presets}
          onToggle={() => toggleSection("presets")}
          headerSlot={
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] tracking-wider uppercase ${
                activePreset
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                  : "border-white/10 bg-white/5 text-white/55"
              }`}
            >
              {activePreset ? activePreset.name : "Manual"}
            </span>
          }
        >
          <p className="text-[11px] leading-5 text-white/45">
            Saves your current renderer, base layer, OpenAIP overlay, weather
            layers, and conflict monitor state.
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
            <div className="flex flex-col gap-2 sm:flex-row">
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
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-cyan-500/50"
              />
              <button
                onClick={handleSavePreset}
                className="cursor-pointer rounded-md bg-cyan-500 px-3 py-2 text-[11px] font-bold text-black transition-colors hover:bg-cyan-400 sm:self-auto"
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
                <div className="flex flex-col gap-2 sm:flex-row">
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
        </SettingsSection>

        <SettingsSection
          title="Weather Layers"
          isOpen={openSections.weather}
          onToggle={() => toggleSection("weather")}
        >
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
        </SettingsSection>

        {isPRO && radarTrailPreferences && onRadarTrailPreferencesChange ? (
          <SettingsSection
            title="Radar Trail"
            isOpen={openSections.trail}
            onToggle={() => toggleSection("trail")}
          >
            <SettingsToggle
              label="History Trails"
              description="Show radar history dots behind aircraft in radar mode."
              checked={radarTrailPreferences.enabled}
              onChange={(enabled) =>
                updateRadarTrailPreferences({ enabled })
              }
            />

            <div
              className={`space-y-3 ${!radarTrailPreferences.enabled ? "opacity-50" : ""}`}
            >
              <p className="text-[11px] leading-5 text-white/45">
                Choose whether each radar trail dot represents elapsed seconds or
                distance flown. Dots step out at that interval: 1x, 2x, 3x, and
                4x.
              </p>

              <TrailModeSelector
                value={radarTrailPreferences.mode}
                onChange={(mode) => updateRadarTrailPreferences({ mode })}
                disabled={!radarTrailPreferences.enabled}
              />

              <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] text-white uppercase">
                    Interval
                  </div>
                  <p className="mt-1 text-[11px] text-white/45">
                    {radarTrailPreferences.mode === "minutes"
                      ? "Each dot marks where the aircraft was this many seconds ago."
                      : "Each dot marks where the aircraft was this many nautical miles ago."}
                  </p>
                </div>

                <Slider
                  disabled={!radarTrailPreferences.enabled}
                  min={radarTrailPreferences.mode === "minutes" ? 2 : 1}
                  max={radarTrailPreferences.mode === "minutes" ? 60 : 10}
                  step={1}
                  value={[
                    radarTrailPreferences.mode === "minutes"
                      ? radarTrailPreferences.minutes
                      : radarTrailPreferences.distanceNm,
                  ]}
                  onValueChange={([value]) => {
                    if (!value) return;
                    updateRadarTrailPreferences(
                      radarTrailPreferences.mode === "minutes"
                        ? { minutes: value }
                        : { distanceNm: value },
                      false,
                    );
                  }}
                  onValueCommit={([value]) => {
                    if (!value) return;
                    Analytics.track("radar_trail_preference_changed", {
                      enabled: radarTrailPreferences.enabled,
                      mode: radarTrailPreferences.mode,
                      seconds:
                        radarTrailPreferences.mode === "minutes"
                          ? value
                          : radarTrailPreferences.minutes,
                      distance_nm:
                        radarTrailPreferences.mode === "nm"
                          ? value
                          : radarTrailPreferences.distanceNm,
                    });
                  }}
                  aria-label="Radar trail interval"
                />

                <div className="grid grid-cols-3 items-center text-[10px] tracking-[0.18em] text-white/35 uppercase">
                  <span>
                    {radarTrailPreferences.mode === "minutes" ? "2" : "1"}
                  </span>
                  <span className="text-center text-[11px] font-semibold tracking-[0.14em] text-cyan-200">
                    {currentTrailIntervalLabel}
                  </span>
                  <span className="text-right">
                    {radarTrailPreferences.mode === "minutes" ? "60" : "10"}
                  </span>
                </div>
              </div>
            </div>
          </SettingsSection>
        ) : null}

        <SettingsSection
          title="Traffic"
          isOpen={openSections.traffic}
          onToggle={() => toggleSection("traffic")}
        >
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
        </SettingsSection>

        <SettingsSection
          title="Display"
          isOpen={openSections.units}
          onToggle={() => toggleSection("units")}
        >
          <UnitSelector<TimeDisplayMode>
            label="Time"
            value={timeDisplayMode}
            onChange={(value) => {
              const enabled = value === "local";
              setUseLocalTime(enabled);
              Analytics.timeDisplayPreferenceChanged({
                mode: enabled ? "local" : "utc",
              });
            }}
            options={[
              { value: "utc", label: "Zulu" },
              { value: "local", label: "Local" },
            ]}
          />

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
        </SettingsSection>
      </div>
    </div>
  );
};

function SettingsSection({
  title,
  isOpen,
  onToggle,
  headerSlot,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  headerSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.03]"
        aria-expanded={isOpen}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-cyan-300 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
        <span className="text-[11px] tracking-widest text-cyan-300 uppercase">
          {title}
        </span>
        {headerSlot ? <span className="ml-auto">{headerSlot}</span> : null}
      </button>

      {isOpen ? (
        <div className="space-y-3 border-t border-white/10 px-3 py-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  proBadgeSource,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  proBadgeSource?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 text-sm ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          {label}
          {disabled && <ProBadge source={proBadgeSource} />}
        </span>
        {description ? (
          <p className="mt-1 max-w-[220px] text-[11px] leading-5 text-white/45">
            {description}
          </p>
        ) : null}
      </div>

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
    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span>{label}</span>
      <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5 sm:justify-end">
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

function TrailModeSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: RadarTrailMode;
  onChange: (value: RadarTrailMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("minutes")}
        className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          value === "minutes"
            ? "bg-cyan-500 text-black"
            : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        Seconds
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("nm")}
        className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          value === "nm"
            ? "bg-cyan-500 text-black"
            : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        Nautical Miles
      </button>
    </div>
  );
}
