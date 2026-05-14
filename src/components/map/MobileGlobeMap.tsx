"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";

import { type PositionUpdate } from "~/lib/aircraft-store";
import { type OnlineAirport } from "~/hooks/useAircraftStream";
import { type ImportedFlightPlan } from "~/lib/flightPlanImport";
import { getUserResetLocation } from "~/lib/mapResetLocation";
import {
  getCookie,
  setCookie,
} from "~/lib/cookies";
import {
  findActiveWaypointIndex,
  preparePathForWorldCopy,
  unwrapPath,
} from "~/lib/map-utils";
import {
  getAircraftIconFilter,
  getAircraftIconUrl,
} from "~/components/map/MapIcons";

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
  frequencies?: { type: string; frequency: string }[];
}

interface ReplayState {
  currentPosition: [number, number] | null;
  currentHeading: number;
  traversedPath: [number, number][];
  remainingPath: [number, number][];
  isPlaying: boolean;
}

interface MapComponentProps {
  aircrafts: PositionUpdate[];
  airports: Airport[];
  onlineAirports?: OnlineAirport[];
  onAircraftSelect: (
    aircraft: PositionUpdate | null,
    ctrlKey?: boolean,
  ) => void;
  onAirportSelect?: (airport: Airport) => void;
  selectedAircraftIds?: string[];
  selectedAirport?: Airport;
  setDrawFlightPlanOnMap: (
    func: (aircraft: PositionUpdate, shouldZoom?: boolean) => void,
  ) => void;
  setDrawMultipleFlightPlansOnMap?: (
    func: (aircrafts: PositionUpdate[], shouldZoom?: boolean) => void,
  ) => void;
  onMapReady?: () => void;
  onInitialBaseLayerReady?: () => void;
  onInitialTrafficPaint?: () => void;
  historyPath?: [number, number][] | null;
  onLayerModeChange?: (isDarkLayer: boolean) => void;
  replayState?: ReplayState | null;
  followAircraft?: PositionUpdate;
  onConflictReview?: (aircrafts: PositionUpdate[]) => void;
  setResetMapView?: (func: () => void) => void;
  hideUi?: boolean;
  importedFlightPlan?: ImportedFlightPlan | null;
}

interface PointFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, string | number | boolean | null>;
}

interface LineFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: Record<string, string | number | boolean | null>;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: (PointFeature | LineFeature)[];
}

interface FlightPlanWaypointLike {
  ident?: string;
  type?: string;
  lat?: number | string;
  lon?: number | string;
  alt?: number | string | null;
  spd?: number | string | null;
}

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 0.45;
const MIN_ZOOM = 0;
const MAX_ZOOM = 8;
const USER_LOCATION_RESET_ZOOM = 4.8;
const FLIGHT_PATH_COLORS = [
  "#00ff00",
  "#ff6b6b",
  "#4dabf7",
  "#ffd43b",
  "#da77f2",
  "#69db7c",
  "#ff922b",
  "#22b8cf",
] as const;
const EMERGENCY_SQUAWKS = new Set(["7700", "7600", "7500"]);

const COOKIE_ZOOM = "mobile_globe_zoom";
const COOKIE_LAT = "mobile_globe_center_lat";
const COOKIE_LNG = "mobile_globe_center_lng";

const BASE_LAYER_IDS = {
  satellite: "mobile-globe-satellite",
  radar: "mobile-globe-radar",
  osm: "mobile-globe-osm",
  openAip: "mobile-globe-openaip",
} as const;

const SOURCE_IDS = {
  selectedHistory: "mobile-globe-selected-history",
  selectedRoutes: "mobile-globe-selected-routes",
  selectedWaypoints: "mobile-globe-selected-waypoints",
  selectedAirport: "mobile-globe-selected-airport",
  history: "mobile-globe-history",
  replayTraversed: "mobile-globe-replay-traversed",
  replayRemaining: "mobile-globe-replay-remaining",
  replayCurrent: "mobile-globe-replay-current",
  importedFlightPlan: "mobile-globe-imported-flight-plan",
} as const;

function emptyFeatureCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function isGeoJsonSource(
  source: maplibregl.Source | undefined,
): source is maplibregl.GeoJSONSource {
  return Boolean(source && "setData" in source);
}

function setSourceData(
  map: maplibregl.Map,
  sourceId: string,
  data: FeatureCollection,
) {
  const source = map.getSource(sourceId);
  if (!isGeoJsonSource(source)) return;
  source.setData(data);
}

function isValidCoordinate(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function buildPointFeature(
  lon: number,
  lat: number,
  properties: Record<string, string | number | boolean | null> = {},
): PointFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties,
  };
}

function buildLineFeature(
  coordinates: [number, number][],
  properties: Record<string, string | number | boolean | null> = {},
): LineFeature | null {
  if (coordinates.length < 2) return null;

  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties,
  };
}

function toLngLatCoords(path: [number, number][]) {
  return path
    .filter(([lat, lon]) => isValidCoordinate(lat, lon))
    .map(([lat, lon]) => [lon, lat] as [number, number]);
}

function getUnwrappedWaypointCoords(
  waypoints: FlightPlanWaypointLike[],
  referenceLon?: number,
) {
  const rawCoords: [number, number][] = [];
  const validWaypoints: { wp: FlightPlanWaypointLike; wpIndex: number }[] = [];

  waypoints.forEach((wp, wpIndex) => {
    const lat =
      typeof wp.lat === "number"
        ? wp.lat
        : typeof wp.lat === "string"
          ? Number(wp.lat)
          : Number.NaN;
    const lon =
      typeof wp.lon === "number"
        ? wp.lon
        : typeof wp.lon === "string"
          ? Number(wp.lon)
          : Number.NaN;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    validWaypoints.push({ wp: { ...wp, lat, lon }, wpIndex });
    rawCoords.push([lat, lon]);
  });

  const coords = unwrapPath(rawCoords);
  if (coords.length >= 2 && referenceLon !== undefined) {
    const midLon = (coords[0]![1] + coords[coords.length - 1]![1]) / 2;
    const shift = Math.round((referenceLon - midLon) / 360) * 360;
    if (shift !== 0) {
      for (const coord of coords) {
        coord[1] += shift;
      }
    }
  }

  return { coords, validWaypoints };
}

function fitMapToCoords(
  map: maplibregl.Map,
  coords: [number, number][],
  maxZoom = 5,
) {
  if (coords.length === 0) return;

  if (coords.length === 1) {
    map.easeTo({
      center: coords[0],
      zoom: Math.min(maxZoom, Math.max(map.getZoom(), 3.5)),
      duration: 700,
    });
    return;
  }

  const bounds = coords.reduce(
    (acc, coord) => acc.extend(coord),
    new maplibregl.LngLatBounds(coords[0], coords[0]),
  );

  map.fitBounds(bounds, {
    padding: { top: 100, right: 50, bottom: 120, left: 50 },
    maxZoom,
    duration: 700,
  });
}

function createAircraftMarkerElement() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pointer-events-auto relative h-8 w-8 cursor-pointer bg-transparent p-0";
  button.style.border = "none";
  button.style.outline = "none";
  button.style.padding = "0";
  button.style.margin = "0";
  return button;
}

