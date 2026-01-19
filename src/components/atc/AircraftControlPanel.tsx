"use client";

import React, { useState, useCallback } from "react";
import { useAircraftCommands } from "~/hooks/useAircraftCommands";
import { type PositionUpdate } from "~/lib/aircraft-store";

interface AircraftControlPanelProps {
  aircraft: PositionUpdate & { altMSL?: number };
}

export function AircraftControlPanel({ aircraft }: AircraftControlPanelProps) {
  const { setSpeed, setAltitude, setHeading, setVS, setSquawk, disableNav, isLoading } =
    useAircraftCommands();

  const [speedInput, setSpeedInput] = useState("");
  const [altitudeInput, setAltitudeInput] = useState("");
  const [headingInput, setHeadingInput] = useState("");
  const [vsInput, setVsInput] = useState("");
  const [squawkInput, setSquawkInput] = useState("");
  const [showNavWarning, setShowNavWarning] = useState(false);

  const aircraftId = aircraft.id;

  const handleSetSpeed = useCallback(() => {
    const value = parseInt(speedInput, 10);
    if (!isNaN(value) && value >= 0) {
      setSpeed(aircraftId, value);
    }
  }, [aircraftId, speedInput, setSpeed]);

  const handleSetAltitude = useCallback(() => {
    const value = parseInt(altitudeInput, 10);
    if (!isNaN(value) && value >= 0) {
      setAltitude(aircraftId, value);
    }
  }, [aircraftId, altitudeInput, setAltitude]);

  const handleSetHeading = useCallback(() => {
    const value = parseInt(headingInput, 10);
    if (!isNaN(value) && value >= 0 && value <= 360) {
      // Only show warning if aircraft is in NAV mode
      if (aircraft.navMode) {
        setShowNavWarning(true);
      } else {
        // Not in NAV mode, set heading directly
        setHeading(aircraftId, value);
      }
    }
  }, [headingInput, aircraft.navMode, aircraftId, setHeading]);

  const handleConfirmHeading = useCallback(() => {
    const value = parseInt(headingInput, 10);
    if (!isNaN(value) && value >= 0 && value <= 360) {
      disableNav(aircraftId);
      setTimeout(() => {
        setHeading(aircraftId, value);
      }, 100);
    }
    setShowNavWarning(false);
  }, [aircraftId, headingInput, setHeading, disableNav]);

  const handleSetVS = useCallback(() => {
    const value = parseInt(vsInput, 10);
    if (!isNaN(value)) {
      setVS(aircraftId, value);
    }
  }, [aircraftId, vsInput, setVS]);

  const handleSetSquawk = useCallback(() => {
    if (/^[0-7]{4}$/.test(squawkInput)) {
      setSquawk(aircraftId, squawkInput);
    }
  }, [aircraftId, squawkInput, setSquawk]);

  const handleSetAll = useCallback(() => {
    const speed = parseInt(speedInput, 10);
    const altitude = parseInt(altitudeInput, 10);
    const heading = parseInt(headingInput, 10);
    const vs = parseInt(vsInput, 10);

    if (!isNaN(speed) && speed >= 0) {
      setSpeed(aircraftId, speed);
    }
    if (!isNaN(altitude) && altitude >= 0) {
      setAltitude(aircraftId, altitude);
    }
    if (!isNaN(heading) && heading >= 0 && heading <= 360) {
      if (aircraft.navMode) {
        disableNav(aircraftId);
        setTimeout(() => setHeading(aircraftId, heading), 100);
      } else {
        setHeading(aircraftId, heading);
      }
    }
    if (!isNaN(vs)) {
      setVS(aircraftId, vs);
    }
    if (/^[0-7]{4}$/.test(squawkInput)) {
      setSquawk(aircraftId, squawkInput);
    }
  }, [aircraftId, speedInput, altitudeInput, headingInput, vsInput, squawkInput, aircraft.navMode, setSpeed, setAltitude, setHeading, setVS, setSquawk, disableNav]);

  const hasAnyInput = speedInput || altitudeInput || headingInput || vsInput || squawkInput;

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
          <p className="mb-3 font-mono text-xs text-amber-200">
            This will disable NAV mode and set manual heading. Continue?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmHeading}
              className="flex-1 rounded-lg bg-amber-600 py-2 font-mono text-xs font-bold text-white transition-colors hover:bg-amber-500"
            >
              Yes, Set HDG
            </button>
            <button
              onClick={() => setShowNavWarning(false)}
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
          onSet={handleSetSpeed}
          disabled={isLoading}
          min={0}
          max={999}
        />

        <ControlRow
          label="ALT"
          unit="FT"
          value={altitudeInput}
          onChange={setAltitudeInput}
          onSet={handleSetAltitude}
          disabled={isLoading}
          min={0}
          max={60000}
          step={100}
        />

        <ControlRow
          label="HDG"
          unit="DEG"
          value={headingInput}
          onChange={setHeadingInput}
          onSet={handleSetHeading}
          disabled={isLoading}
          min={0}
          max={360}
        />

        <ControlRow
          label="V/S"
          unit="FPM"
          value={vsInput}
          onChange={setVsInput}
          onSet={handleSetVS}
          disabled={isLoading}
          min={-9999}
          max={9999}
          step={100}
        />

        <ControlRow
          label="SQK"
          unit=""
          value={squawkInput}
          onChange={(v) => setSquawkInput(v.replace(/[^0-7]/g, "").slice(0, 4))}
          onSet={handleSetSquawk}
          disabled={isLoading || !/^[0-7]{4}$/.test(squawkInput)}
          isText
          placeholder="0000"
        />
      </div>

      <button
        onClick={handleSetAll}
        disabled={isLoading || !hasAnyInput}
        className="w-full rounded-xl bg-cyan-600 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Set All
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
  onSet: () => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  isText?: boolean;
  placeholder?: string;
}

function ControlRow({
  label,
  unit,
  value,
  onChange,
  onSet,
  disabled,
  min = 0,
  max = 99999,
  step = 1,
  isText = false,
  placeholder,
}: ControlRowProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSet();
  };

  const increment = () => {
    if (isText) return;
    const num = parseInt(value, 10) || 0;
    const newVal = Math.min(num + step, max);
    onChange(String(newVal));
  };

  const decrement = () => {
    if (isText) return;
    const num = parseInt(value, 10) || 0;
    const newVal = Math.max(num - step, min);
    onChange(String(newVal));
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-20 flex-1 rounded-lg border border-white/20 bg-black/60 px-2 py-1.5 text-center font-mono text-base font-bold text-white outline-none transition-colors focus:border-cyan-500/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
        <span className="w-8 font-mono text-[9px] font-bold text-white/40">{unit}</span>
      )}

      <button
        onClick={onSet}
        disabled={disabled}
        className="rounded-lg bg-cyan-600 px-3 py-1.5 font-mono text-[10px] font-bold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        SET
      </button>
    </div>
  );
}
