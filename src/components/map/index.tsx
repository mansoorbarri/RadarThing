import React, { useEffect, useState, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type PositionUpdate } from "~/lib/aircraft-store";

import { useMapInitialization } from "./useMapInitialization";
import { useFlightPlanDrawing } from "./useFlightPlanDrawing";
import { useMapLayersAndMarkers } from "./useMapLayersAndMarkers";
import { useSelectedAirportHandling } from "./useSelectedAirportHandling";
import { useHeadingModeInteraction } from "./useHeadingModeInteraction";
import {
  HeadingModeControl,
  RadarModeControl,
  OpenAIPControl,
} from "./MapControls";

export interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
  frequencies?: { type: string; frequency: string }[];
}

interface MapComponentProps {
  aircrafts: PositionUpdate[];
  airports: Airport[];
  onAircraftSelect: (aircraft: PositionUpdate | null) => void;
  selectedWaypointIndex?: number | null;
  selectedAirport?: Airport | undefined;
  setDrawFlightPlanOnMap: (
    func: (aircraft: PositionUpdate, shouldZoom?: boolean) => void,
  ) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  aircrafts,
  airports,
  onAircraftSelect,
  selectedAirport,
  setDrawFlightPlanOnMap,
}) => {
  const [isHeadingMode, setIsHeadingMode] = useState<boolean>(false);
  const [isRadarMode, setIsRadarMode] = useState<boolean>(false);
  const [isOpenAIPEnabled, setIsOpenAIPEnabled] = useState<boolean>(false);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(
    null,
  );

  const headingControlRef = useRef<HeadingModeControl | null>(null);
  const radarControlRef = useRef<RadarModeControl | null>(null);
  const openAIPControlRef = useRef<OpenAIPControl | null>(null);

  const mapRefs = useMapInitialization({
    mapContainerId: "map-container",
    setIsHeadingMode,
    setIsRadarMode,
    setIsOpenAIPEnabled,
    onMapClick: (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement;
      if (
        !target.closest(".leaflet-marker-icon") &&
        !target.closest(".leaflet-popup-pane") &&
        !target.closest(".leaflet-control") &&
        mapRefs.flightPlanLayerGroup.current &&
        mapRefs.historyLayerGroup.current
      ) {
        mapRefs.flightPlanLayerGroup.current.clearLayers();
        mapRefs.historyLayerGroup.current.clearLayers();
      }
    },
    setHeadingControlRef: headingControlRef,
    setRadarControlRef: radarControlRef,
    setOpenAIPControlRef: openAIPControlRef,
  });

  const { drawFlightPlan, currentSelectedAircraftRef } = useFlightPlanDrawing({
    mapInstance: mapRefs.mapInstance,
    flightPlanLayerGroup: mapRefs.flightPlanLayerGroup,
    historyLayerGroup: mapRefs.historyLayerGroup,
    isRadarMode,
    onAircraftSelect,
    setSelectedAircraftId,
  });

  const stableOnMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement;
      if (
        !target.closest(".leaflet-marker-icon") &&
        !target.closest(".leaflet-popup-pane") &&
        !target.closest(".leaflet-control") &&
        mapRefs.flightPlanLayerGroup.current &&
        mapRefs.historyLayerGroup.current
      ) {
        mapRefs.flightPlanLayerGroup.current.clearLayers();
        mapRefs.historyLayerGroup.current.clearLayers();
        currentSelectedAircraftRef.current = null;
        setSelectedAircraftId(null);
        onAircraftSelect(null);
      }
    },
    [
      onAircraftSelect,
      mapRefs,
      currentSelectedAircraftRef,
      setSelectedAircraftId,
    ],
  );

  useEffect(() => {
    if (mapRefs.mapInstance.current) {
      mapRefs.mapInstance.current.off("click");
      mapRefs.mapInstance.current.on("click", stableOnMapClick);
    }
    return () => {
      if (mapRefs.mapInstance.current) {
        mapRefs.mapInstance.current.off("click", stableOnMapClick);
      }
    };
  }, [mapRefs.mapInstance, stableOnMapClick]);

  useMapLayersAndMarkers({
    mapInstance: mapRefs.mapInstance,
    aircraftMarkersLayer: mapRefs.aircraftMarkersLayer,
    airportMarkersLayer: mapRefs.airportMarkersLayer,
    satelliteHybridLayer: mapRefs.satelliteHybridLayer,
    radarBaseLayer: mapRefs.radarBaseLayer,
    openAIPLayer: mapRefs.openAIPLayer,
    aircrafts,
    airports,
    isRadarMode,
    isOpenAIPEnabled,
    selectedAircraftId,
    currentSelectedAircraftRef,
    drawFlightPlan,
    onAircraftSelect,
  });

  useSelectedAirportHandling({
    mapInstance: mapRefs.mapInstance,
    selectedAirport,
    isRadarMode,
  });

  useHeadingModeInteraction({
    mapInstance: mapRefs.mapInstance,
    isHeadingMode,
    isRadarMode,
  });

  useEffect(() => {
    if (headingControlRef.current) {
      headingControlRef.current.updateState(isHeadingMode);
    }
    if (radarControlRef.current) {
      radarControlRef.current.updateState(isRadarMode);
    }
    if (openAIPControlRef.current) {
      openAIPControlRef.current.updateState(isOpenAIPEnabled);
    }
  }, [isHeadingMode, isRadarMode, isOpenAIPEnabled]);

  useEffect(() => {
    setDrawFlightPlanOnMap(drawFlightPlan);
  }, [drawFlightPlan, setDrawFlightPlanOnMap]);

  return (
    <>
      <style jsx global>{`
        .heading-tooltip {
          background-color: rgba(0, 0, 0, 0.7) !important;
          color: white !important;
          border: none !important;
          border-radius: 4px !important;
          padding: 8px !important;
          font-size: 12px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
          pointer-events: none !important;
        }
        .heading-tooltip::before {
          display: none !important;
        }

        .leaflet-popup-content-wrapper {
          background-color: rgba(0, 0, 0, 0.9) !important;
          color: #00ffff !important;
          border-radius: 8px !important;
        }
        .leaflet-popup-tip {
          background-color: rgba(0, 0, 0, 0.9) !important;
        }

        .radar-popup .leaflet-popup-content-wrapper {
          background-color: rgba(0, 0, 0, 0.8) !important;
          color: #00ff00 !important;
          border: 1px solid #00ff00 !important;
          box-shadow: 0 0 8px rgba(0, 255, 0, 0.5) !important;
        }
        .radar-popup .leaflet-popup-tip {
          background-color: rgba(0, 0, 0, 0.8) !important;
          border-top: 1px solid #00ff00 !important;
          border-left: 1px solid transparent !important;
          border-right: 1px solid transparent !important;
        }

        @keyframes emergency-plane-pulse {
          0% {
            box-shadow:
              0 0 10px #ff0000,
              0 0 20px #ff0000;
          }
          100% {
            box-shadow:
              0 0 15px #ff0000,
              0 0 25px #ff0000,
              0 0 30px #ff0000;
          }
        }

        @keyframes radar-emergency-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 5px rgba(255, 0, 0, 0.7);
          }
          50% {
            transform: scale(1.3);
            box-shadow: 0 0 10px rgba(255, 0, 0, 0.9);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 5px rgba(255, 0, 0, 0.7);
          }
        }

        .heading-tooltip {
          background-color: rgba(0, 0, 0, 0.7) !important;
          color: white !important;
          border: none !important;
          border-radius: 44px !important;
          padding: 8px !important;
          font-size: 12px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
          pointer-events: none !important;
        }
        .heading-tooltip::before {
          display: none !important;
        }

        .leaflet-popup-content-wrapper {
          background-color: rgba(0, 0, 0, 0.9) !important;
          color: #00ffff !important;
          border-radius: 8px !important;
        }
        .leaflet-popup-tip {
          background-color: rgba(0, 0, 0, 0.9) !important;
        }

        .radar-popup .leaflet-popup-content-wrapper {
          background-color: rgba(0, 0, 0, 0.8) !important;
          color: #00ff00 !important;
          border: 1px solid #00ff00 !important;
          box-shadow: 0 0 8px rgba(0, 255, 0, 0.5) !important;
        }
        .radar-popup .leaflet-popup-tip {
          background-color: rgba(0, 0, 0, 0.8) !important;
          border-top: 1px solid #00ff00 !important;
          border-left: 1px solid transparent !important;
          border-right: 1px solid transparent !important;
        }
      `}</style>
      <div id="map-container" style={{ height: "100%", width: "100%" }} />
    </>
  );
};

export default MapComponent;
