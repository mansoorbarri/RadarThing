"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useAircraftCommands } from "~/hooks/useAircraftCommands";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { Analytics } from "~/lib/analytics";
import { toast } from "sonner";

interface AircraftControlPanelProps {
  aircraft: PositionUpdate & { altMSL?: number };
}

export function AircraftControlPanel({ aircraft }: AircraftControlPanelProps) {
  const {
    setSpeed,
    setAltitude,
    setHeading,
    setVS,
    setSquawk,
    setFlaps,
    enableNav,
    disableNav,
    setWaypoint,
    isLoading,
  } = useAircraftCommands();

  const [speedInput, setSpeedInput] = useState("");
  const [altitudeInput, setAltitudeInput] = useState("");
  const [headingInput, setHeadingInput] = useState("");
  const [vsInput, setVsInput] = useState("");
  const [squawkInput, setSquawkInput] = useState("");
  const [flapsInput, setFlapsInput] = useState("");
  const [flapsError, setFlapsError] = useState("");
  const [modeInput, setModeInput] = useState<"nav" | "hdg">(
    aircraft.navMode ? "nav" : "hdg",
  );
  const [waypointInput, setWaypointInput] = useState("0");

  const aircraftId = aircraft.id;
  const flapsMaxPosition = aircraft.flapsMaxPosition ?? 0;
  const currentWaypointIdent = aircraft.nextWaypoint ?? "";

  const flightPlanWaypoints = useMemo(() => {
    if (!aircraft.flightPlan) return [];

    try {
      const parsed = JSON.parse(aircraft.flightPlan) as {
        ident?: unknown;
        type?: unknown;
      }[];

      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((waypoint, index) => {
          const ident =
            typeof waypoint?.ident === "string" ? waypoint.ident.trim() : "";
          if (!ident) return null;

          const type =
            typeof waypoint?.type === "string" ? waypoint.type.trim() : "";

          return {
            value: String(index),
            ident,
            label: ident,
            type: type || "WPT",
            index,
          };
        })
        .filter((waypoint): waypoint is NonNullable<typeof waypoint> => {
          return waypoint !== null;
        });
    } catch {
      return [];
    }
  }, [aircraft.flightPlan]);

  useEffect(() => {
    setModeInput(aircraft.navMode ? "nav" : "hdg");
  }, [aircraft.id, aircraft.navMode]);

  useEffect(() => {
    if (currentWaypointIdent) {
      setWaypointInput(currentWaypointIdent);
      const matchingWaypoint = flightPlanWaypoints.find(
        (waypoint) => waypoint.ident === currentWaypointIdent,
      );
      if (matchingWaypoint) {
        setWaypointInput(matchingWaypoint.value);
      }
      return;
    }

    if (flightPlanWaypoints.length > 0) {
      setWaypointInput(flightPlanWaypoints[0]!.value);
    }
  }, [aircraft.id, currentWaypointIdent, flightPlanWaypoints]);

  const resetForm = useCallback(() => {
    const currentWaypointValue =
      flightPlanWaypoints.find((waypoint) => waypoint.ident === currentWaypointIdent)
        ?.value ||
      flightPlanWaypoints[0]?.value ||
      "0";

    setSpeedInput("");
    setAltitudeInput("");
    setHeadingInput("");
    setVsInput("");
    setSquawkInput("");
    setFlapsInput("");
    setFlapsError("");
    setModeInput(aircraft.navMode ? "nav" : "hdg");
    setWaypointInput(currentWaypointValue);
  }, [aircraft.navMode, currentWaypointIdent, flightPlanWaypoints]);

  const handleSetAll = useCallback(() => {
    const speed = parseInt(speedInput, 10);
    const altitude = parseInt(altitudeInput, 10);
    const heading = parseInt(headingInput, 10);
    const vs = parseInt(vsInput, 10);
    const flaps = parseInt(flapsInput, 10);
    const hasHeadingToSet =
      modeInput === "hdg" && !isNaN(heading) && heading >= 0 && heading <= 360;
    const hasModeChanged =
      (aircraft.navMode === true ? "nav" : "hdg") !== modeInput;
    const selectedWaypoint = flightPlanWaypoints.find(
      (waypoint) => waypoint.value === waypointInput,
    );
    const hasWaypointChanged =
      modeInput === "nav" &&
      selectedWaypoint !== undefined &&
      selectedWaypoint.ident !== currentWaypointIdent;

    // Track which controls are being set
    const controlsSet: string[] = [];

    if (modeInput === "nav") {
      if (flightPlanWaypoints.length === 0) {
        toast.error("No flight plan waypoints available for NAV mode");
        return;
      }

      if (!waypointInput) {
        toast.error("Choose a waypoint for NAV mode");
        return;
      }

      if (!selectedWaypoint) {
        toast.error("Selected waypoint is invalid");
        return;
      }
    }

    if (modeInput === "nav" && hasWaypointChanged) {
      setWaypoint(aircraftId, selectedWaypoint.ident);
      controlsSet.push("waypoint");
    }

    if (modeInput === "nav" && (hasModeChanged || hasWaypointChanged)) {
      enableNav(aircraftId);
      controlsSet.push("nav");
    }

    if (modeInput === "hdg" && hasModeChanged) {
      disableNav(aircraftId);
      controlsSet.push("hdg");
    }

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
    modeInput,
    waypointInput,
    aircraft.navMode,
    currentWaypointIdent,
    flightPlanWaypoints,
    setSpeed,
    setAltitude,
    setHeading,
    setVS,
    setSquawk,
    setFlaps,
    enableNav,
    disableNav,
    setWaypoint,
    resetForm,
  ]);

  const hasAnyInput =
    speedInput ||
    altitudeInput ||
    headingInput ||
    vsInput ||
    squawkInput ||
    flapsInput ||
    modeInput !== (aircraft.navMode ? "nav" : "hdg") ||
    (modeInput === "nav" &&
      flightPlanWaypoints.find((waypoint) => waypoint.value === waypointInput)
        ?.ident !== currentWaypointIdent);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <div className="h-[1px] flex-1 bg-white/20" />
        <span className="font-mono text-[9px] font-black tracking-[0.3em] text-cyan-400 uppercase">
          Aircraft Control
        </span>
        <div className="h-[1px] flex-1 bg-white/20" />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="px-1 font-mono text-[9px] font-black tracking-[0.2em] text-white/40 uppercase">
            Autopilot Mode
          </p>
          <StyledSelect
            value={modeInput}
            onChange={(event) =>
              setModeInput(event.target.value as "nav" | "hdg")
            }
          >
            <option value="nav">NAV</option>
            <option value="hdg">HDG</option>
          </StyledSelect>
        </div>

        {modeInput === "nav" && (
          <div className="space-y-1">
            <p className="px-1 font-mono text-[9px] font-black tracking-[0.2em] text-white/40 uppercase">
              Waypoint
            </p>
            <StyledSelect
              value={waypointInput}
              onChange={(event) => setWaypointInput(event.target.value)}
            >
              {flightPlanWaypoints.map((waypoint) => (
                <option
                  key={`${waypoint.index}-${waypoint.value}`}
                  value={waypoint.value}
                >
                  {waypoint.label} [{waypoint.type}]
                </option>
              ))}
            </StyledSelect>
          </div>
        )}

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

        {modeInput === "hdg" && (
          <ControlRow
            label="HDG"
            unit="DEG"
            value={headingInput}
            onChange={setHeadingInput}
            min={0}
            max={360}
          />
        )}

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
        Commands sent to GeoFS. NAV can target any waypoint in the active flight
        plan.
      </p>
    </div>
  );
}

interface StyledSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

function StyledSelect({ children, className, ...props }: StyledSelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`h-10 w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 pr-10 font-mono text-xs font-bold text-white outline-none transition-colors hover:bg-black/60 focus:border-cyan-500/50 ${className ?? ""}`}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-cyan-300">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
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
