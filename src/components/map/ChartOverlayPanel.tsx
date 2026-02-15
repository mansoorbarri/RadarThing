"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { TransformWrapper, TransformComponent, useControls, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { useAirportCharts } from "~/hooks/useAirportCharts";
import type { ChartType, AirportChart } from "~/types/airportCharts";
import type { PositionUpdate } from "~/lib/aircraft-store";
import { computeTransform, projectToChart, isOnChart, type ChartTransform } from "~/lib/chart-calibration";
import { calibrateChart } from "~/app/actions/airport-charts";
import { X, RotateCcw, Crosshair } from "lucide-react";

const CHART_PANEL_WIDTH_KEY = "chart_panel_width";
const DEFAULT_PANEL_WIDTH = 520;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 900;

function getStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_PANEL_WIDTH;
  const stored = localStorage.getItem(CHART_PANEL_WIDTH_KEY);
  if (!stored) return DEFAULT_PANEL_WIDTH;
  const parsed = Number(stored);
  if (isNaN(parsed) || parsed < MIN_PANEL_WIDTH || parsed > MAX_PANEL_WIDTH) return DEFAULT_PANEL_WIDTH;
  return parsed;
}

const CHART_TYPES: { key: ChartType; label: string }[] = [
  { key: "TAXI", label: "TAXI" },
  { key: "SID", label: "SID" },
  { key: "STAR", label: "STAR" },
  { key: "APPROACH", label: "APP" },
  { key: "GENERAL", label: "GEN" },
];

type CalibrationStep = "idle" | "chart-point-1" | "map-point-1" | "chart-point-2" | "map-point-2" | "saving";

const STEP_LABELS: Record<CalibrationStep, string> = {
  idle: "",
  "chart-point-1": "Step 1/4: Click a reference point on the chart",
  "map-point-1": "Step 2/4: Click the same point on the map",
  "chart-point-2": "Step 3/4: Click a second reference point on the chart",
  "map-point-2": "Step 4/4: Click the same point on the map",
  saving: "Saving calibration...",
};

// Cache for transform state (zoom/pan) per chart URL
interface TransformState {
  scale: number;
  positionX: number;
  positionY: number;
}
const transformCache = new Map<string, TransformState>();

function ResetButton({ onReset }: { onReset?: () => void }) {
  const { resetTransform } = useControls();
  return (
    <button
      onClick={() => {
        resetTransform();
        onReset?.();
      }}
      className="absolute bottom-4 right-4 z-10 flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-sm hover:bg-slate-800"
    >
      <RotateCcw className="h-3 w-3" />
      Reset
    </button>
  );
}

interface ProjectedAircraft {
  id: string;
  callsign: string;
  fracX: number;
  fracY: number;
  heading: number;
  alt: number;
  speed: number;
}

