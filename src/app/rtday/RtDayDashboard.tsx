"use client";

import dynamic from "next/dynamic";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  Clock3,
  Compass,
  Maximize2,
  Minimize2,
  Mountain,
  Plane,
  Radio,
  Route,
  ShieldCheck,
  Trophy,
  Wind,
  X,
} from "lucide-react";
import { useAircraftStream } from "~/hooks/useAircraftStream";
import { useAirlineTelephony } from "~/hooks/useAirlineTelephony";
import { UnitPreferencesProvider } from "~/hooks/useUnitPreferences";
import { TimeDisplayPreferenceProvider } from "~/hooks/useTimeDisplayPreference";
import { DEFAULT_RADAR_KEYBINDS } from "~/lib/radarKeybindPreferences";
import {
  RT_DAY_RECORD,
  RT_DAY_TARGET,
  validRtDayAircraft,
} from "~/lib/rtDayTelemetry";
import styles from "./rtday.module.css";
import { openPrivacySettings } from "~/components/privacy/PrivacyConsentProvider";

const RadarMap = dynamic(() => import("~/components/map"), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading}>
      <Radio size={30} />
      <span>Preparing live radar…</span>
    </div>
  ),
});
const noop = () => undefined;
const number = (value: number) => Math.round(value).toLocaleString("en-GB");

function Metric({
  icon,
  label,
  value,
  unit,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  detail: string;
}) {
  return (
    <div className={styles.metric} title={detail}>
      <div className={styles.metricLabel}>
        {icon}
        <span>{label}</span>
      </div>
      <div className={styles.metricValue}>
        {value}
        <small>{unit}</small>
      </div>
    </div>
  );
}

