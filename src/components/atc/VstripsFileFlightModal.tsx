"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { AlertCircle, CheckCircle, Loader2, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";

interface EventSettings {
  isEventLive: boolean;
  airportMode: string;
  fixedAirport?: string;
  departureMode: string;
  fixedDeparture?: string;
  arrivalMode: string;
  fixedArrival?: string;
  timeMode: string;
  fixedTime?: string;
  altitudeMode?: string;
  fixedAltitude?: string;
  speedMode?: string;
  fixedSpeed?: string;
  routeMode: string;
  fixedRoute?: string;
  activeAirports: string[];
  airportData: { id: string; name: string }[];
}

interface FlightForm {
  callsign: string;
  geofs_callsign: string;
  aircraft_type: string;
  departure_time: string;
  departure: string;
  arrival: string;
  altitude: string;
  speed: string;
  airport: string;
  route: string;
}

type SubmitResult =
  | { type: "success"; message: string }
  | { type: "error"; message: string; issues?: { message: string }[] };

const INITIAL_FORM: FlightForm = {
  callsign: "",
  geofs_callsign: "",
  aircraft_type: "",
  departure_time: "",
  departure: "",
  arrival: "",
  altitude: "",
  speed: "",
  airport: "",
  route: "",
};

export function VstripsFileFlightModal({
  open,
  settings,
  onClose,
}: {
  open: boolean;
  settings: EventSettings | null;
  onClose: () => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const dbUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip",
  );
  const [form, setForm] = useState<FlightForm>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const activeATCList = useMemo(() => {
    if (!settings) return [];
    return settings.airportData.filter((airport) =>
      settings.activeAirports.includes(airport.id),
    );
  }, [settings]);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setResult(null);
      setIsSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const discordUsername = dbUser?.discordUsername?.trim() || "";
  const profileLoaded = isLoaded && (!user?.id || dbUser !== undefined);
  const canSubmit =
    Boolean(settings?.isEventLive) &&
    isSignedIn &&
    profileLoaded &&
    Boolean(discordUsername) &&
    !isSubmitting;

  const updateField = (field: keyof FlightForm, value: string) => {
    const uppercaseFields: (keyof FlightForm)[] = [
      "callsign",
      "aircraft_type",
      "departure",
      "arrival",
      "altitude",
      "route",
    ];
    setForm((current) => ({
      ...current,
      [field]: uppercaseFields.includes(field) ? value.toUpperCase() : value,
    }));
  };

  const fixedValue = (
    mode: string | undefined,
    value: string | undefined,
    fallback: string,
  ) => (mode === "FIXED" ? value || "" : fallback);

  const renderInput = (
    label: string,
    field: keyof FlightForm,
    mode: string | undefined,
    fixed: string | undefined,
    placeholder: string,
    uppercase = true,
  ) => {
    const isFixed = mode === "FIXED";
    return (
      <label className="grid gap-1.5 text-xs font-medium text-slate-300">
        {label}
        <input
          value={fixedValue(mode, fixed, form[field])}
          readOnly={isFixed}
          onChange={(event) => updateField(field, event.target.value)}
          placeholder={placeholder}
          required
          className={`h-10 rounded-md border border-white/10 bg-black/55 px-3 text-sm text-slate-100 transition outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/15 ${
            uppercase ? "uppercase" : ""
          } ${isFixed ? "cursor-not-allowed opacity-60" : ""}`}
        />
      </label>
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings || !discordUsername) return;

    setIsSubmitting(true);
    setResult(null);

    const payload = {
      ...form,
      airport:
        settings.airportMode === "FIXED"
          ? settings.fixedAirport || ""
          : form.airport,
      departure:
        settings.departureMode === "FIXED"
          ? settings.fixedDeparture || ""
          : form.departure,
      departure_time:
        settings.timeMode === "FIXED"
          ? settings.fixedTime || ""
          : form.departure_time,
      arrival:
        settings.arrivalMode === "FIXED"
          ? settings.fixedArrival || ""
          : form.arrival,
      altitude:
        settings.altitudeMode === "FIXED"
          ? settings.fixedAltitude || ""
          : form.altitude,
      speed:
        settings.speedMode === "FIXED" ? settings.fixedSpeed || "" : form.speed,
      route:
        settings.routeMode === "FIXED" ? settings.fixedRoute || "" : form.route,
      discord_username: discordUsername,
    };

    try {
      const response = await fetch("/api/vstrips/flight-filing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
        issues?: { message: string }[];
      };

      if (!response.ok) {
        setResult({
          type: "error",
          message: data.error || "Unable to file flight",
          issues: data.issues,
        });
        return;
      }

      setResult({
        type: "success",
        message: data.message || "Thank you. Your flight is filed.",
      });
    } catch {
      setResult({ type: "error", message: "Unable to reach vstrips." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[10040] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"
      onMouseDown={handleBackdropMouseDown}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-xl border border-cyan-400/25 bg-[#050b10]/96 text-slate-100 shadow-[0_24px_90px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.2em] text-cyan-300 uppercase">
              vstrips
            </div>
            <h2 className="text-lg font-semibold">File Flight</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
            aria-label="Close file flight modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-74px)] overflow-y-auto px-5 py-5">
          {!isSignedIn ? (
            <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
              <p className="mb-3 font-medium">Sign in to file a flight.</p>
              <GoogleSignInButton>
                <button className="rounded-md border border-amber-300/40 bg-amber-300/15 px-3 py-2 text-xs font-semibold text-amber-100">
                  Sign In
                </button>
              </GoogleSignInButton>
            </div>
          ) : !settings?.isEventLive ? (
            <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 p-4 text-sm text-cyan-100">
              <AlertCircle className="mb-2 h-5 w-5" />
              <p className="font-medium">There is no active vstrips event.</p>
              <p className="mt-1 text-cyan-100/75">
                Flight filing will appear here when event filing is opened by an
                admin.
              </p>
            </div>
          ) : profileLoaded && !discordUsername ? (
            <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
              <AlertCircle className="mb-2 h-5 w-5" />
              <p className="font-medium">
                No Discord account is connected on RadarThing.
              </p>
              <p className="mt-1 text-amber-100/75">
                Connect Discord from your RadarThing dashboard before filing for
                an event.
              </p>
            </div>
          ) : result?.type === "success" ? (
            <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-5 text-center text-emerald-100">
              <CheckCircle className="mx-auto mb-3 h-10 w-10" />
              <p className="text-base font-semibold">Flight Filed</p>
              <p className="mt-1 text-sm text-emerald-100/75">
                {result.message}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {result?.type === "error" && (
                <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                  <p className="font-medium">{result.message}</p>
                  {result.issues && result.issues.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-red-100/80">
                      {result.issues.map((issue, index) => (
                        <li key={index}>{issue.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-medium text-slate-300">
                  Callsign
                  <input
                    value={form.callsign}
                    onChange={(event) =>
                      updateField("callsign", event.target.value)
                    }
                    placeholder="e.g., DAL123"
                    required
                    className="h-10 rounded-md border border-white/10 bg-black/55 px-3 text-sm text-slate-100 uppercase transition outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/15"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-300">
                  GeoFS Callsign
                  <input
                    value={form.geofs_callsign}
                    onChange={(event) =>
                      updateField("geofs_callsign", event.target.value)
                    }
                    placeholder="e.g., Ayman"
                    required
                    className="h-10 rounded-md border border-white/10 bg-black/55 px-3 text-sm text-slate-100 transition outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/15"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-300">
                  Aircraft
                  <input
                    value={form.aircraft_type}
                    onChange={(event) =>
                      updateField("aircraft_type", event.target.value)
                    }
                    placeholder="e.g., A320"
                    required
                    className="h-10 rounded-md border border-white/10 bg-black/55 px-3 text-sm text-slate-100 uppercase transition outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/15"
                  />
                </label>
                {renderInput(
                  "Time",
                  "departure_time",
                  settings?.timeMode,
                  settings?.fixedTime,
                  "e.g. 1720",
                  false,
                )}
              </div>

              <div className="h-px bg-white/10" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {renderInput(
                  "Departure Airport",
                  "departure",
                  settings?.departureMode,
                  settings?.fixedDeparture,
                  "e.g. KLAX",
                )}
                {renderInput(
                  "Arrival Airport",
                  "arrival",
                  settings?.arrivalMode,
                  settings?.fixedArrival,
                  "e.g. KJFK",
                )}
                {renderInput(
                  "Cruise Altitude",
                  "altitude",
                  settings?.altitudeMode,
                  settings?.fixedAltitude,
                  "e.g. FL350",
                )}
                {renderInput(
                  "Cruise Speed",
                  "speed",
                  settings?.speedMode,
                  settings?.fixedSpeed,
                  "e.g. 0.82",
                  false,
                )}
              </div>

              <div className="h-px bg-white/10" />

              <label className="grid gap-1.5 text-xs font-medium text-slate-300">
                Where do you want ATC?
                {settings?.airportMode === "FIXED" ? (
                  <input
                    value={`${activeATCList.find((airport) => airport.id === settings.fixedAirport)?.name || settings.fixedAirport || ""} (${settings.fixedAirport || ""})`}
                    readOnly
                    className="h-10 cursor-not-allowed rounded-md border border-white/10 bg-black/55 px-3 text-sm text-slate-100 opacity-60 outline-none"
                  />
                ) : (
                  <select
                    value={form.airport}
                    onChange={(event) =>
                      updateField("airport", event.target.value)
                    }
                    required
                    className="h-10 rounded-md border border-white/10 bg-black/80 px-3 text-sm text-slate-100 transition outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/15"
                  >
                    <option value="">Select an airport</option>
                    {activeATCList.map((airport) => (
                      <option key={airport.id} value={airport.id}>
                        {airport.name} ({airport.id})
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="grid gap-1.5 text-xs font-medium text-slate-300">
                Flight Route
                <textarea
                  value={
                    settings?.routeMode === "FIXED"
                      ? settings.fixedRoute || ""
                      : form.route
                  }
                  readOnly={settings?.routeMode === "FIXED"}
                  onChange={(event) => updateField("route", event.target.value)}
                  placeholder="e.g., DCT VOR VOR STAR"
                  required
                  className={`min-h-24 rounded-md border border-white/10 bg-black/55 px-3 py-2 text-sm text-slate-100 uppercase transition outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/15 ${
                    settings?.routeMode === "FIXED"
                      ? "cursor-not-allowed opacity-60"
                      : ""
                  }`}
                />
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-cyan-300/35 bg-cyan-400/15 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Submitting..." : "File Flight Plan"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
