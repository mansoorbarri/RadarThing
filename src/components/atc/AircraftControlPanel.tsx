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
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<ControlField, string>>
  >({});
  const clearFieldError = (field: ControlField) =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  const [modeInput, setModeInput] = useState<"nav" | "hdg">(
    aircraft.navMode ? "nav" : "hdg",
  );
  const [waypointInput, setWaypointInput] = useState("0");
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);

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
    setDisconnectConfirmOpen(false);
  }, [aircraft.id]);

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
    setFieldErrors({});
    setModeInput(aircraft.navMode ? "nav" : "hdg");
    setWaypointInput(currentWaypointValue);
  }, [
    aircraft.navMode,
    currentSpeedMode,
    currentWaypointIdent,
    flightPlanWaypoints,
  ]);

  const handleSetAll = useCallback(async () => {
    const errors = validateControlInputs({
      speed: speedInput,
      speedMode: speedModeInput,
      altitude: altitudeInput,
      heading: headingInput,
      headingActive: modeInput === "hdg",
      vs: vsInput,
      flaps: flapsInput,
      flapsMax: flapsMaxPosition,
      squawk: squawkInput,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Fix the highlighted fields before sending.");
      return;
    }

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
      setDisconnectConfirmOpen(false);
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
        <span className="font-mono text-[10px] font-black tracking-[0.3em] text-cyan-400 uppercase">
          Aircraft Control
        </span>
        <div className="h-[1px] flex-1 bg-white/20" />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="px-1 font-mono text-[10px] font-black tracking-[0.2em] text-white/60 uppercase">
            Autopilot Mode
          </p>
          <StyledSelect
            aria-label="Autopilot mode"
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
            <p className="px-1 font-mono text-[10px] font-black tracking-[0.2em] text-white/60 uppercase">
              Waypoint
            </p>
            <StyledSelect
              aria-label="Waypoint"
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
              aria-label="Speed unit"
              value={speedModeInput}
              onChange={(event) =>
                setSpeedModeInput(event.target.value as "knots" | "mach")
              }
            >
              <option value="knots">KNOTS</option>
              <option value="mach">MACH</option>
            </InlineUnitSelect>
          }
          accessibleLabel="Speed"
          placeholder={speedModeInput === "mach" ? "0–0.99" : "0–700"}
          error={fieldErrors.speed}
          value={speedInput}
          onChange={(v) => {
            setSpeedInput(v);
            clearFieldError("speed");
          }}
          min={0}
          max={
            speedModeInput === "mach"
              ? CONTROL_LIMITS.mach.max
              : CONTROL_LIMITS.knots.max
          }
          step={speedModeInput === "mach" ? 0.01 : 1}
        />

        <ControlRow
          label="ALT"
          accessibleLabel="Altitude"
          placeholder="0–60,000"
          error={fieldErrors.altitude}
          unit="FT"
          value={altitudeInput}
          onChange={(v) => {
            setAltitudeInput(v);
            clearFieldError("altitude");
          }}
          min={0}
          max={CONTROL_LIMITS.altitude.max}
          step={100}
        />

        {modeInput === "hdg" && (
          <ControlRow
            label="HDG"
            accessibleLabel="Heading"
            placeholder="0–360"
            error={fieldErrors.heading}
            unit="DEG"
            value={headingInput}
            onChange={(v) => {
              setHeadingInput(v);
              clearFieldError("heading");
            }}
            min={0}
            max={360}
          />
        )}

        <ControlRow
          label="V/S"
          accessibleLabel="Vertical speed"
          placeholder="±8,000"
          error={fieldErrors.vs}
          unit="FPM"
          value={vsInput}
          onChange={(v) => {
            setVsInput(v);
            clearFieldError("vs");
          }}
          min={CONTROL_LIMITS.vs.min}
          max={CONTROL_LIMITS.vs.max}
          step={100}
        />

        <div className="space-y-1">
          <ControlRow
            label="FLPS"
            accessibleLabel="Flaps"
            error={fieldErrors.flaps}
            unit={flapsMaxPosition > 0 ? `/${flapsMaxPosition}` : ""}
            value={flapsInput}
            onChange={(v) => {
              setFlapsInput(v);
              setFlapsError("");
              clearFieldError("flaps");
            }}
            min={0}
            max={flapsMaxPosition || 10}
            step={1}
          />
          {flapsError && (
            <p className="px-1 font-mono text-[11px] text-red-300">
              {flapsError}
            </p>
          )}
        </div>

        <ControlRow
          label="SQK"
          accessibleLabel="Squawk"
          error={fieldErrors.squawk}
          unit=""
          value={squawkInput}
          onChange={(v) => {
            setSquawkInput(v.replace(/[^0-7]/g, "").slice(0, 4));
            clearFieldError("squawk");
          }}
          isText
          placeholder="0000"
        />
      </div>

      <button
        type="button"
        onClick={handleSetAll}
        disabled={isLoading || !hasAnyInput}
        className="w-full rounded-xl bg-cyan-600 py-3 font-mono text-xs font-bold tracking-wider text-white uppercase transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Sending…" : "Send to aircraft"}
      </button>

      {!disconnectConfirmOpen ? (
        <button
          onClick={() => setDisconnectConfirmOpen(true)}
          disabled={isLoading}
          title="Stop this flight reporting to RadarThing"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 py-3 font-mono text-xs font-bold tracking-wider text-red-200 uppercase transition-colors hover:border-red-300/50 hover:bg-red-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PowerIcon />
          Disconnect
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3">
          <div>
            <p className="font-mono text-[10px] font-black tracking-[0.16em] text-red-200 uppercase">
              Disconnect flight?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              The flight stops reporting to RadarThing and is saved to its
              history. The pilot can start tracking again from GeoFS.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDisconnectConfirmOpen(false)}
              disabled={isLoading}
              className="rounded-lg border border-white/10 bg-white/5 py-2.5 font-mono text-[10px] font-bold tracking-wider text-white/60 uppercase transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnectFlight}
              disabled={isLoading}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/25 py-2.5 font-mono text-[10px] font-bold tracking-wider text-red-100 uppercase transition-colors hover:bg-red-500/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PowerIcon size={12} />
              Disconnect
            </button>
          </div>
        </div>
      )}

      <p className="px-1 font-mono text-[11px] text-white/60">
        Only filled-in fields are sent to GeoFS. NAV can target any waypoint in
        the active flight plan.
      </p>
    </div>
  );
}