function AircraftDot({ aircraft, scale }: { aircraft: ProjectedAircraft; scale: number }) {
  const isGround = aircraft.alt < 500;
  const color = isGround ? "#22c55e" : "#22d3ee";
  const counterScale = 1 / scale;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${aircraft.fracX * 100}%`,
        top: `${aircraft.fracY * 100}%`,
        transform: `translate(-50%, -50%) scale(${counterScale})`,
        zIndex: 10,
      }}
    >
      {/* Dot */}
      <div
        className="rounded-full"
        style={{
          width: 8,
          height: 8,
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      {/* Heading line */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          width: 1.5,
          height: 12,
          backgroundColor: color,
          transformOrigin: "bottom center",
          bottom: "50%",
          transform: `translateX(-50%) rotate(${aircraft.heading}deg)`,
          opacity: 0.7,
        }}
      />
      {/* Callsign label */}
      <div
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] font-bold"
        style={{
          top: 12,
          color,
          textShadow: "0 0 4px rgba(0,0,0,0.8)",
        }}
      >
        {aircraft.callsign}
      </div>
    </div>
  );
}

function ZoomableChartImage({
  chartUrl,
  chartName,
  chart,
  aircrafts,
  icao,
  calibrationStep,
  onChartClick,
}: {
  chartUrl: string;
  chartName: string;
  chart: AirportChart;
  aircrafts: PositionUpdate[];
  icao: string;
  calibrationStep: CalibrationStep;
  onChartClick: (fracX: number, fracY: number) => void;
}) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const hasInitialized = useRef(false);
  const cachedState = transformCache.get(chartUrl);
  const [currentScale, setCurrentScale] = useState(cachedState?.scale ?? 1);

  const handleTransformed = useCallback(
    (_ref: ReactZoomPanPinchRef, state: { scale: number; positionX: number; positionY: number }) => {
      if (hasInitialized.current) {
        transformCache.set(chartUrl, {
          scale: state.scale,
          positionX: state.positionX,
          positionY: state.positionY,
        });
        setCurrentScale(state.scale);
      }
    },
    [chartUrl],
  );

  const handleImageLoad = useCallback(() => {
    if (!cachedState && transformRef.current) {
      transformRef.current.resetTransform();
    }
    hasInitialized.current = true;
  }, [cachedState]);

  const handleReset = useCallback(() => {
    transformCache.delete(chartUrl);
  }, [chartUrl]);

  // Compute transform from calibration
  const transform = useMemo<ChartTransform | null>(() => {
    if (!chart.calibration) return null;
    return computeTransform(chart.calibration);
  }, [chart.calibration]);

  // Project aircraft positions
  const projectedAircraft = useMemo(() => {
    if (!transform) return [];
    const isTaxi = chart.chartType === "TAXI";

    return aircrafts
      .filter((ac) => {
        // Only aircraft related to this airport
        const dep = ac.departure?.toUpperCase();
        const arr = ac.arrival?.toUpperCase();
        const upperIcao = icao.toUpperCase();
        if (dep !== upperIcao && arr !== upperIcao) return false;
        // TAXI charts: ground traffic only
        if (isTaxi && ac.alt > 500) return false;
        return true;
      })
      .map((ac) => {
        const [fracX, fracY] = projectToChart(ac.lat, ac.lon, transform);
        if (!isOnChart(fracX, fracY)) return null;
        return {
          id: ac.id,
          callsign: ac.callsign || ac.flightNo || "???",
          fracX,
          fracY,
          heading: ac.heading,
          alt: ac.alt,
          speed: ac.speed,
        };
      })
      .filter((x): x is ProjectedAircraft => x !== null);
  }, [aircrafts, transform, chart.chartType, icao]);

  const needsChartClick = calibrationStep === "chart-point-1" || calibrationStep === "chart-point-2";
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (needsChartClick) {
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
    }
  }, [needsChartClick]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!needsChartClick || !mouseDownPos.current || !imgRef.current) return;
    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    mouseDownPos.current = null;
    // Only treat as click if mouse moved < 5px (not a drag/pan)
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;
    const rect = imgRef.current.getBoundingClientRect();
    const fracX = (e.clientX - rect.left) / rect.width;
    const fracY = (e.clientY - rect.top) / rect.height;
    onChartClick(fracX, fracY);
  }, [needsChartClick, onChartClick]);

  return (
    <div
      className="relative h-full w-full"
      style={needsChartClick ? { cursor: "crosshair" } : undefined}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <TransformWrapper
        ref={transformRef}
        minScale={0.5}
        maxScale={Infinity}
        centerOnInit={!cachedState}
        limitToBounds={false}
        initialScale={cachedState?.scale ?? 1}
        initialPositionX={cachedState?.positionX ?? 0}
        initialPositionY={cachedState?.positionY ?? 0}
        onTransformed={handleTransformed}
      >
        <>
          <ResetButton onReset={handleReset} />
          <TransformComponent
            wrapperClass="!w-full !h-full"
            contentClass="flex h-full w-full items-center justify-center"
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={chartUrl}
                alt={chartName}
                className="object-contain select-none invert"
                onLoad={handleImageLoad}
              />
              {/* Aircraft overlay - NOT inverted */}
              {projectedAircraft.length > 0 && (
                <div className="absolute inset-0" style={{ filter: "invert(1)" }}>
                  {projectedAircraft.map((ac) => (
                    <AircraftDot key={ac.id} aircraft={ac} scale={currentScale} />
                  ))}
                </div>
              )}
            </div>
          </TransformComponent>
        </>
      </TransformWrapper>
    </div>
  );
}

interface ChartSidePanelProps {
  icao: string;
  onClose: () => void;
  aircrafts?: PositionUpdate[];
  calibrationClickRef?: React.MutableRefObject<((latlng: { lat: number; lng: number }) => void) | null>;
}

export function ChartSidePanel({ icao, onClose, aircrafts = [], calibrationClickRef }: ChartSidePanelProps) {
  const { charts, loading, refetch } = useAirportCharts(icao);
  const [pdfError, setPdfError] = useState(false);

  // Resizable width
  const [panelWidth, setPanelWidth] = useState(getStoredWidth);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - e.clientX;
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Persist on release
      setPanelWidth((w) => {
        localStorage.setItem(CHART_PANEL_WIDTH_KEY, String(w));
        return w;
      });
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [panelWidth]);

  const [selectedType, setSelectedType] = useState<ChartType>("TAXI");
  const [selectedChartIndex, setSelectedChartIndex] = useState(0);

  // Calibration state
  const [calibrationStep, setCalibrationStep] = useState<CalibrationStep>("idle");
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const [chartPoint1, setChartPoint1] = useState<{ x: number; y: number } | null>(null);
  const [mapPoint1, setMapPoint1] = useState<{ lat: number; lng: number } | null>(null);
  const [chartPoint2, setChartPoint2] = useState<{ x: number; y: number } | null>(null);

  const chartsByType = useMemo(() => {
    if (!charts) return null;
    return {
      TAXI: charts.TAXI,
      SID: charts.SID,
      STAR: charts.STAR,
      APPROACH: charts.APPROACH,
      GENERAL: charts.GENERAL,
    };
  }, [charts]);

  const currentCharts = chartsByType?.[selectedType] ?? [];
  const selectedChart = currentCharts[selectedChartIndex] ?? null;
  const isPdf = selectedChart?.chartUrl.toLowerCase().endsWith(".pdf");

  const availableTabs = useMemo(() => {
    if (!chartsByType) return [];
    return CHART_TYPES.filter((t) => chartsByType[t.key].length > 0);
  }, [chartsByType]);

  // Auto-select first available tab if current has no charts
  useEffect(() => {
    if (!chartsByType) return;
    if (chartsByType[selectedType].length === 0 && availableTabs.length > 0) {
      setSelectedType(availableTabs[0]!.key);
      setSelectedChartIndex(0);
    }
  }, [chartsByType, selectedType, availableTabs]);

  // Reset PDF error and calibration when chart changes
  useEffect(() => {
    setPdfError(false);
    cancelCalibration();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChart?.chartUrl]);

  // Register/unregister map click handler for calibration
  useEffect(() => {
    if (!calibrationClickRef) return;

    if (calibrationStep === "map-point-1" || calibrationStep === "map-point-2") {
      calibrationClickRef.current = (latlng) => {
        if (calibrationStep === "map-point-1") {
          setMapPoint1(latlng);
          setCalibrationStep("chart-point-2");
        } else if (calibrationStep === "map-point-2") {
          handleMapPoint2(latlng);
        }
      };
    } else {
      calibrationClickRef.current = null;
    }

    return () => {
      calibrationClickRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibrationStep, calibrationClickRef]);

  const handleTypeChange = (type: ChartType) => {
    setSelectedType(type);
    setSelectedChartIndex(0);
  };

  const startCalibration = () => {
    setCalibrationStep("chart-point-1");
    setCalibrationError(null);
    setChartPoint1(null);
    setMapPoint1(null);
    setChartPoint2(null);
  };

  const cancelCalibration = () => {
    setCalibrationStep("idle");
    setCalibrationError(null);
    setChartPoint1(null);
    setMapPoint1(null);
    setChartPoint2(null);
    if (calibrationClickRef) {
      calibrationClickRef.current = null;
    }
  };

  const handleChartClick = useCallback(
    (fracX: number, fracY: number) => {
      if (calibrationStep === "chart-point-1") {
        setChartPoint1({ x: fracX, y: fracY });
        setCalibrationStep("map-point-1");
      } else if (calibrationStep === "chart-point-2") {
        setChartPoint2({ x: fracX, y: fracY });
        setCalibrationStep("map-point-2");
      }
    },
    [calibrationStep],
  );

  const handleMapPoint2 = async (latlng: { lat: number; lng: number }) => {
    if (!selectedChart?.id || !chartPoint1 || !mapPoint1 || !chartPoint2) return;

    setCalibrationStep("saving");

    const result = await calibrateChart(selectedChart.id, {
      p1PixelX: chartPoint1.x,
      p1PixelY: chartPoint1.y,
      p1Lat: mapPoint1.lat,
      p1Lon: mapPoint1.lng,
      p2PixelX: chartPoint2.x,
      p2PixelY: chartPoint2.y,
      p2Lat: latlng.lat,
      p2Lon: latlng.lng,
    });

    if (result.success) {
      setCalibrationStep("idle");
      setCalibrationError(null);
      refetch();
    } else {
      setCalibrationError(result.error ?? "Calibration failed");
      setCalibrationStep("idle");
    }

    setChartPoint1(null);
    setMapPoint1(null);
    setChartPoint2(null);
  };

  const hasCharts = availableTabs.length > 0;
  const isCalibrated = !!selectedChart?.calibration;
  const isCalibrating = calibrationStep !== "idle";

  return (
    <aside
      className="fixed inset-y-0 right-0 z-[10012] flex flex-col border-l border-white/10 bg-black/90 backdrop-blur-xl"
      style={{ width: panelWidth }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize transition-colors hover:bg-cyan-500/30"
      />
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Charts</span>
          <span className="font-mono text-xs text-cyan-400">{icao}</span>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-500" />
            <span className="text-xs text-white/40">Loading charts...</span>
          </div>
        </div>
      ) : !hasCharts ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-xs text-white/40">No charts available</span>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="shrink-0 border-b border-white/10 px-4 py-3">
            {/* Chart type tabs */}
            <div className="mb-2 flex gap-1">
              {availableTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTypeChange(tab.key)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    selectedType === tab.key
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  {tab.label}
                  <span className="ml-1 text-[9px] opacity-60">
                    {chartsByType?.[tab.key].length}
                  </span>
                </button>
              ))}
            </div>

            {/* Chart selector */}
            {currentCharts.length > 1 && (
              <select
                value={selectedChartIndex}
                onChange={(e) => setSelectedChartIndex(Number(e.target.value))}
                className="w-full cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 outline-none focus:border-cyan-500/30"
              >
                {currentCharts.map((chart, i) => (
                  <option key={i} value={i} className="bg-[#0a1219]">
                    {chart.chartName}
                  </option>
                ))}
              </select>
            )}

            {currentCharts.length === 1 && (
              <div className="truncate text-[11px] text-white/50">
                {currentCharts[0]!.chartName}
              </div>
            )}

            {/* Calibration bar */}
            {selectedChart && !isPdf && (
              <div className="mt-2 flex items-center gap-2">
                {isCalibrating ? (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Crosshair className="h-3 w-3 shrink-0 animate-pulse text-amber-400" />
                      <span className="truncate text-[10px] text-amber-300">
                        {STEP_LABELS[calibrationStep]}
                      </span>
                    </div>
                    <button
                      onClick={cancelCalibration}
                      className="shrink-0 cursor-pointer rounded px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/10"
                    >
                      Cancel
                    </button>
                  </>
                ) : isCalibrated ? (
                  <>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                      CALIBRATED
                    </span>
                    <button
                      onClick={startCalibration}
                      className="cursor-pointer text-[10px] text-white/40 hover:text-white/70"
                    >
                      Recalibrate
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startCalibration}
                    className="flex cursor-pointer items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 transition-colors hover:bg-amber-500/20"
                  >
                    <Crosshair className="h-3 w-3" />
                    Calibrate
                  </button>
                )}
              </div>
            )}

            {/* Calibration error */}
            {calibrationError && (
              <div className="mt-1 text-[10px] text-red-400">
                {calibrationError}
              </div>
            )}
          </div>

          {/* Chart content */}
          <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
            {!selectedChart ? (
              <div className="flex h-full items-center justify-center">
                <span className="text-xs text-white/40">Select a chart</span>
              </div>
            ) : isPdf ? (
              pdfError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
                  <span className="text-xs text-white/40">PDF preview unavailable</span>
                  <a
                    href={selectedChart.chartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] text-cyan-300 transition-colors hover:bg-cyan-500/20"
                  >
                    Open PDF in new tab
                  </a>
                </div>
              ) : (
                <iframe
                  src={selectedChart.chartUrl}
                  className="h-full w-full border-0 invert"
                  title={selectedChart.chartName}
                  onError={() => setPdfError(true)}
                />
              )
            ) : (
              <ZoomableChartImage
                key={selectedChart.chartUrl}
                chartUrl={selectedChart.chartUrl}
                chartName={selectedChart.chartName}
                chart={selectedChart}
                aircrafts={aircrafts}
                icao={icao}
                calibrationStep={calibrationStep}
                onChartClick={handleChartClick}
              />
            )}
          </div>
        </>
      )}
    </aside>
  );
}
