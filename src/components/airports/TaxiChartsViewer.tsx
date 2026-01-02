import { type AirportChart } from "~/types/airportCharts";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useEffect, useRef } from "react";
import Image from "next/image";

interface Props {
  chart: AirportChart;
  onClose: () => void;
}

export function TaxiChartViewer({ chart, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="fixed inset-0 z-[10020] bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-4 flex flex-col rounded-xl bg-slate-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">{chart.name}</h2>
            <p className="text-[10px] text-slate-400 uppercase">Taxi Diagram</p>
          </div>

          <div className="flex gap-2">
            {chart.info_url && (
              <a
                href={chart.info_url}
                target="_blank"
                className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                Info
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
            >
              Close
            </button>
          </div>
        </header>

        <div ref={containerRef} className="relative flex-1 overflow-hidden">
          <TransformWrapper
            minScale={0.5}
            maxScale={6}
            centerOnInit
            limitToBounds={false}
            initialScale={1}
          >
            {({ resetTransform }) => (
              <>
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="flex h-full w-full items-center justify-center"
                >
                  <Image
                    src={chart.taxi_chart_url}
                    alt={`Taxi chart for ${chart.name}`}
                    fill
                    sizes="100vw"
                    className="object-contain select-none"
                    unoptimized
                    onLoad={() => {
                      resetTransform();
                    }}
                  />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>
      </div>
    </div>
  );
}