export type ControlField =
  | "speed"
  | "altitude"
  | "heading"
  | "vs"
  | "flaps"
  | "squawk";

export const CONTROL_LIMITS = {
  knots: { min: 0, max: 700 },
  mach: { min: 0, max: 0.99 },
  altitude: { min: 0, max: 60000 },
  heading: { min: 0, max: 360 },
  vs: { min: -8000, max: 8000 },
} as const;

/**
 * Checks every filled-in field before anything is sent, so a typo like a
 * 5000 kt speed is caught with a message instead of being sent to GeoFS.
 */
export function validateControlInputs(input: {
  speed: string;
  speedMode: "knots" | "mach";
  altitude: string;
  heading: string;
  headingActive: boolean;
  vs: string;
  flaps: string;
  flapsMax: number;
  squawk: string;
}): Partial<Record<ControlField, string>> {
  const errors: Partial<Record<ControlField, string>> = {};
  const outOfRange = (value: number, min: number, max: number) =>
    !Number.isFinite(value) || value < min || value > max;

  if (input.speed.trim()) {
    const limits = CONTROL_LIMITS[input.speedMode];
    if (outOfRange(Number(input.speed), limits.min, limits.max))
      errors.speed =
        input.speedMode === "mach"
          ? `Mach must be between ${limits.min} and ${limits.max}.`
          : `Speed must be between ${limits.min} and ${limits.max} kt.`;
  }
  if (input.altitude.trim()) {
    const { min, max } = CONTROL_LIMITS.altitude;
    if (outOfRange(Number(input.altitude), min, max))
      errors.altitude = `Altitude must be between ${min.toLocaleString()} and ${max.toLocaleString()} ft.`;
  }
  if (input.headingActive && input.heading.trim()) {
    const { min, max } = CONTROL_LIMITS.heading;
    if (outOfRange(Number(input.heading), min, max))
      errors.heading = `Heading must be between ${min} and ${max}°.`;
  }
  if (input.vs.trim()) {
    const { min, max } = CONTROL_LIMITS.vs;
    if (outOfRange(Number(input.vs), min, max))
      errors.vs = `Vertical speed must be between ${min.toLocaleString()} and ${max.toLocaleString()} fpm.`;
  }
  if (input.flaps.trim()) {
    const max = input.flapsMax > 0 ? input.flapsMax : 10;
    const value = Number(input.flaps);
    if (!Number.isInteger(value) || outOfRange(value, 0, max))
      errors.flaps = `Flaps must be a whole notch from 0 to ${max}.`;
  }
  if (input.squawk && !/^[0-7]{4}$/.test(input.squawk))
    errors.squawk = "Squawk must be 4 digits, each 0–7.";
  return errors;
}

function PowerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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
  /** Spoken name for screen readers, e.g. "Speed" for "SPD". */
  accessibleLabel: string;
  error?: string;
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
  accessibleLabel,
  error,
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

  const inputId = `control-${label.toLowerCase().replace(/[^a-z]/g, "")}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-black/40 p-2 transition-all hover:border-white/20 ${error ? "border-red-400/60" : "border-white/10"}`}
      >
        <label
          htmlFor={inputId}
          className="w-10 font-mono text-[11px] font-black tracking-wider text-cyan-300"
        >
          <span aria-hidden="true">{label}</span>
          <span className="sr-only">{accessibleLabel}</span>
        </label>

        {!isText && (
          <button
            type="button"
            onClick={decrement}
            aria-label={`Decrease ${accessibleLabel.toLowerCase()}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-mono text-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            −
          </button>
        )}

        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          inputMode={isText ? "numeric" : undefined}
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
            type="button"
            onClick={increment}
            aria-label={`Increase ${accessibleLabel.toLowerCase()}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-mono text-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            +
          </button>
        )}

        {typeof unit === "string" && unit ? (
          <span className="w-8 font-mono text-[10px] font-bold text-white/60">
            {unit}
          </span>
        ) : unit ? (
          <div className="shrink-0">{unit}</div>
        ) : null}
      </div>
      {error && (
        <p id={errorId} className="px-1 text-[11px] text-red-300">
          {error}
        </p>
      )}
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
