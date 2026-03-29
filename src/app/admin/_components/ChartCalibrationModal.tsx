"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  MapPinned,
  MousePointerClick,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { updateAirportChartCalibration } from "~/app/actions/airport-charts";
import { useAirportData } from "~/hooks/useAirportData";
import type {
  AirportChart,
  ChartCalibration,
  ChartCalibrationPoint,
} from "~/types/airportCharts";

const POINT_LABELS = ["A", "B", "C"] as const;

function parseCoordinateInput(
  value: string,
  kind: "lat" | "lon",
): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toUpperCase().replace(/\s+/g, "");
  const hemisphereMatch = normalized.match(/[NSEW]$/);
  const hemisphere = hemisphereMatch?.[0] ?? null;
  const unsigned = hemisphere ? normalized.slice(0, -1) : normalized;

  if (/^-?\d+(\.\d+)?$/.test(unsigned)) {
    const numeric = Number(unsigned);
    if (!Number.isFinite(numeric)) return null;

    const absNumeric = Math.abs(numeric);
    const isProbablyDms =
      (kind === "lat" && absNumeric >= 10000) ||
      (kind === "lon" && absNumeric >= 100000);

    if (!isProbablyDms) {
      const sign =
        hemisphere === "S" || hemisphere === "W"
          ? -1
          : hemisphere === "N" || hemisphere === "E"
            ? 1
            : 1;
      return absNumeric * sign * (numeric < 0 ? -1 : 1);
    }
  }

  const degreesDigits = kind === "lat" ? 2 : 3;
  const cleaned = unsigned.replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  const integral = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned;
  const fractional = dotIndex >= 0 ? cleaned.slice(dotIndex + 1) : "";

  if (integral.length < degreesDigits + 4) {
    const decimal = Number(unsigned);
    return Number.isFinite(decimal) ? decimal : null;
  }

  const degrees = Number(integral.slice(0, degreesDigits));
  const minutes = Number(integral.slice(degreesDigits, degreesDigits + 2));
  const seconds = Number(
    `${integral.slice(degreesDigits + 2)}${fractional ? `.${fractional}` : ""}`,
  );

  if (
    !Number.isFinite(degrees) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  const decimal = degrees + minutes / 60 + seconds / 3600;
  const sign =
    hemisphere === "S" || hemisphere === "W"
      ? -1
      : hemisphere === "N" || hemisphere === "E"
        ? 1
        : 1;

  return decimal * sign;
}

function formatCoordinateInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function defaultPoints(): ChartCalibrationPoint[] {
  return [
    { x: 0.2, y: 0.2, lat: Number.NaN, lon: Number.NaN },
    { x: 0.8, y: 0.2, lat: Number.NaN, lon: Number.NaN },
    { x: 0.5, y: 0.8, lat: Number.NaN, lon: Number.NaN },
  ];
}

function normalizeCalibration(
  calibration: ChartCalibration | null | undefined,
): ChartCalibrationPoint[] {
  if (!calibration?.points?.length) return defaultPoints();
  const safePoints = calibration.points
    .slice(0, 3)
    .map((point) => ({ ...point }));
  while (safePoints.length < 3) {
    safePoints.push(defaultPoints()[safePoints.length]!);
  }
  return safePoints;
}

