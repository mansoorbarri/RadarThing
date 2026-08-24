"use client";

import {
  TransformWrapper,
  TransformComponent,
  useControls,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import type {
  ChartType,
  AirportChart,
  ChartsByType,
} from "~/types/airportCharts";
import { useAirportCharts } from "~/hooks/useAirportCharts";
import {
  getChartRotation,
  getNextChartRotation,
  getRotatedFrameTransform,
  setChartRotation as persistChartRotation,
} from "~/lib/chartRotation";
import { cn } from "~/lib/utils";
import {
  ALL_RUNWAYS_KEY,
  buildRunwayChartGroups,
  extractChartRunways,
  getAirportChartKey,
} from "~/services/airportChartsService";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Search,
  X,
} from "lucide-react";

interface Props {
  icao: string;
  onClose: () => void;
  onOpenSideView?: () => void;
}

// Cache for transform state (zoom/pan) per chart URL
interface TransformState {
  scale: number;
  positionX: number;
  positionY: number;
}
const transformCache = new Map<string, TransformState>();

function getTransformState(chartUrl: string): TransformState | undefined {
  return transformCache.get(chartUrl);
}

function setTransformState(chartUrl: string, state: TransformState) {
  transformCache.set(chartUrl, state);
}

const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: "TAXI", label: "Ground" },
  { type: "SID", label: "SID" },
  { type: "STAR", label: "STAR" },
  { type: "APPROACH", label: "Approach" },
];

function isPdf(url: string): boolean {
  return url.toLowerCase().endsWith(".pdf");
}

function RunwayFilterBar({
  runwayGroups,
  selectedRunwayKey,
  onSelectRunway,
}: {
  runwayGroups: ReturnType<typeof buildRunwayChartGroups>;
  selectedRunwayKey: string;
  onSelectRunway: (runwayKey: string) => void;
}) {
  if (runwayGroups.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {runwayGroups.map((group) => (
        <button
          key={group.key}
          onClick={() => onSelectRunway(group.key)}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
            selectedRunwayKey === group.key
              ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
              : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200",
          )}
        >
          <span>{group.label}</span>
          <span className="text-[10px] opacity-70">{group.charts.length}</span>
        </button>
      ))}
    </div>
  );
}

