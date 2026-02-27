"use client";

import React, { useState, useCallback } from "react";
import { useAircraftCommands } from "~/hooks/useAircraftCommands";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { Analytics } from "~/lib/analytics";
import { toast } from "sonner";

interface AircraftControlPanelProps {
  aircraft: PositionUpdate & { altMSL?: number };
}

type PendingAction = "setAll";

export function AircraftControlPanel({ aircraft }: AircraftControlPanelProps) {
  const {
    setSpeed,
    setAltitude,
    setHeading,
    setVS,
    setSquawk,
    setFlaps,
    isLoading,
  } = useAircraftCommands();

  const [speedInput, setSpeedInput] = useState("");
  const [altitudeInput, setAltitudeInput] = useState("");
  const [headingInput, setHeadingInput] = useState("");
  const [vsInput, setVsInput] = useState("");
  const [squawkInput, setSquawkInput] = useState("");
  const [flapsInput, setFlapsInput] = useState("");
  const [flapsError, setFlapsError] = useState("");
  const [showNavWarning, setShowNavWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  const aircraftId = aircraft.id;
  const flapsMaxPosition = aircraft.flapsMaxPosition ?? 0;
  // Check navMode - but note this may be stale (updates every 5 seconds)
  const isInNavMode = aircraft.navMode === true;

  const resetForm = useCallback(() => {
    setSpeedInput("");
    setAltitudeInput("");
    setHeadingInput("");
    setVsInput("");
    setSquawkInput("");
    setFlapsInput("");
    setFlapsError("");
  }, []);

  // User confirms they want to switch from NAV to HDG mode
  const handleConfirmHeadingChange = useCallback(() => {
    const speed = parseInt(speedInput, 10);
    const altitude = parseInt(altitudeInput, 10);
    const headingValue = parseInt(headingInput, 10);
    const vs = parseInt(vsInput, 10);
    const flaps = parseInt(flapsInput, 10);

    const controlsSet: string[] = [];

    if (!isNaN(speed) && speed >= 0) {
      setSpeed(aircraftId, speed);
      controlsSet.push("speed");
    }
    if (!isNaN(altitude) && altitude >= 0) {
      setAltitude(aircraftId, altitude);
      controlsSet.push("altitude");
    }
    if (!isNaN(headingValue) && headingValue >= 0 && headingValue <= 360) {
      setHeading(aircraftId, headingValue);
      controlsSet.push("heading");
    }
    if (!isNaN(vs)) {
      setVS(aircraftId, vs);
      controlsSet.push("vs");
    }
    if (/^[0-7]{4}$/.test(squawkInput)) {
      setSquawk(aircraftId, squawkInput);
      controlsSet.push("squawk");
    }
    if (
      !isNaN(flaps) &&
      flaps >= 0 &&
      (flapsMaxPosition === 0 || flaps <= flapsMaxPosition)
    ) {
      setFlaps(aircraftId, flaps);
      controlsSet.push("flaps");
    }

    if (controlsSet.length > 0) {
      Analytics.controlSetAll({ callsign: aircraftId, controls: controlsSet });
      toast.success(`Controls sent: ${controlsSet.join(", ").toUpperCase()}`);
    }

    resetForm();
    setShowNavWarning(false);
    setPendingAction(null);
  }, [
    aircraftId,
    headingInput,
    speedInput,
    altitudeInput,
    vsInput,
    squawkInput,
    flapsInput,
    flapsMaxPosition,
    setHeading,
    setSpeed,
    setAltitude,
    setVS,
    setSquawk,
    setFlaps,
    resetForm,
  ]);

  const handleCancelWarning = useCallback(() => {
    setShowNavWarning(false);
    setPendingAction(null);
  }, []);

  const handleSetAll = useCallback(() => {
    const speed = parseInt(speedInput, 10);
    const altitude = parseInt(altitudeInput, 10);
    const heading = parseInt(headingInput, 10);
    const vs = parseInt(vsInput, 10);
    const flaps = parseInt(flapsInput, 10);

    const hasHeadingToSet = !isNaN(heading) && heading >= 0 && heading <= 360;

    // If in NAV mode and heading is being set, show warning first
    if (isInNavMode && hasHeadingToSet) {
      setPendingAction("setAll");
      setShowNavWarning(true);
      return;
    }

    // Track which controls are being set
    const controlsSet: string[] = [];

    // Execute all commands
    if (!isNaN(speed) && speed >= 0) {
      setSpeed(aircraftId, speed);
      controlsSet.push("speed");
    }
    if (!isNaN(altitude) && altitude >= 0) {
      setAltitude(aircraftId, altitude);
      controlsSet.push("altitude");
    }
    if (hasHeadingToSet) {
      setHeading(aircraftId, heading);
      controlsSet.push("heading");
    }
    if (!isNaN(vs)) {
      setVS(aircraftId, vs);
      controlsSet.push("vs");
    }
    if (/^[0-7]{4}$/.test(squawkInput)) {
      setSquawk(aircraftId, squawkInput);
      controlsSet.push("squawk");
    }
    if (
      !isNaN(flaps) &&
      flaps >= 0 &&
      (flapsMaxPosition === 0 || flaps <= flapsMaxPosition)
    ) {
      setFlaps(aircraftId, flaps);
      controlsSet.push("flaps");
    }

    if (controlsSet.length > 0) {
      Analytics.controlSetAll({ callsign: aircraftId, controls: controlsSet });
      toast.success(`Controls sent: ${controlsSet.join(", ").toUpperCase()}`);
      resetForm();
    }
  }, [
    aircraftId,
    speedInput,
    altitudeInput,
    headingInput,
    vsInput,
    squawkInput,
    flapsInput,
    flapsMaxPosition,
    isInNavMode,
    setSpeed,
    setAltitude,
    setHeading,
    setVS,
    setSquawk,
    setFlaps,
    resetForm,
  ]);

  const hasAnyInput =
    speedInput ||
    altitudeInput ||
    headingInput ||
    vsInput ||
    squawkInput ||
    flapsInput;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <div className="h-[1px] flex-1 bg-white/20" />
        <span className="font-mono text-[9px] font-black tracking-[0.3em] text-cyan-400 uppercase">
          Aircraft Control
        </span>
        <div className="h-[1px] flex-1 bg-white/20" />
      </div>

      {/* NAV Mode Warning Modal */}
      {showNavWarning && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/50 p-3">
          <div className="mb-3">
            <p className="font-mono text-xs font-bold text-amber-300">
              Aircraft is in NAV mode
            </p>
            <p className="mt-1 font-mono text-[10px] text-amber-200/80">
              Setting a heading will switch the autopilot from NAV mode to HDG
              mode. The aircraft will stop following its flight plan.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmHeadingChange}
              className="flex-1 rounded-lg bg-amber-600 py-2 font-mono text-xs font-bold text-white transition-colors hover:bg-amber-500"
            >
              Switch to HDG
            </button>
            <button
              onClick={handleCancelWarning}
              className="flex-1 rounded-lg border border-white/20 bg-black/40 py-2 font-mono text-xs font-bold text-white transition-colors hover:bg-black/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <ControlRow
          label="SPD"
          unit="KTS"
          value={speedInput}
          onChange={setSpeedInput}
          min={0}
          max={999}
        />

        <ControlRow
          label="ALT"
          unit="FT"
          value={altitudeInput}
          onChange={setAltitudeInput}
          min={0}
          max={60000}
          step={100}
        />

        <ControlRow
          label="HDG"
          unit="DEG"
          value={headingInput}
          onChange={setHeadingInput}
          min={0}
          max={360}
        />

        <ControlRow
          label="V/S"
          unit="FPM"
          value={vsInput}
          onChange={setVsInput}
          min={-9999}
          max={9999}
          step={100}
        />

        <div className="space-y-1">
          <ControlRow
            label="FLPS"
            unit={flapsMaxPosition > 0 ? `/${flapsMaxPosition}` : ""}
            value={flapsInput}
            onChange={(v) => {
              setFlapsInput(v);
              setFlapsError("");
            }}
            min={0}
            max={flapsMaxPosition || 10}
            step={1}
          />
          {flapsError && (
            <p className="px-1 font-mono text-[9px] text-red-400">
              {flapsError}
            </p>
          )}
        </div>

        <ControlRow
          label="SQK"
          unit=""
          value={squawkInput}
          onChange={(v) => setSquawkInput(v.replace(/[^0-7]/g, "").slice(0, 4))}
          isText
          placeholder="0000"
        />
      </div>

      <button
        onClick={handleSetAll}
        disabled={isLoading || !hasAnyInput}
        className="w-full rounded-xl bg-cyan-600 py-3 font-mono text-xs font-bold tracking-wider text-white uppercase transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        SET
      </button>

      <p className="px-1 font-mono text-[9px] text-white/30">
        Commands sent to GeoFS. Ensure autopilot is engaged.
      </p>
    </div>
  );
}