interface ChartCalibrationModalProps {
  chart: AirportChart | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ChartCalibrationModal({
  chart,
  isOpen,
  onClose,
}: ChartCalibrationModalProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const selectionMarkerRef = useRef<L.CircleMarker | null>(null);
  const selectedPointRef = useRef(0);
  const [selectedPoint, setSelectedPoint] = useState(0);
  const [points, setPoints] = useState<ChartCalibrationPoint[]>(defaultPoints);
  const [draftInputs, setDraftInputs] = useState<
    { lat: string; lon: string }[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const { airports, fetchAirports } = useAirportData();

  useEffect(() => {
    if (!isOpen || !chart) return;
    const normalizedPoints = normalizeCalibration(chart.chartCalibration);
    setPoints(normalizedPoints);
    setDraftInputs(
      normalizedPoints.map((point) => ({
        lat: formatCoordinateInput(point.lat),
        lon: formatCoordinateInput(point.lon),
      })),
    );
    setSelectedPoint(0);
  }, [chart, isOpen]);

  useEffect(() => {
    selectedPointRef.current = selectedPoint;
  }, [selectedPoint]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchAirports();
  }, [fetchAirports, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSaving, onClose]);

  const allCoordinatesEntered = useMemo(
    () =>
      points.every(
        (point) => Number.isFinite(point.lat) && Number.isFinite(point.lon),
      ),
    [points],
  );

  const airportMatch = useMemo(() => {
    if (!chart?.icao || airports.length === 0) return null;
    return airports.find((airport) => airport.icao === chart.icao) ?? null;
  }, [airports, chart?.icao]);

  const chartId = chart?.id ?? null;

  function updatePoint(index: number, patch: Partial<ChartCalibrationPoint>) {
    setPoints((current) =>
      current.map((point, pointIndex) =>
        pointIndex === index ? { ...point, ...patch } : point,
      ),
    );
  }

  function updateDraftInput(
    index: number,
    field: "lat" | "lon",
    rawValue: string,
  ) {
    setDraftInputs((current) =>
      current.map((point, pointIndex) =>
        pointIndex === index ? { ...point, [field]: rawValue } : point,
      ),
    );

    const parsed = parseCoordinateInput(rawValue, field);
    updatePoint(index, { [field]: parsed ?? Number.NaN });
  }

  function syncDraftCoordinate(index: number, lat: number, lon: number) {
    setDraftInputs((current) =>
      current.map((point, pointIndex) =>
        pointIndex === index
          ? {
              ...point,
              lat: lat.toFixed(6),
              lon: lon.toFixed(6),
            }
          : point,
      ),
    );
  }

  function syncMapMarker(lat: number, lon: number) {
    const map = mapRef.current;
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lon)) return;

    if (!selectionMarkerRef.current) {
      selectionMarkerRef.current = L.circleMarker([lat, lon], {
        radius: 7,
        color: "#22d3ee",
        weight: 2,
        fillColor: "#06b6d4",
        fillOpacity: 0.85,
      }).addTo(map);
      return;
    }