function ChartTypeTab({
  type,
  label,
  count,
  isSelected,
  onClick,
}: {
  type: ChartType;
  label: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        isSelected
          ? "bg-white/10 text-white"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
        count === 0 && "opacity-50",
      )}
      disabled={count === 0}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
            isSelected
              ? "bg-blue-500 text-white"
              : "bg-slate-700 text-slate-300",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ChartSidebar({
  charts,
  allCharts,
  selectedType,
  selectedIndex,
  selectedChartKey,
  onChange,
  onSelectChart,
  isCollapsed,
  onToggleCollapse,
}: {
  charts: AirportChart[];
  allCharts: ChartsByType | null;
  selectedType: ChartType;
  selectedIndex: number;
  selectedChartKey: string | null;
  onChange: (index: number) => void;
  onSelectChart: (type: ChartType, chart: AirportChart) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sort charts alphabetically - must be before early return
  const sortedCharts = useMemo(() => {
    return [...charts]
      .map((chart, originalIndex) => ({ chart, originalIndex }))
      .sort((a, b) => a.chart.chartName.localeCompare(b.chart.chartName));
  }, [charts]);

  // Get all charts flattened with their type info for search
  const allChartsFlat = useMemo(() => {
    if (!allCharts) return [];
    const result: {
      chart: AirportChart;
      type: ChartType;
      indexInType: number;
    }[] = [];
    (Object.keys(allCharts) as ChartType[]).forEach((type) => {
      allCharts[type].forEach((chart, index) => {
        result.push({ chart, type, indexInType: index });
      });
    });
    return result.sort((a, b) =>
      a.chart.chartName.localeCompare(b.chart.chartName),
    );
  }, [allCharts]);

  // Filter charts by search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allChartsFlat.filter((item) =>
      item.chart.chartName.toLowerCase().includes(query),
    );
  }, [searchQuery, allChartsFlat]);

  const isSearching = searchQuery.trim().length > 0;
  const totalCharts = allChartsFlat.length;

  if (totalCharts <= 1) return null;

  return (
    <div
      className={cn(
        "flex flex-shrink-0 flex-col overflow-hidden border-r border-white/10 bg-slate-900/50 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-12" : "w-72",
      )}
    >
      {/* Collapsed state - show expand button */}
      <div
        className={cn(
          "flex flex-1 items-end justify-center p-2 transition-opacity duration-200",
          isCollapsed
            ? "opacity-100"
            : "pointer-events-none absolute opacity-0",
        )}
      >
        <button
          onClick={onToggleCollapse}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          title="Show chart list"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded state - show chart list */}
      <div
        className={cn(
          "flex flex-1 flex-col transition-opacity duration-200",
          isCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        {/* Search input */}
        <div className="border-b border-white/10 p-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search all charts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-slate-800/50 py-1.5 pr-8 pl-8 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isSearching ? (
            <>
              <div className="px-2 py-1.5 text-[10px] font-medium tracking-wider whitespace-nowrap text-slate-500 uppercase">
                {searchResults.length} Result
                {searchResults.length !== 1 ? "s" : ""}
              </div>
              <div className="space-y-0.5">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-500">
                    No charts found
                  </div>
                ) : (
                  searchResults.map(({ chart, type, indexInType }) => (
                    <button
                      key={chart.id ?? `${type}-${indexInType}`}
                      onClick={() => {
                        onSelectChart(type, chart);
                        setSearchQuery("");
                      }}
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left text-xs transition-colors",
                        selectedType === type &&
                          selectedChartKey === getAirportChartKey(chart)
                          ? "border border-cyan-500/30 bg-cyan-500/20 text-cyan-300"
                          : "border border-transparent text-slate-300 hover:bg-white/5",
                      )}
                    >
                      <div className="font-medium">{chart.chartName}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        {CHART_TYPES.find((t) => t.type === type)?.label ??
                          type}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="px-2 py-1.5 text-[10px] font-medium tracking-wider whitespace-nowrap text-slate-500 uppercase">
                {charts.length} Charts
              </div>
              <div className="space-y-0.5">
                {sortedCharts.map(({ chart, originalIndex }) => (
                  <button
                    key={chart.id ?? originalIndex}
                    onClick={() => onChange(originalIndex)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-xs transition-colors",
                      selectedIndex === originalIndex
                        ? "border border-cyan-500/30 bg-cyan-500/20 text-cyan-300"
                        : "border border-transparent text-slate-300 hover:bg-white/5",
                    )}
                  >
                    <div className="font-medium">{chart.chartName}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Collapse button at bottom right */}
        <div className="flex justify-end border-t border-white/10 p-2">
          <button
            onClick={onToggleCollapse}
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-slate-800 px-2 text-xs whitespace-nowrap text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            title="Hide chart list"
          >
            <ChevronLeft className="h-3 w-3" />
            <span>Hide</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Reset button component that uses the transform controls
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

// Chart image component with zoom/pan state persistence
function ChartImage({
  chartUrl,
  chartName,
  isInverted,
  rotation,
  onRotate,
}: {
  chartUrl: string;
  chartName: string;
  isInverted: boolean;
  rotation: number;
  onRotate: () => void;
}) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const hasInitialized = useRef(false);
  const cachedState = getTransformState(chartUrl);

  const handleTransformed = useCallback(
    (
      _ref: ReactZoomPanPinchRef,
      state: { scale: number; positionX: number; positionY: number },
    ) => {
      // Only save after initial setup is done
      if (hasInitialized.current) {
        setTransformState(chartUrl, {
          scale: state.scale,
          positionX: state.positionX,
          positionY: state.positionY,
        });
      }
    },
    [chartUrl],
  );

  const handleImageLoad = useCallback(() => {
    // Only center on init if there's no cached state
    if (!cachedState && transformRef.current) {
      transformRef.current.resetTransform();
    }
    hasInitialized.current = true;
  }, [cachedState]);

  const handleReset = useCallback(() => {
    // Clear cached state when user manually resets
    transformCache.delete(chartUrl);
  }, [chartUrl]);

  return (
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
            draggable={false}
            className={cn(
              "max-h-full max-w-full object-contain select-none",
              isInverted && "invert",
            )}
            onLoad={handleImageLoad}
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </TransformComponent>
      </>
    </TransformWrapper>
  );
}

export function AirportChartsViewer({ icao, onClose, onOpenSideView }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfError, setPdfError] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isInverted, setIsInverted] = useState(true);
  const [chartRotation, setChartRotation] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedRunwayKey, setSelectedRunwayKey] =
    useState<string>(ALL_RUNWAYS_KEY);

  const {
    charts,
    loading,
    error,
    selectedType,
    setSelectedType,
    selectedChartIndex,
    setSelectedChartIndex,
    chartCounts,
    totalCharts,
    refetch,
  } = useAirportCharts(icao);

  const runwayGroups = useMemo(
    () => buildRunwayChartGroups(charts?.[selectedType] ?? []),
    [charts, selectedType],
  );
  const activeRunwayGroup = useMemo(
    () =>
      runwayGroups.find((group) => group.key === selectedRunwayKey) ??
      runwayGroups[0] ?? {
        key: ALL_RUNWAYS_KEY,
        label: "All",
        charts: [],
      },
    [runwayGroups, selectedRunwayKey],
  );
  const currentCharts = activeRunwayGroup.charts;
  const selectedChart = currentCharts[selectedChartIndex] ?? null;
  const selectedChartKey = selectedChart
    ? getAirportChartKey(selectedChart)
    : null;

  // Handler for selecting a chart from search (switches type and index)
  const handleSelectChart = useCallback(
    (type: ChartType, chart: AirportChart) => {
      const nextTypeCharts = charts?.[type] ?? [];
      const nextRunwayGroups = buildRunwayChartGroups(nextTypeCharts);
      const preferredRunwayKey =
        extractChartRunways(chart.chartName)[0] ?? ALL_RUNWAYS_KEY;
      const nextRunwayGroup =
        nextRunwayGroups.find((group) => group.key === preferredRunwayKey) ??
        nextRunwayGroups[0];

      if (!nextRunwayGroup) {
        return;
      }

      const nextIndex = nextRunwayGroup.charts.findIndex(
        (candidate) =>
          getAirportChartKey(candidate) === getAirportChartKey(chart),
      );

      if (type !== selectedType) {
        setSelectedRunwayKey(nextRunwayGroup.key);
        setSelectedType(type);
        setTimeout(
          () => setSelectedChartIndex(nextIndex >= 0 ? nextIndex : 0),
          0,
        );
      } else {
        setSelectedRunwayKey(nextRunwayGroup.key);
        setSelectedChartIndex(nextIndex >= 0 ? nextIndex : 0);
      }
    },
    [charts, selectedType, setSelectedType, setSelectedChartIndex],
  );

  useEffect(() => {
    if (runwayGroups.some((group) => group.key === selectedRunwayKey)) {
      return;
    }

    setSelectedRunwayKey(ALL_RUNWAYS_KEY);
    setSelectedChartIndex(0);
  }, [runwayGroups, selectedRunwayKey, setSelectedChartIndex]);

  useEffect(() => {
    if (selectedChartIndex < currentCharts.length) {
      return;
    }

    setSelectedChartIndex(0);
  }, [currentCharts.length, selectedChartIndex, setSelectedChartIndex]);

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
    const container = containerRef.current;
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

  const handleRotateChart = useCallback(() => {
    if (!selectedChart?.chartUrl) return;

    const nextRotation = getNextChartRotation(chartRotation);
    setChartRotation(nextRotation);
    persistChartRotation(selectedChart.chartUrl, nextRotation);
  }, [chartRotation, selectedChart?.chartUrl]);

  const isPdfChart = selectedChart && isPdf(selectedChart.chartUrl);

  return (
    <div
      data-tour="airport-charts-viewer"
      className="animate-fade-in fixed inset-0 z-[10020] bg-black/80 backdrop-blur-sm"
    >
      <div className="animate-scale-in absolute inset-4 flex flex-col rounded-xl bg-slate-950 shadow-2xl">
        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {icao.toUpperCase()} Charts
              </h2>
              <p className="text-[10px] text-slate-400">
                {totalCharts} chart{totalCharts !== 1 ? "s" : ""} available
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onOpenSideView && totalCharts > 0 && (
                <button
                  onClick={() => {
                    onOpenSideView();
                    onClose();
                  }}
                  className="cursor-pointer rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20"
                >
                  Side View
                </button>
              )}
              <button
                onClick={refetch}
                disabled={loading}
                className="cursor-pointer rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
              >
                Close
              </button>
            </div>
          </div>

          {/* Chart type tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {CHART_TYPES.map(({ type, label }) => (
              <ChartTypeTab
                key={type}
                type={type}
                label={label}
                count={chartCounts[type]}
                isSelected={selectedType === type}
                onClick={() => setSelectedType(type)}
              />
            ))}
          </div>

          <RunwayFilterBar
            runwayGroups={runwayGroups}
            selectedRunwayKey={activeRunwayGroup.key}
            onSelectRunway={(runwayKey) => {
              setSelectedRunwayKey(runwayKey);
              setSelectedChartIndex(0);
            }}
          />
        </header>

        {/* Content with optional sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar for multiple charts */}
          <ChartSidebar
            charts={currentCharts}
            allCharts={charts}
            selectedType={selectedType}
            selectedIndex={selectedChartIndex}
            selectedChartKey={selectedChartKey}
            onChange={setSelectedChartIndex}
            onSelectChart={handleSelectChart}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          {/* Main chart area */}
          <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden bg-black"
          >
            {selectedChart && (
              <button
                onClick={() => setIsInverted((prev) => !prev)}
                className={cn(
                  "absolute right-4 bottom-16 z-10 cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors",
                  isInverted
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                    : "border-white/10 bg-slate-900/90 text-slate-300 hover:bg-slate-800",
                )}
              >
                Invert: {isInverted ? "On" : "Off"}
              </button>
            )}
            {loading ? (
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-500" />
                  <span className="text-sm text-slate-400">
                    Loading charts...
                  </span>
                </div>
              </div>
            ) : error ? (
              <div className="flex h-full w-full flex-col items-center justify-center text-center">
                <div className="mb-2 text-sm font-medium text-red-400">
                  Error loading charts
                </div>
                <div className="max-w-sm text-xs text-slate-400">{error}</div>
              </div>
            ) : !selectedChart ? (
              <div className="flex h-full w-full flex-col items-center justify-center text-center">
                <div className="mb-2 text-sm font-medium text-white">
                  No {selectedType.toLowerCase()} charts available
                </div>
                <div className="max-w-sm text-xs text-slate-400">
                  {totalCharts === 0 ? (
                    <>
                      This airport does not currently have any charts. Message{" "}
                      <a
                        href="https://discord.com/users/1203599506730651650"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-cyan-400 underline decoration-cyan-400/30 hover:text-cyan-300"
                      >
                        xyzmani
                      </a>{" "}
                      on Discord to request them!
                    </>
                  ) : (
                    `Try selecting a different chart type above.`
                  )}
                </div>
              </div>
            ) : isPdfChart ? (
              pdfError ? (
                <div className="flex h-full w-full flex-col items-center justify-center text-center">
                  <div className="mb-2 text-sm font-medium text-white">
                    PDF Preview Unavailable
                  </div>
                  <div className="mb-4 max-w-sm text-xs text-slate-400">
                    Your browser may not support embedded PDFs, or the PDF
                    failed to load.
                  </div>
                  <a
                    href={selectedChart.chartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600"
                  >
                    Open PDF in New Tab
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
                    className={cn(
                      "h-full w-full border-0 transition-transform duration-200",
                      isInverted && "invert",
                    )}
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
              <ChartImage
                key={selectedChart.chartUrl}
                chartUrl={selectedChart.chartUrl}
                chartName={selectedChart.chartName}
                isInverted={isInverted}
                rotation={chartRotation}
                onRotate={handleRotateChart}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Legacy export for backward compatibility
export { AirportChartsViewer as TaxiChartViewer };
