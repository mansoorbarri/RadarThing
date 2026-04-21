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
    setSpeedMode,
    setAltitude,
    setHeading,
    setVS,
    setSquawk,
    setFlaps,
    enableNav,
    disableNav,
    setWaypoint,
    disconnectFlight,
    isLoading,
  } = useAircraftCommands();

  const [speedInput, setSpeedInput] = useState("");
  const [speedModeInput, setSpeedModeInput] = useState<"knots" | "mach">(
    aircraft.speedMode === "mach" ? "mach" : "knots",
  );
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
  const currentSpeedMode = aircraft.speedMode === "mach" ? "mach" : "knots";
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
    setSpeedModeInput(currentSpeedMode);
  }, [aircraft.id, currentSpeedMode]);

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
      flightPlanWaypoints.find(
        (waypoint) => waypoint.ident === currentWaypointIdent,
      )?.value ||
      flightPlanWaypoints[0]?.value ||
      "0";

    setSpeedInput("");
    setSpeedModeInput(currentSpeedMode);
    setAltitudeInput("");
    setHeadingInput("");
    setVsInput("");
    setSquawkInput("");
    setFlapsInput("");
    setFlapsError("");
    setModeInput(aircraft.navMode ? "nav" : "hdg");
    setWaypointInput(currentWaypointValue);
  }, [
    aircraft.navMode,
    currentSpeedMode,
    currentWaypointIdent,
    flightPlanWaypoints,
  ]);

  const handleSetAll = useCallback(async () => {
    const speed = parseFloat(speedInput);
    const altitude = parseInt(altitudeInput, 10);
    const heading = parseInt(headingInput, 10);
    const vs = parseInt(vsInput, 10);
    const flaps = parseInt(flapsInput, 10);
    const hasSpeedModeChanged = speedModeInput !== currentSpeedMode;
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

    try {
      if (modeInput === "nav" && hasWaypointChanged) {
        await setWaypoint(aircraftId, selectedWaypoint.ident);
        controlsSet.push("waypoint");
      }

      if (modeInput === "nav" && (hasModeChanged || hasWaypointChanged)) {
        await enableNav(aircraftId);
        controlsSet.push("nav");
      }

      if (modeInput === "hdg" && hasModeChanged) {
        await disableNav(aircraftId);
        controlsSet.push("hdg");
      }

      if (hasSpeedModeChanged) {
        await setSpeedMode(aircraftId, speedModeInput);
        controlsSet.push("speed mode");
      }
      if (!isNaN(speed) && speed >= 0) {
        await setSpeed(aircraftId, speed);
        controlsSet.push("speed");
      }
      if (!isNaN(altitude) && altitude >= 0) {
        await setAltitude(aircraftId, altitude);
        controlsSet.push("altitude");
      }
      if (hasHeadingToSet) {
        await setHeading(aircraftId, heading);
        controlsSet.push("heading");
      }
      if (!isNaN(vs)) {
        await setVS(aircraftId, vs);
        controlsSet.push("vs");
      }
      if (/^[0-7]{4}$/.test(squawkInput)) {
        await setSquawk(aircraftId, squawkInput);
        controlsSet.push("squawk");
      }
      if (
        !isNaN(flaps) &&
        flaps >= 0 &&
        (flapsMaxPosition === 0 || flaps <= flapsMaxPosition)
      ) {
        await setFlaps(aircraftId, flaps);
        controlsSet.push("flaps");
      }

      if (controlsSet.length > 0) {
        Analytics.controlSetAll({
          callsign: aircraftId,
          controls: controlsSet,
        });
        toast.success(`Controls sent: ${controlsSet.join(", ").toUpperCase()}`);
        resetForm();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send controls";
      toast.error(message);
    }
  }, [
    aircraftId,
    speedInput,
    speedModeInput,
    altitudeInput,
    headingInput,
    vsInput,
    squawkInput,
    flapsInput,
    flapsMaxPosition,
    modeInput,
    waypointInput,
    aircraft.navMode,
    currentSpeedMode,
    currentWaypointIdent,
    flightPlanWaypoints,
    setSpeed,
    setSpeedMode,
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

  const handleDisconnectFlight = useCallback(async () => {
    try {
      await disconnectFlight(aircraftId, aircraft.googleId);
      Analytics.flightDisconnected({
        callsign: aircraft.flightNo || aircraft.callsign || aircraftId,
      });
      toast.success("Flight disconnected from RadarThing");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect flight";
      toast.error(message);
    }
  }, [
    aircraft.callsign,
    aircraft.flightNo,
    aircraft.googleId,
    aircraftId,
    disconnectFlight,
  ]);

  const hasAnyInput =
    speedInput ||
    speedModeInput !== currentSpeedMode ||
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
          unit={
            <InlineUnitSelect
              value={speedModeInput}
              onChange={(event) =>
                setSpeedModeInput(event.target.value as "knots" | "mach")
              }
            >
              <option value="knots">KNOTS</option>
              <option value="mach">MACH</option>
            </InlineUnitSelect>
          }
          value={speedInput}
          onChange={setSpeedInput}
          min={0}
          max={speedModeInput === "mach" ? 3 : 999}
          step={speedModeInput === "mach" ? 0.01 : 1}
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

      <button
        onClick={handleDisconnectFlight}
        disabled={isLoading}
        title="Disconnect this flight from RadarThing SSE"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 py-3 font-mono text-xs font-bold tracking-wider text-red-200 uppercase transition-colors hover:border-red-300/50 hover:bg-red-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2v10" />
          <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
        </svg>
        Disconnect
      </button>

      <p className="px-1 font-mono text-[9px] text-white/30">
        Commands sent to GeoFS. NAV can target any waypoint in the active flight
        plan.
      </p>
    </div>
  );
}

interface StyledSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

function StyledSelect({ children, className, ...props }: StyledSelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`h-10 w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 pr-10 font-mono text-xs font-bold text-white transition-colors outline-none hover:bg-black/60 focus:border-cyan-500/50 ${className ?? ""}`}
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
  unit: React.ReactNode;
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
      const num = parseFloat(value) || 0;
      const newVal = Math.min(num + step, max);
      onChange(Number.isInteger(step) ? String(newVal) : newVal.toFixed(2));
    }
  };

  const decrement = () => {
    if (isText) return;
    if (isPercentage) {
      const num = parseFloat(value) || 0;
      const newVal = Math.max(num - step / 100, 0);
      onChange(String(newVal));
    } else {
      const num = parseFloat(value) || 0;
      const newVal = Math.max(num - step, min);
      onChange(Number.isInteger(step) ? String(newVal) : newVal.toFixed(2));
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
        min={isText ? undefined : min}
        max={isText ? undefined : max}
        step={isText ? undefined : step}
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

      {typeof unit === "string" && unit ? (
        <span className="w-8 font-mono text-[9px] font-bold text-white/40">
          {unit}
        </span>
      ) : unit ? (
        <div className="shrink-0">{unit}</div>
      ) : null}
    </div>
  );
}

function InlineUnitSelect({
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`h-8 w-[88px] appearance-none rounded-lg border border-white/10 bg-black/40 px-2 pr-6 font-mono text-[10px] font-bold text-white transition-colors outline-none hover:bg-black/60 focus:border-cyan-500/50 ${className ?? ""}`}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-cyan-300/80">
        <svg
          width="10"
          height="10"
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
