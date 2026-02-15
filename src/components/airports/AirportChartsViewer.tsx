"use client";

import { TransformWrapper, TransformComponent, useControls, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import type { ChartType, AirportChart, ChartsByType } from "~/types/airportCharts";
import { useAirportCharts } from "~/hooks/useAirportCharts";
import { cn } from "~/lib/utils";
import { ChevronLeft, ChevronRight, RotateCcw, Search, X } from "lucide-react";

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
  { type: "GENERAL", label: "General" },
  { type: "TAXI", label: "Ground" },
  { type: "SID", label: "SID" },
  { type: "STAR", label: "STAR" },
  { type: "APPROACH", label: "Approach" },
];

function isPdf(url: string): boolean {
  return url.toLowerCase().endsWith(".pdf");
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
        "relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors rounded-md",
        isSelected
          ? "bg-white/10 text-white"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
        count === 0 && "opacity-50"
      )}
      disabled={count === 0}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
            isSelected ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-300"
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
  onChange,
  onSelectChart,
  isCollapsed,
  onToggleCollapse,
}: {
  charts: AirportChart[];
  allCharts: ChartsByType | null;
  selectedType: ChartType;
  selectedIndex: number;
  onChange: (index: number) => void;
  onSelectChart: (type: ChartType, index: number) => void;
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
    const result: { chart: AirportChart; type: ChartType; indexInType: number }[] = [];
    (Object.keys(allCharts) as ChartType[]).forEach((type) => {
      allCharts[type].forEach((chart, index) => {
        result.push({ chart, type, indexInType: index });
      });
    });
    return result.sort((a, b) => a.chart.chartName.localeCompare(b.chart.chartName));
  }, [allCharts]);

  // Filter charts by search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allChartsFlat.filter((item) =>
      item.chart.chartName.toLowerCase().includes(query)
    );
  }, [searchQuery, allChartsFlat]);

  const isSearching = searchQuery.trim().length > 0;
  const totalCharts = allChartsFlat.length;

  if (totalCharts <= 1) return null;

  return (
    <div
      className={cn(
        "flex-shrink-0 border-r border-white/10 bg-slate-900/50 flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
        isCollapsed ? "w-12" : "w-72"
      )}
    >
      {/* Collapsed state - show expand button */}
      <div
        className={cn(
          "flex items-end justify-center flex-1 p-2 transition-opacity duration-200",
          isCollapsed ? "opacity-100" : "opacity-0 pointer-events-none absolute"
        )}
      >
        <button
          onClick={onToggleCollapse}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          title="Show chart list"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded state - show chart list */}
      <div
        className={cn(
          "flex flex-col flex-1 transition-opacity duration-200",
          isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {/* Search input */}
        <div className="p-2 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search all charts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-white/10 rounded-md pl-8 pr-8 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isSearching ? (
            <>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider px-2 py-1.5 whitespace-nowrap">
                {searchResults.length} Result{searchResults.length !== 1 ? "s" : ""}
              </div>
              <div className="space-y-0.5">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-500 text-center">
                    No charts found
                  </div>
                ) : (
                  searchResults.map(({ chart, type, indexInType }) => (
                    <button
                      key={chart.id ?? `${type}-${indexInType}`}
                      onClick={() => {
                        onSelectChart(type, indexInType);
                        setSearchQuery("");
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-xs transition-colors",
                        selectedType === type && selectedIndex === indexInType
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : "text-slate-300 hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <div className="font-medium">{chart.chartName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {CHART_TYPES.find((t) => t.type === type)?.label ?? type}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider px-2 py-1.5 whitespace-nowrap">
                {charts.length} Charts
              </div>
              <div className="space-y-0.5">
                {sortedCharts.map(({ chart, originalIndex }) => (
                  <button
                    key={chart.id ?? originalIndex}
                    onClick={() => onChange(originalIndex)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-xs transition-colors",
                      selectedIndex === originalIndex
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "text-slate-300 hover:bg-white/5 border border-transparent"
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
        <div className="flex justify-end p-2 border-t border-white/10">
          <button
            onClick={onToggleCollapse}
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-slate-800 px-2 text-xs text-slate-400 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap"
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

// Chart image component with zoom/pan state persistence
function ChartImage({ chartUrl, chartName }: { chartUrl: string; chartName: string }) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const hasInitialized = useRef(false);
  const cachedState = getTransformState(chartUrl);

  const handleTransformed = useCallback(
    (_ref: ReactZoomPanPinchRef, state: { scale: number; positionX: number; positionY: number }) => {
      // Only save after initial setup is done
      if (hasInitialized.current) {
        setTransformState(chartUrl, {
          scale: state.scale,
          positionX: state.positionX,
          positionY: state.positionY,
        });
      }
    },
    [chartUrl]
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
        <ResetButton onReset={handleReset} />
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="flex h-full w-full items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={chartUrl}
            alt={chartName}
            className="object-contain select-none invert"
            onLoad={handleImageLoad}
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

  const {
    charts,
    loading,
    error,
    selectedType,
    setSelectedType,
    selectedChartIndex,
    setSelectedChartIndex,
    currentCharts,
    selectedChart,
    chartCounts,
    totalCharts,
    refetch,
  } = useAirportCharts(icao);

  // Handler for selecting a chart from search (switches type and index)
  const handleSelectChart = useCallback((type: ChartType, index: number) => {
    if (type !== selectedType) {
      // We need to set both type and index, but setSelectedType resets index to 0
      // So we set the type first, then manually set the index
      setSelectedType(type);
      // Small delay to ensure type is set before index
      setTimeout(() => setSelectedChartIndex(index), 0);
    } else {
      setSelectedChartIndex(index);
    }
  }, [selectedType, setSelectedType, setSelectedChartIndex]);

  // Reset PDF error when chart changes
  useEffect(() => {
    setPdfError(false);
  }, [selectedChart?.chartUrl]);

  const isPdfChart = selectedChart && isPdf(selectedChart.chartUrl);

  return (
    <div className="fixed inset-0 z-[10020] bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-4 flex flex-col rounded-xl bg-slate-950 shadow-2xl">
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
        </header>

        {/* Content with optional sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar for multiple charts */}
          <ChartSidebar
            charts={currentCharts}
            allCharts={charts}
            selectedType={selectedType}
            selectedIndex={selectedChartIndex}
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
            {loading ? (
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-500" />
                  <span className="text-sm text-slate-400">Loading charts...</span>
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
                  {totalCharts === 0
                    ? `This airport does not currently have any charts in RadarThing.`
                    : `Try selecting a different chart type above.`}
                </div>
              </div>
            ) : isPdfChart ? (
              pdfError ? (
                <div className="flex h-full w-full flex-col items-center justify-center text-center">
                  <div className="mb-2 text-sm font-medium text-white">
                    PDF Preview Unavailable
                  </div>
                  <div className="max-w-sm text-xs text-slate-400 mb-4">
                    Your browser may not support embedded PDFs, or the PDF failed to load.
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
                <iframe
                  src={selectedChart.chartUrl}
                  className="h-full w-full border-0 invert"
                  title={selectedChart.chartName}
                  onError={() => setPdfError(true)}
                />
              )
            ) : (
              <ChartImage
                key={selectedChart.chartUrl}
                chartUrl={selectedChart.chartUrl}
                chartName={selectedChart.chartName}
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