function syncAircraftMarkerElement(
  element: HTMLButtonElement,
  aircraft: PositionUpdate,
  isSelected: boolean,
) {
  const isEmergency =
    Boolean(aircraft.squawk) && EMERGENCY_SQUAWKS.has(aircraft.squawk);
  const iconUrl = getAircraftIconUrl(aircraft.type, aircraft.af);
  const filter = getAircraftIconFilter(isEmergency, isSelected);
  const selectionRing = isSelected
    ? `<div style="position:absolute; inset:1px; border-radius:9999px; border:1.5px solid rgba(250,204,21,0.95); box-shadow:0 0 10px rgba(250,204,21,0.45);"></div>`
    : "";

  element.setAttribute("aria-label", aircraft.flightNo || aircraft.callsign || "Aircraft");
  element.innerHTML = `
    ${selectionRing}
    <img
      src="${iconUrl}"
      alt=""
      style="
        position:absolute;
        inset:0;
        width:32px;
        height:32px;
        transform: rotate(${aircraft.heading || 0}deg);
        transform-origin: 50% 50%;
        filter: ${filter};
        pointer-events:none;
      "
    />
  `;
}

function buildBaseStyle(openAipUrl: string): StyleSpecification {
  return {
    version: 8,
    projection: { type: "globe" },
    sky: {
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        5,
        1,
        7,
        0,
      ],
    },
    light: {
      anchor: "map",
      position: [1.5, 90, 80],
    },
    sources: {
      satellite: {
        type: "raster",
        tiles: [
          "https://mt0.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
          "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
          "https://mt2.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
          "https://mt3.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
        ],
        tileSize: 256,
        maxzoom: 18,
        scheme: "xyz",
      },
      radar: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        ],
        tileSize: 256,
        maxzoom: 18,
      },
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
      openaip: {
        type: "raster",
        tiles: [openAipUrl],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: BASE_LAYER_IDS.satellite,
        type: "raster",
        source: "satellite",
      },
      {
        id: BASE_LAYER_IDS.radar,
        type: "raster",
        source: "radar",
        layout: { visibility: "none" },
      },
      {
        id: BASE_LAYER_IDS.osm,
        type: "raster",
        source: "osm",
        layout: { visibility: "none" },
        paint: {
          "raster-brightness-max": 0.6,
          "raster-contrast": 0.1,
          "raster-saturation": -0.1,
        },
      },
      {
        id: BASE_LAYER_IDS.openAip,
        type: "raster",
        source: "openaip",
        layout: { visibility: "none" },
        paint: {
          "raster-opacity": 0.9,
        },
      },
    ],
  };
}

function buildSelectedFlightData(aircrafts: PositionUpdate[]) {
  const historyFeatures: LineFeature[] = [];
  const routeFeatures: LineFeature[] = [];
  const waypointFeatures: PointFeature[] = [];
  const zoomCoords: [number, number][] = [];

  aircrafts.forEach((aircraft, index) => {
    const color = FLIGHT_PATH_COLORS[index % FLIGHT_PATH_COLORS.length]!;
    const history = preparePathForWorldCopy(aircraft.flightPath ?? [], aircraft.lon);
    const historyCoords = toLngLatCoords(history);

    const historyLine = buildLineFeature(historyCoords, {
      callsign: aircraft.flightNo || aircraft.callsign,
      color,
    });
    if (historyLine) {
      historyFeatures.push(historyLine);
      zoomCoords.push(...historyCoords);
    }

    if (Number.isFinite(aircraft.lat) && Number.isFinite(aircraft.lon)) {
      zoomCoords.push([aircraft.lon, aircraft.lat]);
    }

    if (!aircraft.flightPlan) return;

    try {
      const waypoints = JSON.parse(aircraft.flightPlan) as FlightPlanWaypointLike[];
      if (waypoints.length === 0) return;

      const activeWaypointIndex = findActiveWaypointIndex(aircraft, waypoints);
      const { coords, validWaypoints } = getUnwrappedWaypointCoords(
        waypoints,
        aircraft.lon,
      );
      const routeCoords = coords.map(([lat, lon]) => [lon, lat] as [number, number]);
      const routeLine = buildLineFeature(routeCoords, {
        callsign: aircraft.flightNo || aircraft.callsign,
        color,
      });
      if (routeLine) {
        routeFeatures.push(routeLine);
        zoomCoords.push(...routeCoords);
      }

      coords.forEach(([lat, lon], waypointArrayIndex) => {
        const waypointEntry = validWaypoints[waypointArrayIndex];
        if (!waypointEntry) return;
        waypointFeatures.push(
          buildPointFeature(lon, lat, {
            active: waypointEntry.wpIndex === activeWaypointIndex,
            ident: waypointEntry.wp.ident ?? `WP${waypointEntry.wpIndex + 1}`,
          }),
        );
      });
    } catch {
      // Ignore malformed flight plans on the mobile globe path.
    }
  });

  return { historyFeatures, routeFeatures, waypointFeatures, zoomCoords };
}

