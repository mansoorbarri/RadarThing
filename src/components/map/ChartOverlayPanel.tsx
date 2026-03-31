"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { useAirportCharts } from "~/hooks/useAirportCharts";
import {
  getChartRotation,
  getNextChartRotation,
  getRotatedFrameTransform,
  setChartRotation as persistChartRotation,
} from "~/lib/chartRotation";
import type { ChartType } from "~/types/airportCharts";
import { X, RotateCcw, RotateCw } from "lucide-react";

const CHART_PANEL_WIDTH_KEY = "chart_panel_width";
const DEFAULT_PANEL_WIDTH = 520;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 900;

function getStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_PANEL_WIDTH;
  const stored = localStorage.getItem(CHART_PANEL_WIDTH_KEY);
  if (!stored) return DEFAULT_PANEL_WIDTH;
  const parsed = Number(stored);
  if (isNaN(parsed) || parsed < MIN_PANEL_WIDTH || parsed > MAX_PANEL_WIDTH)
    return DEFAULT_PANEL_WIDTH;
  return parsed;
}

const CHART_TYPES: { key: ChartType; label: string }[] = [
  { key: "TAXI", label: "TAXI" },
  { key: "SID", label: "SID" },
  { key: "STAR", label: "STAR" },
  { key: "APPROACH", label: "APP" },
];

// Cache for transform state (zoom/pan) per chart URL
interface TransformState {
  scale: number;
  positionX: number;
  positionY: number;
}
const transformCache = new Map<string, TransformState>();

function ChartControls({
  onReset,
  onRotate,
}: {
  onReset?: () => void;
  onRotate?: () => void;
}) {
  const { resetTransform } = useControls();
  return (
    <div className="absolute right-4 bottom-4 z-10 flex items-center gap-2">
      <button
        onClick={onRotate}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-sm hover:bg-slate-800"
      >
        <RotateCw className="h-3 w-3" />
        Rotate
      </button>
      <button
        onClick={() => {
          resetTransform();
          onReset?.();
        }}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-sm hover:bg-slate-800"
      >
        <RotateCcw className="h-3 w-3" />
        Reset
      </button>
    </div>
  );
}

function ZoomableChartImage({
  chartUrl,
  chartName,
  rotation,
  onRotate,
}: {
  chartUrl: string;
  chartName: string;
  rotation: number;
  onRotate: () => void;
}) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const hasInitialized = useRef(false);
  const cachedState = transformCache.get(chartUrl);

  const handleTransformed = useCallback(
    (
      _ref: ReactZoomPanPinchRef,
      state: { scale: number; positionX: number; positionY: number },
    ) => {
      if (hasInitialized.current) {
        transformCache.set(chartUrl, {
          scale: state.scale,
          positionX: state.positionX,
          positionY: state.positionY,
        });
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

  return (
    <div className="relative h-full w-full">
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
          <ChartControls onReset={handleReset} onRotate={onRotate} />
          <TransformComponent
            wrapperClass="!w-full !h-full"
            contentClass="flex h-full w-full items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={chartUrl}
              alt={chartName}
              className="max-h-full max-w-full object-contain invert select-none"
              onLoad={handleImageLoad}
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </TransformComponent>
        </>
      </TransformWrapper>
    </div>
  );
}

interface ChartSidePanelProps {
  icao: string;
  onClose: () => void;
}

export function ChartSidePanel({ icao, onClose }: ChartSidePanelProps) {
  const { charts, loading } = useAirportCharts(icao);
  const [pdfError, setPdfError] = useState(false);
  const [chartRotation, setChartRotation] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Resizable width
  const [panelWidth, setPanelWidth] = useState(getStoredWidth);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      const startX = e.clientX;
      const startWidth = panelWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = startX - e.clientX;
        const newWidth = Math.min(
          MAX_PANEL_WIDTH,
          Math.max(MIN_PANEL_WIDTH, startWidth + delta),
        );
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
    },
    [panelWidth],
  );

  const [selectedType, setSelectedType] = useState<ChartType>("TAXI");
  const [selectedChartIndex, setSelectedChartIndex] = useState(0);

  const chartsByType = useMemo(() => {
    if (!charts) return null;
    return {
      TAXI: charts.TAXI,
      SID: charts.SID,
      STAR: charts.STAR,
      APPROACH: charts.APPROACH,
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

  // Reset PDF error when chart changes
  useEffect(() => {
    setPdfError(false);
  }, [selectedChart?.chartUrl]);

  useEffect(() => {
    if (!selectedChart?.chartUrl) {
      setChartRotation(0);
      return;
    }

    setChartRotation(getChartRotation(selectedChart.chartUrl));
  }, [selectedChart?.chartUrl]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const handleTypeChange = (type: ChartType) => {
    setSelectedType(type);
    setSelectedChartIndex(0);
  };

  const hasCharts = availableTabs.length > 0;

  const handleRotateChart = useCallback(() => {
    if (!selectedChart?.chartUrl) return;

    const nextRotation = getNextChartRotation(chartRotation);
    setChartRotation(nextRotation);
    persistChartRotation(selectedChart.chartUrl, nextRotation);
  }, [chartRotation, selectedChart?.chartUrl]);

  return (
    <aside
      className="animate-slide-in-right fixed inset-y-0 right-0 z-[10012] flex flex-col border-l border-white/10 bg-black/90 backdrop-blur-xl"
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
        <div className="flex flex-1 items-center justify-center px-4">
          <span className="text-center text-xs text-white/40">
            No charts available. Message{" "}
            <a
              href="https://discord.com/users/1203599506730651650"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-cyan-400 underline decoration-cyan-400/30 hover:text-cyan-300"
            >
              xyzmani
            </a>{" "}
            on Discord to request them!
          </span>
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
          </div>

          {/* Chart content */}
          <div
            ref={chartContainerRef}
            className="relative min-h-0 flex-1 overflow-hidden bg-black"
          >
            {!selectedChart ? (
              <div className="flex h-full items-center justify-center">
                <span className="text-xs text-white/40">Select a chart</span>
              </div>
            ) : isPdf ? (
              pdfError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
                  <span className="text-xs text-white/40">
                    PDF preview unavailable
                  </span>
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
                <>
                  <div className="absolute right-4 bottom-4 z-10">
                    <button
                      onClick={handleRotateChart}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-sm hover:bg-slate-800"
                    >
                      <RotateCw className="h-3 w-3" />
                      Rotate
                    </button>
                  </div>
                  <iframe
                    src={selectedChart.chartUrl}
                    className="h-full w-full border-0 invert transition-transform duration-200"
                    title={selectedChart.chartName}
                    onError={() => setPdfError(true)}
                    style={{
                      transform: getRotatedFrameTransform(
                        chartRotation,
                        containerSize.width,
                        containerSize.height,
                      ),
                      transformOrigin: "center center",
                    }}
                  />
                </>
              )
            ) : (
              <ZoomableChartImage
                key={selectedChart.chartUrl}
                chartUrl={selectedChart.chartUrl}
                chartName={selectedChart.chartName}
                rotation={chartRotation}
                onRotate={handleRotateChart}
              />
            )}
          </div>
        </>
      )}
    </aside>
  );
}