function MilestoneCelebration({
  milestone,
  preview,
  onDismiss,
}: {
  milestone: number;
  preview: boolean;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const timer = setTimeout(() => dialog?.close(), 9000);
    return () => {
      clearTimeout(timer);
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className={styles.celebration}
      aria-labelledby="milestone-title"
      onClose={() => {
        if (!dialogRef.current?.open) onDismiss();
      }}
    >
      <div className={styles.confetti} aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <i
            key={i}
            style={
              {
                "--x": `${(i * 37) % 100}%`,
                "--delay": `${(i % 7) * 0.12}s`,
                "--angle": `${i * 47}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <Trophy
        className={styles.celebrationTrophy}
        size={64}
        aria-hidden="true"
      />
      {preview && <span className={styles.celebrationPreview}>Preview</span>}
      <h2 id="milestone-title">
        {milestone === RT_DAY_RECORD ? "Record matched" : "New record"}
      </h2>
      <p>
        <strong>{milestone}</strong> flights online
      </p>
      <button onClick={() => dialogRef.current?.close()}>Back to radar</button>
    </dialog>
  );
}

export default function RtDayDashboard() {
  return (
    <UnitPreferencesProvider>
      <TimeDisplayPreferenceProvider>
        <Dashboard />
      </TimeDisplayPreferenceProvider>
    </UnitPreferencesProvider>
  );
}

function Dashboard() {
  const {
    aircrafts: streamedAircrafts,
    connectionStatus,
    lastMessageAgeSeconds,
  } = useAircraftStream();
  const decoratedAircrafts = useAirlineTelephony(streamedAircrafts);
  const [now, setNow] = useState<number | null>(null);
  const [peak, setPeak] = useState(0);
  const [celebration, setCelebration] = useState<number | null>(null);
  const celebratedMilestone = useRef(0);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<number | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keybinds, setKeybinds] = useState(DEFAULT_RADAR_KEYBINDS);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "preview",
    );
    if (requested !== "50" && requested !== "51") {
      setPreviewReady(true);
      return;
    }

    const target = Number(requested);
    setPreviewTarget(target);
    setPreviewCount(0);
    setPreviewReady(true);

    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      let step = 0;
      interval = setInterval(() => {
        step += 1;
        setPreviewCount(Math.round((target * step) / 20));
        if (step === 20) clearInterval(interval);
      }, 100);
    }, 600);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, []);
  const year = now === null ? null : new Date(now).getUTCFullYear();
  const {
    results: recordedFlights,
    status: totalsStatus,
    loadMore,
  } = usePaginatedQuery(
    api.flights.getRtDayFlightTotals,
    year === null ? "skip" : { year },
    { initialNumItems: 20 },
  );
  useEffect(() => {
    if (totalsStatus === "CanLoadMore") loadMore(20);
  }, [totalsStatus, loadMore]);
  const totalsReady = totalsStatus === "Exhausted";
  const eventTotals = recordedFlights.reduce(
    (sum, flight) => ({
      flights: sum.flights + (flight.included ? 1 : 0),
      distanceNm: sum.distanceNm + flight.distanceNm,
      durationMs: sum.durationMs + flight.durationMs,
    }),
    { flights: 0, distanceNm: 0, durationMs: 0 },
  );
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const syncFullscreen = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => {
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", syncFullscreen);
    };
  }, []);
  const live =
    connectionStatus === "connected" &&
    lastMessageAgeSeconds !== null &&
    lastMessageAgeSeconds < 30;
  const aircrafts = useMemo(
    () =>
      now === null || !live
        ? []
        : decoratedAircrafts.filter((aircraft) =>
            validRtDayAircraft(aircraft, now),
          ),
    [decoratedAircrafts, now, live],
  );
  useEffect(() => {
    setPeak((previous) => Math.max(previous, aircrafts.length));
  }, [aircrafts]);
  const selected = aircrafts.find(
    (aircraft) => (aircraft.id || aircraft.callsign) === selectedId,
  );
  const isPreview = previewTarget !== null;
  const count = isPreview ? previewCount : aircrafts.length;
  const milestone =
    count >= RT_DAY_TARGET
      ? RT_DAY_TARGET
      : count >= RT_DAY_RECORD
        ? RT_DAY_RECORD
        : 0;
  useEffect(() => {
    if (
      previewReady &&
      (live || isPreview) &&
      milestone > celebratedMilestone.current
    ) {
      celebratedMilestone.current = milestone;
      setCelebration(milestone);
    }
  }, [previewReady, live, isPreview, milestone]);
  const percentage = ((count / RT_DAY_TARGET) * 100).toFixed(2);
  const airports = new Set(
    aircrafts
      .flatMap((aircraft) => [aircraft.departure, aircraft.arrival])
      .map((code) => code?.trim().toUpperCase())
      .filter((code) => code && /^[A-Z]{4}$/.test(code)),
  );
  const types = new Set(
    aircrafts.map((aircraft) => aircraft.type).filter(Boolean),
  );
  const highest = aircrafts.reduce(
    (max, aircraft) =>
      Math.max(max, Number.isFinite(aircraft.altMSL) ? aircraft.altMSL : 0),
    0,
  );
  const fastest = aircrafts.reduce(
    (max, aircraft) =>
      Math.max(max, Number.isFinite(aircraft.speed) ? aircraft.speed : 0),
    0,
  );
  const minutes = Math.floor(eventTotals.durationMs / 60_000);
  const liveValue = (value: number) => (live ? number(value) : "—");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="RadarThing home">
          <Image
            src="/logo-white.svg"
            alt="RadarThing"
            width={162}
            height={35}
            priority
          />
        </Link>
        <span className={styles.eventTag}>RT DAY / 14 NOVEMBER</span>
        <div className={styles.headerActions}>
          <span className={styles.utc}>
            {now ? new Date(now).toISOString().slice(11, 19) : "--:--:--"} UTC
          </span>
          <button
            className={styles.iconButton}
            aria-label="Open privacy settings"
            onClick={openPrivacySettings}
          >
            <ShieldCheck size={17} />
          </button>
          <button
            className={styles.iconButton}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={() => {
              if (document.fullscreenElement)
                void document.exitFullscreen().catch(noop);
              else
                void document.documentElement.requestFullscreen?.().catch(noop);
            }}
          >
            {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          <Link href="/radar" className={styles.radarLink}>
            Open radar <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="flight-count-title">
        <div className={styles.record}>
          <div className={styles.counter}>
            <strong>{isPreview ? number(count) : liveValue(count)}</strong>
            <span>/ {RT_DAY_TARGET}</span>
          </div>
          <div className={styles.recordLabel}>
            <h1 id="flight-count-title">Flights online</h1>
            <span className={styles.percentage}>
              {live || isPreview ? `${percentage}%` : "—%"}
            </span>
          </div>
          <span className={live || isPreview ? styles.live : styles.offline}>
            <i />
            {isPreview
              ? "PREVIEW"
              : live
                ? "LIVE"
                : connectionStatus === "connecting"
                  ? "CONNECTING"
                  : "RECONNECTING"}
          </span>
          <div className={styles.progressRow}>
            <div
              className={styles.progress}
              role="progressbar"
              aria-label="Flights online toward the 51-flight target"
              aria-valuemin={0}
              aria-valuemax={RT_DAY_TARGET}
              aria-valuenow={Math.min(count, RT_DAY_TARGET)}
              aria-valuetext={
                live || isPreview
                  ? `${count} of ${RT_DAY_TARGET} simultaneous flights`
                  : "Waiting for live data"
              }
            >
              <div
                style={{
                  width: `${Math.min(count / RT_DAY_TARGET, 1) * 100}%`,
                }}
              />
            </div>
            <Trophy
              className={
                peak >= RT_DAY_TARGET || (isPreview && count >= RT_DAY_TARGET)
                  ? styles.trophyReached
                  : styles.trophyTarget
              }
              size={23}
              aria-label="Target: 51 simultaneous flights"
            />
          </div>
        </div>
      </section>
      {celebration !== null && (
        <MilestoneCelebration
          key={celebration}
          milestone={celebration}
          preview={isPreview}
          onDismiss={() => setCelebration(null)}
        />
      )}

      <div className={styles.dashboard}>
        <section className={styles.radarPanel} aria-label="Live event radar">
          <div className={styles.map}>
            <RadarMap
              aircrafts={aircrafts}
              airports={[]}
              onAircraftSelect={(aircraft) =>
                setSelectedId(
                  aircraft ? aircraft.id || aircraft.callsign : null,
                )
              }
              selectedAircraftIds={
                selected ? [selected.callsign || selected.id] : []
              }
              setDrawFlightPlanOnMap={noop}
              keybindPreferences={keybinds}
              onKeybindPreferencesChange={setKeybinds}
              hideUi
            />
            {!live && !isPreview && (
              <div className={styles.connectionNotice} role="status">
                {connectionStatus === "connecting"
                  ? "Connecting to the live flight feed…"
                  : "Live feed interrupted. Reconnecting…"}
              </div>
            )}
            {selected && (
              <div className={styles.flightDetail}>
                <div>
                  <strong>{selected.callsign || selected.id}</strong>
                  <span>
                    {selected.type} · {selected.departure || "—"} →{" "}
                    {selected.arrival || "—"}
                  </span>
                </div>
                <div>
                  <strong>
                    {number(selected.altMSL)} <small>ft</small>
                  </strong>
                  <span>{number(selected.speed)} kt</span>
                </div>
                <Link
                  href={`/radar?callsign=${encodeURIComponent(selected.callsign)}`}
                  aria-label={`Track ${selected.callsign} on radar`}
                >
                  <ArrowUpRight size={20} />
                </Link>
                <button
                  onClick={() => setSelectedId(null)}
                  aria-label="Close flight details"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        </section>
        <aside className={styles.telemetry}>
          <Metric
            icon={<Trophy />}
            label="RT Day flights"
            value={totalsReady ? number(eventTotals.flights) : "—"}
            unit="flights"
            detail="Saved flights departing on RT Day"
          />
          <Metric
            icon={<Route />}
            label="RT Day distance"
            value={totalsReady ? number(eventTotals.distanceNm) : "—"}
            unit="nm"
            detail="Combined routes of those saved flights"
          />
          <Metric
            icon={<Clock3 />}
            label="RT Day flight time"
            value={
              totalsReady
                ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
                : "—"
            }
            detail="Combined duration of those saved flights"
          />
          <Metric
            icon={<Compass />}
            label="Airports connected"
            value={liveValue(airports.size)}
            detail="Unique airports in live flight plans"
          />
        </aside>
      </div>
      <section
        className={styles.lowerStats}
        aria-label="Live flight statistics"
      >
        <Metric
          icon={<Trophy />}
          label="Session peak"
          value={number(peak)}
          unit="flights"
          detail={`This viewing session · ${live ? types.size : "—"} aircraft types live`}
        />
        <Metric
          icon={<Mountain />}
          label="Highest aircraft"
          value={liveValue(highest)}
          unit="ft"
          detail="Current altitude above sea level"
        />
        <Metric
          icon={<Wind />}
          label="Fastest aircraft"
          value={liveValue(fastest)}
          unit="kt"
          detail="Highest currently reported speed"
        />
        <Metric
          icon={<Plane />}
          label="Aircraft types"
          value={liveValue(types.size)}
          detail="Aircraft types in the live feed"
        />
      </section>
    </main>
  );
}