const MobileGlobeMap: React.FC<MapComponentProps> = ({
  aircrafts,
  selectedAircraftIds = [],
  selectedAirport,
  onAircraftSelect,
  setDrawFlightPlanOnMap,
  setDrawMultipleFlightPlansOnMap,
  onMapReady,
  onInitialBaseLayerReady,
  onInitialTrafficPaint,
  historyPath,
  onLayerModeChange,
  replayState,
  followAircraft,
  setResetMapView,
  importedFlightPlan = null,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const aircraftMarkersRef = useRef<
    Map<string, { marker: maplibregl.Marker; element: HTMLButtonElement }>
  >(new Map());
  const aircraftLookupRef = useRef<Map<string, PositionUpdate>>(new Map());
  const onAircraftSelectRef = useRef(onAircraftSelect);
  const onMapReadyRef = useRef(onMapReady);
  const onInitialBaseLayerReadyRef = useRef(onInitialBaseLayerReady);
  const hasReportedTrafficPaintRef = useRef(false);
  const hasReportedBaseLayerRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);

  const selectedAircraftKeySet = useMemo(
    () => new Set(selectedAircraftIds),
    [selectedAircraftIds],
  );

  useEffect(() => {
    aircraftLookupRef.current = new Map(
      aircrafts.map((aircraft) => [aircraft.callsign || aircraft.id, aircraft]),
    );
  }, [aircrafts]);

  useEffect(() => {
    onAircraftSelectRef.current = onAircraftSelect;
  }, [onAircraftSelect]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onInitialBaseLayerReadyRef.current = onInitialBaseLayerReady;
  }, [onInitialBaseLayerReady]);

  const updateBaseLayerVisibility = useCallback(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded() !== true) return;

    map.setLayoutProperty(BASE_LAYER_IDS.satellite, "visibility", "visible");
    map.setLayoutProperty(BASE_LAYER_IDS.radar, "visibility", "none");
    map.setLayoutProperty(BASE_LAYER_IDS.osm, "visibility", "none");
    map.setLayoutProperty(BASE_LAYER_IDS.openAip, "visibility", "none");
  }, []);

  const resetMapView = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const userLocation = await getUserResetLocation();
    const center: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : DEFAULT_CENTER;
    const zoom = userLocation ? USER_LOCATION_RESET_ZOOM : DEFAULT_ZOOM;

    map.easeTo({
      center,
      zoom,
      pitch: 0,
      bearing: 0,
      duration: 800,
    });
    setCookie(COOKIE_ZOOM, String(zoom));
    setCookie(COOKIE_LAT, String(center[1]));
    setCookie(COOKIE_LNG, String(center[0]));
  }, []);

  useEffect(() => {
    onLayerModeChange?.(false);
  }, [onLayerModeChange]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const savedZoom = Number.parseFloat(getCookie(COOKIE_ZOOM) ?? "");
    const savedLat = Number.parseFloat(getCookie(COOKIE_LAT) ?? "");
    const savedLng = Number.parseFloat(getCookie(COOKIE_LNG) ?? "");

    const initialCenter: [number, number] =
      Number.isFinite(savedLng) && Number.isFinite(savedLat)
        ? [savedLng, savedLat]
        : DEFAULT_CENTER;
    const initialZoom = Number.isFinite(savedZoom)
      ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedZoom))
      : DEFAULT_ZOOM;

    const openAipUrl = `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${process.env.NEXT_PUBLIC_OPENAIP_API_KEY}`;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: buildBaseStyle(openAipUrl),
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: {},
      maplibreLogo: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      renderWorldCopies: false,
    });

    mapRef.current = map;
    const aircraftMarkers = aircraftMarkersRef.current;

    map.on("load", () => {
      map.addSource(SOURCE_IDS.selectedHistory, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.selectedRoutes, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.selectedWaypoints, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.selectedAirport, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.history, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.replayTraversed, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.replayRemaining, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.replayCurrent, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.importedFlightPlan, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });

      map.addLayer({
        id: "mobile-globe-selected-history",
        type: "line",
        source: SOURCE_IDS.selectedHistory,
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#00ff00"],
          "line-width": 3,
          "line-opacity": 0.78,
        },
      });

      map.addLayer({
        id: "mobile-globe-selected-routes",
        type: "line",
        source: SOURCE_IDS.selectedRoutes,
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#22d3ee"],
          "line-width": 2.5,
          "line-opacity": 0.72,
          "line-dasharray": [4, 3],
        },
      });

      map.addLayer({
        id: "mobile-globe-history-line",
        type: "line",
        source: SOURCE_IDS.history,
        paint: {
          "line-color": "#00ff00",
          "line-width": 2,
          "line-opacity": 0.75,
        },
      });

      map.addLayer({
        id: "mobile-globe-imported-flight-plan-line",
        type: "line",
        source: SOURCE_IDS.importedFlightPlan,
        paint: {
          "line-color": "#f59e0b",
          "line-width": 2,
          "line-opacity": 0.85,
        },
      });

      map.addLayer({
        id: "mobile-globe-replay-traversed",
        type: "line",
        source: SOURCE_IDS.replayTraversed,
        paint: {
          "line-color": "#f59e0b",
          "line-width": 2.5,
          "line-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "mobile-globe-replay-remaining",
        type: "line",
        source: SOURCE_IDS.replayRemaining,
        paint: {
          "line-color": "#f59e0b",
          "line-width": 1.5,
          "line-opacity": 0.35,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "mobile-globe-selected-airport",
        type: "circle",
        source: SOURCE_IDS.selectedAirport,
        paint: {
          "circle-radius": 9,
          "circle-color": "#22d3ee",
          "circle-stroke-color": "#ecfeff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.18,
          "circle-stroke-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "mobile-globe-selected-waypoints",
        type: "circle",
        source: SOURCE_IDS.selectedWaypoints,
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "active"], true],
            7,
            5,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "active"], true],
            "#4ade80",
            "#f542e3",
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "active"], true],
            2,
            1.5,
          ],
          "circle-stroke-color": "#f8fafc",
          "circle-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "mobile-globe-replay-current",
        type: "circle",
        source: SOURCE_IDS.replayCurrent,
        paint: {
          "circle-radius": 6,
          "circle-color": "#f59e0b",
          "circle-stroke-color": "#fff7ed",
          "circle-stroke-width": 2,
        },
      });

      updateBaseLayerVisibility();
      setMapReady(true);
      setIsMapVisible(true);
      onMapReadyRef.current?.();

      if (!hasReportedBaseLayerRef.current) {
        hasReportedBaseLayerRef.current = true;
        onInitialBaseLayerReadyRef.current?.();
      }
    });

    map.on("moveend", () => {
      const center = map.getCenter();
      setCookie(COOKIE_ZOOM, String(map.getZoom()));
      setCookie(COOKIE_LAT, String(center.lat));
      setCookie(COOKIE_LNG, String(center.lng));
    });

    map.on("click", (event) => {
      const target = event.originalEvent.target;
      if (target instanceof HTMLElement && target.closest("[data-aircraft-marker]")) {
        return;
      }
      onAircraftSelectRef.current(null);
    });

    return () => {
      aircraftMarkers.forEach(({ marker }) => marker.remove());
      aircraftMarkers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [updateBaseLayerVisibility]);

  useEffect(() => {
    updateBaseLayerVisibility();
  }, [updateBaseLayerVisibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const nextKeys = new Set<string>();

    aircrafts
      .filter((aircraft) => isValidCoordinate(aircraft.lat, aircraft.lon))
      .forEach((aircraft) => {
        const aircraftKey = aircraft.callsign || aircraft.id;
        nextKeys.add(aircraftKey);

        const existing = aircraftMarkersRef.current.get(aircraftKey);
        const isSelected = selectedAircraftKeySet.has(aircraftKey);

        if (!existing) {
          const element = createAircraftMarkerElement();
          element.dataset.aircraftMarker = "true";
          element.dataset.aircraftKey = aircraftKey;
          syncAircraftMarkerElement(element, aircraft, isSelected);
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            const target = event.currentTarget as HTMLButtonElement;
            const key = target.dataset.aircraftKey;
            if (!key) return;
            onAircraftSelectRef.current(aircraftLookupRef.current.get(key) ?? null, false);
          });

          const marker = new maplibregl.Marker({
            element,
            anchor: "center",
            rotationAlignment: "map",
            pitchAlignment: "map",
            opacityWhenCovered: 0,
          })
            .setLngLat([aircraft.lon, aircraft.lat])
            .addTo(map);

          aircraftMarkersRef.current.set(aircraftKey, { marker, element });
          return;
        }

        syncAircraftMarkerElement(existing.element, aircraft, isSelected);
        existing.marker.setLngLat([aircraft.lon, aircraft.lat]);
      });

    aircraftMarkersRef.current.forEach((entry, aircraftKey) => {
      if (nextKeys.has(aircraftKey)) return;
      entry.marker.remove();
      aircraftMarkersRef.current.delete(aircraftKey);
    });

    if (!hasReportedTrafficPaintRef.current && nextKeys.size > 0) {
      hasReportedTrafficPaintRef.current = true;
      onInitialTrafficPaint?.();
    }
  }, [aircrafts, mapReady, onInitialTrafficPaint, selectedAircraftKeySet]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!selectedAirport || !isValidCoordinate(selectedAirport.lat, selectedAirport.lon)) {
      setSourceData(map, SOURCE_IDS.selectedAirport, emptyFeatureCollection());
      return;
    }

    setSourceData(map, SOURCE_IDS.selectedAirport, {
      type: "FeatureCollection",
      features: [
        buildPointFeature(selectedAirport.lon, selectedAirport.lat, {
          icao: selectedAirport.icao,
        }),
      ],
    });
  }, [mapReady, selectedAirport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!historyPath || historyPath.length < 2) {
      setSourceData(map, SOURCE_IDS.history, emptyFeatureCollection());
      return;
    }

    const line = buildLineFeature(toLngLatCoords(historyPath));
    setSourceData(map, SOURCE_IDS.history, {
      type: "FeatureCollection",
      features: line ? [line] : [],
    });
  }, [historyPath, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!replayState?.currentPosition) {
      setSourceData(map, SOURCE_IDS.replayTraversed, emptyFeatureCollection());
      setSourceData(map, SOURCE_IDS.replayRemaining, emptyFeatureCollection());
      setSourceData(map, SOURCE_IDS.replayCurrent, emptyFeatureCollection());
      return;
    }

    const traversedLine = buildLineFeature(
      toLngLatCoords(replayState.traversedPath),
    );
    const remainingLine = buildLineFeature(
      toLngLatCoords(replayState.remainingPath),
    );

    setSourceData(map, SOURCE_IDS.replayTraversed, {
      type: "FeatureCollection",
      features: traversedLine ? [traversedLine] : [],
    });
    setSourceData(map, SOURCE_IDS.replayRemaining, {
      type: "FeatureCollection",
      features: remainingLine ? [remainingLine] : [],
    });
    setSourceData(map, SOURCE_IDS.replayCurrent, {
      type: "FeatureCollection",
      features: [
        buildPointFeature(
          replayState.currentPosition[1],
          replayState.currentPosition[0],
        ),
      ],
    });
  }, [mapReady, replayState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!importedFlightPlan || importedFlightPlan.waypoints.length < 2) {
      setSourceData(map, SOURCE_IDS.importedFlightPlan, emptyFeatureCollection());
      return;
    }

    const coords = importedFlightPlan.waypoints
      .filter((waypoint) => isValidCoordinate(waypoint.lat, waypoint.lon))
      .map((waypoint) => [waypoint.lon, waypoint.lat] as [number, number]);

    const line = buildLineFeature(coords);
    setSourceData(map, SOURCE_IDS.importedFlightPlan, {
      type: "FeatureCollection",
      features: line ? [line] : [],
    });
  }, [importedFlightPlan, mapReady]);

  useEffect(() => {
    if (!setResetMapView) return;
    setResetMapView(resetMapView);
  }, [resetMapView, setResetMapView]);

  useEffect(() => {
    if (!followAircraft || !mapRef.current) return;
    if (!isValidCoordinate(followAircraft.lat, followAircraft.lon)) return;

    mapRef.current.easeTo({
      center: [followAircraft.lon, followAircraft.lat],
      duration: 300,
    });
  }, [followAircraft]);

  useEffect(() => {
    setDrawFlightPlanOnMap((aircraft, shouldZoom = true) => {
      const map = mapRef.current;
      if (!map) return;

      const { historyFeatures, routeFeatures, waypointFeatures, zoomCoords } =
        buildSelectedFlightData([aircraft]);

      setSourceData(map, SOURCE_IDS.selectedHistory, {
        type: "FeatureCollection",
        features: historyFeatures,
      });
      setSourceData(map, SOURCE_IDS.selectedRoutes, {
        type: "FeatureCollection",
        features: routeFeatures,
      });
      setSourceData(map, SOURCE_IDS.selectedWaypoints, {
        type: "FeatureCollection",
        features: waypointFeatures,
      });

      if (shouldZoom) {
        fitMapToCoords(map, zoomCoords, 4.5);
      }
    });
  }, [setDrawFlightPlanOnMap]);

  useEffect(() => {
    if (!setDrawMultipleFlightPlansOnMap) return;

    setDrawMultipleFlightPlansOnMap((selectedAircraft, shouldZoom = true) => {
      const map = mapRef.current;
      if (!map) return;

      const { historyFeatures, routeFeatures, waypointFeatures, zoomCoords } =
        buildSelectedFlightData(selectedAircraft);

      setSourceData(map, SOURCE_IDS.selectedHistory, {
        type: "FeatureCollection",
        features: historyFeatures,
      });
      setSourceData(map, SOURCE_IDS.selectedRoutes, {
        type: "FeatureCollection",
        features: routeFeatures,
      });
      setSourceData(map, SOURCE_IDS.selectedWaypoints, {
        type: "FeatureCollection",
        features: waypointFeatures,
      });

      if (shouldZoom) fitMapToCoords(map, zoomCoords, 4.25);
    });
  }, [setDrawMultipleFlightPlansOnMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (selectedAircraftIds.length > 0) return;

    setSourceData(map, SOURCE_IDS.selectedHistory, emptyFeatureCollection());
    setSourceData(map, SOURCE_IDS.selectedRoutes, emptyFeatureCollection());
    setSourceData(map, SOURCE_IDS.selectedWaypoints, emptyFeatureCollection());
  }, [mapReady, selectedAircraftIds]);

  return (
    <div
      ref={mapContainerRef}
      className={`h-full w-full bg-[#020814] transition-opacity duration-300 ${
        isMapVisible ? "opacity-100" : "opacity-0"
      }`}
    />
  );
};

export default MobileGlobeMap;