    selectionMarkerRef.current.setLatLng([lat, lon]);
  }

  function handleImageClick(event: React.MouseEvent<HTMLImageElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    updatePoint(selectedPoint, {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    });
  }

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      minZoom: 2,
      maxZoom: 18,
    }).setView([20, 0], 3);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (event: L.LeafletMouseEvent) => {
      const { lat, lng: lon } = event.latlng;
      const pointIndex = selectedPointRef.current;
      updatePoint(pointIndex, { lat, lon });
      syncDraftCoordinate(pointIndex, lat, lon);
      syncMapMarker(lat, lon);
    });

    mapRef.current = map;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      selectionMarkerRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isOpen) return;

    const selected = points[selectedPoint];
    if (
      selected &&
      Number.isFinite(selected.lat) &&
      Number.isFinite(selected.lon)
    ) {
      syncMapMarker(selected.lat, selected.lon);
    } else if (selectionMarkerRef.current) {
      map.removeLayer(selectionMarkerRef.current);
      selectionMarkerRef.current = null;
    }
  }, [isOpen, points, selectedPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isOpen) return;

    if (airportMatch) {
      map.setView([airportMatch.lat, airportMatch.lon], 14, { animate: false });
      return;
    }

    const calibrationPoints = chart?.chartCalibration?.points;
    if (!calibrationPoints?.length) return;

    const avgLat =
      calibrationPoints.reduce((sum, point) => sum + point.lat, 0) /
      calibrationPoints.length;
    const avgLon =
      calibrationPoints.reduce((sum, point) => sum + point.lon, 0) /
      calibrationPoints.length;

    if (Number.isFinite(avgLat) && Number.isFinite(avgLon)) {
      map.setView([avgLat, avgLon], 14, { animate: false });
    }
  }, [airportMatch, chart, isOpen]);

  async function handleSave() {
    if (!chartId) return;
    setIsSaving(true);
    const result = await updateAirportChartCalibration(chartId, { points });
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error || "Failed to save chart calibration");
      return;
    }

    toast.success("Chart calibration saved");
    onClose();
  }

  async function handleClear() {
    if (!chartId) return;
    setIsSaving(true);
    const result = await updateAirportChartCalibration(chartId, null);
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error || "Failed to clear chart calibration");
      return;
    }

    toast.success("Chart calibration cleared");
    onClose();
  }

  if (!isOpen || !chart) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#071019] shadow-2xl">
        <button
          onClick={() => !isSaving && onClose()}
          disabled={isSaving}
          className="absolute top-4 right-4 z-10 cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-white/10 px-6 py-5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
            <MapPinned className="h-3.5 w-3.5" />
            Ownship Calibration
          </div>
          <h2 className="text-xl font-semibold text-white">
            {chart.chartName}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Click the chart to place three reference points, then enter the
            exact latitude and longitude for each point. The userscript uses
            these points to place live ownship on the image.
          </p>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-h-0 overflow-auto bg-black/30 p-6">
            <div className="relative mx-auto max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={chart.chartUrl}
                alt={chart.chartName}
                className="block w-full cursor-crosshair select-none"
                onClick={handleImageClick}
                draggable={false}
              />

              {points.map((point, index) => (
                <button
                  key={POINT_LABELS[index]}
                  type="button"
                  onClick={() => setSelectedPoint(index)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 px-2 py-1 text-xs font-bold transition-all ${
                    selectedPoint === index
                      ? "border-cyan-300 bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30"
                      : "border-white/80 bg-slate-950/90 text-white"
                  }`}
                  style={{
                    left: `${point.x * 100}%`,
                    top: `${point.y * 100}%`,
                  }}
                >
                  {POINT_LABELS[index]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 overflow-auto border-t border-white/10 bg-slate-950/70 p-6 lg:border-t-0 lg:border-l">
            <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                <MousePointerClick className="h-4 w-4 text-cyan-400" />
                Map Picker
              </div>
              <ol className="space-y-2 text-sm text-slate-400">
                <li>1. Pick point A, B, or C.</li>
                <li>2. Click the matching location on the chart image.</li>
                <li>
                  3. Click the same location on the map to fill coordinates.
                </li>
                <li>4. Adjust manually only if needed, then save.</li>
              </ol>
            </div>

            <div className="mb-5 overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <div className="text-sm font-medium text-white">
                  {airportMatch
                    ? `${airportMatch.icao} Map`
                    : `${chart.icao} Map`}
                </div>
                <div className="text-xs text-slate-400">
                  {airportMatch
                    ? "Centered on airport"
                    : "Click map to set selected point"}
                </div>
              </div>
              <div ref={mapContainerRef} className="h-72 w-full" />
            </div>

            <div className="space-y-4">
              {points.map((point, index) => (
                <div
                  key={POINT_LABELS[index]}
                  className={`rounded-xl border p-4 transition-colors ${
                    selectedPoint === index
                      ? "border-cyan-500/40 bg-cyan-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedPoint(index)}
                      className="cursor-pointer rounded-lg bg-white/5 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Point {POINT_LABELS[index]}
                    </button>
                    <span className="font-mono text-xs text-slate-400">
                      x {point.x.toFixed(4)} | y {point.y.toFixed(4)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-400">
                        Latitude
                      </span>
                      <input
                        type="text"
                        value={draftInputs[index]?.lat ?? ""}
                        onChange={(event) =>
                          updateDraftInput(index, "lat", event.target.value)
                        }
                        placeholder="24.9087 or 245431.4"
                        className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-400">
                        Longitude
                      </span>
                      <input
                        type="text"
                        value={draftInputs[index]?.lon ?? ""}
                        onChange={(event) =>
                          updateDraftInput(index, "lon", event.target.value)
                        }
                        placeholder="67.1747 or 0671028.8"
                        className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={handleClear}
                disabled={isSaving}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Clear
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !allCoordinatesEntered}
                className="flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Calibration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