interface ControlRowProps {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  isText?: boolean;
  isPercentage?: boolean;
  placeholder?: string;
}

function ControlRow({
  label,
  unit,
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 1,
  isText = false,
  isPercentage = false,
  placeholder,
}: ControlRowProps) {
  // For percentage, display is 0-100 but stored value is 0-1
  const displayValue = isPercentage
    ? String(Math.round(parseFloat(value || "0") * 100))
    : value;

  const handlePercentageChange = (displayVal: string) => {
    const num = parseInt(displayVal, 10);
    if (!isNaN(num)) {
      onChange(String(num / 100));
    } else {
      onChange("");
    }
  };

  const increment = () => {
    if (isText) return;
    if (isPercentage) {
      const num = parseFloat(value) || 0;
      const newVal = Math.min(num + step / 100, 1);
      onChange(String(newVal));
    } else {
      const num = parseInt(value, 10) || 0;
      const newVal = Math.min(num + step, max);
      onChange(String(newVal));
    }
  };

  const decrement = () => {
    if (isText) return;
    if (isPercentage) {
      const num = parseFloat(value) || 0;
      const newVal = Math.max(num - step / 100, 0);
      onChange(String(newVal));
    } else {
      const num = parseInt(value, 10) || 0;
      const newVal = Math.max(num - step, min);
      onChange(String(newVal));
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-2 transition-all hover:border-white/20">
      <span className="w-10 font-mono text-[10px] font-black tracking-wider text-cyan-400">
        {label}
      </span>

      {!isText && (
        <button
          onClick={decrement}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-mono text-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          −
        </button>
      )}

      <input
        type={isText ? "text" : "number"}
        value={isPercentage ? displayValue : value}
        onChange={(e) =>
          isPercentage
            ? handlePercentageChange(e.target.value)
            : onChange(e.target.value)
        }
        placeholder={placeholder}
        className="w-20 flex-1 [appearance:textfield] rounded-lg border border-white/20 bg-black/60 px-2 py-1.5 text-center font-mono text-base font-bold text-white transition-colors outline-none focus:border-cyan-500/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      {!isText && (
        <button
          onClick={increment}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-mono text-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          +
        </button>
      )}

      {unit && (
        <span className="w-8 font-mono text-[9px] font-bold text-white/40">
          {unit}
        </span>
      )}
    </div>
  );
}
