"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import Image from "next/image";
import { toast } from "sonner";
import { Crosshair, Globe2, Minus, Plus, Settings2 } from "lucide-react";

import { type PositionUpdate } from "~/lib/aircraft-store";
import { type OnlineAirport } from "~/hooks/useAircraftStream";
import { type Runway } from "~/hooks/useAirportData";
import { useProStatus } from "~/hooks/useProStatus";
import { type ImportedFlightPlan } from "~/lib/flightPlanImport";
import { type MapResetLocation } from "~/lib/mapResetLocation";
import {
  getBooleanCookie,
  getCookie,
  setCookie,
  setBooleanCookie,
} from "~/lib/cookies";
import {
  calculateBearing,
  calculateDistance,
  createGeodesicCircle,
  findActiveWaypointIndex,
  preparePathForWorldCopy,
  SELECTED_AIRPORT_RADIUS_MILES,
  unwrapPath,
} from "~/lib/map-utils";
import {
  RADAR_TRAIL_COLOR,
  buildRadarModeLinePath,
  buildRadarTrailDots,
} from "~/lib/radarTrails";
import { Analytics } from "~/lib/analytics";
import {
  createMapLayerPreset,
  getStoredMapLayerPresets,
  mapLayerPresetStateEquals,
  setStoredMapLayerPresets,
  type MapLayerPresetState,
} from "~/lib/mapLayerPresets";
import {
  getStoredRadarModeLinePreferences,
  getStoredRadarTrailPreferences,
  setStoredRadarModeLinePreferences,
  setStoredRadarTrailPreferences,
} from "~/lib/radarTrailPreferences";
import {
  getStoredRunwayCenterlinePreferences,
  setStoredRunwayCenterlinePreferences,
} from "~/lib/runwayCenterlinePreferences";
import {
  buildRunwayCenterlinePaths,
  RUNWAY_CENTERLINE_MIN_ZOOM,
} from "~/lib/runwayCenterlines";
import {
  getAircraftIconFilter,
  getAircraftIconUrl,
} from "~/components/map/MapIcons";
import { RadarSettings } from "~/components/atc/radarSettings";
import { HEADING_MODE_CURSOR } from "~/components/map/headingModeCursor";
import { MapSettingsSidebar } from "~/components/map/MapSettingsSidebar";
import { useUnitPreferences } from "~/hooks/useUnitPreferences";
import { formatAltitude, formatSpeed, speedSuffix } from "~/lib/units";
import { getCompactAircraftType } from "~/lib/utils";
import { filterNavFixesInBounds, loadNavFixes } from "~/lib/navFixes";

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
  runways?: Runway[];
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
  setResetMapView?: (
    func: (targetLocation?: MapResetLocation | null) => void,
  ) => void;
  mapRenderer?: "flat" | "globe";
  onMapRendererChange?: (renderer: "flat" | "globe") => void;
  showDesktopControls?: boolean;
  showLeftControls?: boolean;
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

interface PolygonFeature {
  type: "Feature";
  geometry:
    | { type: "Polygon"; coordinates: [number, number][][] }
    | { type: "MultiPolygon"; coordinates: [number, number][][][] };
  properties: Record<string, string | number | boolean | null>;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: (PointFeature | LineFeature | PolygonFeature)[];
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
const MOBILE_DEFAULT_ZOOM = 0.45;
const DESKTOP_DEFAULT_ZOOM = 3;
const MOBILE_MIN_ZOOM = 0;
const DESKTOP_MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const MIN_WAYPOINT_ZOOM = 7;
const WAYPOINT_QUERY_DEBOUNCE_MS = 250;
const MAX_RENDERED_WAYPOINTS = 2500;
const MOBILE_USER_LOCATION_RESET_ZOOM = 3.6;
const DESKTOP_USER_LOCATION_RESET_ZOOM = 5.5;
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

const MOBILE_COOKIE_ZOOM = "mobile_globe_zoom";
const MOBILE_COOKIE_LAT = "mobile_globe_center_lat";
const MOBILE_COOKIE_LNG = "mobile_globe_center_lng";
const DESKTOP_COOKIE_ZOOM = "map_zoom";
const DESKTOP_COOKIE_LAT = "map_center_lat";
const DESKTOP_COOKIE_LNG = "map_center_lng";
const SATELLITE_TILES = [
  "https://mt0.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
  "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
  "https://mt2.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
  "https://mt3.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
] as const;
const RADAR_TILES = [
  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
] as const;
const OSM_TILES = [
  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
] as const;

const BASE_LAYER_IDS = {
  satellite: "mobile-globe-satellite",
  radar: "mobile-globe-radar",
  osm: "mobile-globe-osm",
  openAip: "mobile-globe-openaip",
} as const;
const FIRST_OVERLAY_LAYER_ID = "mobile-globe-selected-history";
const OPENAIP_SOURCE_ID = "mobile-globe-openaip-source";
const OPENAIP_TILES = `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${process.env.NEXT_PUBLIC_OPENAIP_API_KEY}`;

const SOURCE_IDS = {
  radarTrails: "mobile-globe-radar-trails",
  radarModeLines: "mobile-globe-radar-mode-lines",
  runwayCenterlines: "mobile-globe-runway-centerlines",
  selectedHistory: "mobile-globe-selected-history",
  selectedRoutes: "mobile-globe-selected-routes",
  selectedWaypoints: "mobile-globe-selected-waypoints",
  selectedAirport: "mobile-globe-selected-airport",
  history: "mobile-globe-history",
  replayTraversed: "mobile-globe-replay-traversed",
  replayRemaining: "mobile-globe-replay-remaining",
  replayCurrent: "mobile-globe-replay-current",
  importedFlightPlan: "mobile-globe-imported-flight-plan",
  headingLine: "mobile-globe-heading-line",
  headingStart: "mobile-globe-heading-start",
  worldWaypoints: "mobile-globe-world-waypoints",
} as const;

function emptyFeatureCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

type GlobeBaseLayer = "satellite" | "radar" | "osm";

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

function buildWaypointBoundsParams(map: maplibregl.Map) {
  const bounds = map.getBounds();
  const west = Math.max(-180, bounds.getWest());
  const east = Math.min(180, bounds.getEast());

  return {
    south: bounds.getSouth(),
    west,
    north: bounds.getNorth(),
    east,
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

function getBaseLayerMode(
  isRadarMode: boolean,
  isOSMMode: boolean,
): GlobeBaseLayer {
  if (isRadarMode) return "radar";
  if (isOSMMode) return "osm";
  return "satellite";
}

function getBaseTiles(mode: GlobeBaseLayer): string[] {
  switch (mode) {
    case "radar":
      return [...RADAR_TILES];
    case "osm":
      return [...OSM_TILES];
    default:
      return [...SATELLITE_TILES];
  }
}

function getBaseSourceSpec(mode: GlobeBaseLayer) {
  return {
    type: "raster" as const,
    tiles: getBaseTiles(mode),
    tileSize: 256,
    maxzoom: mode === "osm" ? 19 : 18,
    ...(mode === "osm" ? { attribution: "© OpenStreetMap contributors" } : {}),
    ...(mode === "satellite" ? { scheme: "xyz" as const } : {}),
  };
}

function getBaseLayerPaint(mode: GlobeBaseLayer) {
  if (mode === "osm") {
    return {
      "raster-brightness-max": 0.6,
      "raster-contrast": 0.1,
      "raster-saturation": -0.1,
    };
  }

  return {
    "raster-brightness-max": 1,
    "raster-contrast": 0,
    "raster-saturation": 0,
  };
}

function toLngLatCoords(path: [number, number][]) {
  return path
    .filter(([lat, lon]) => isValidCoordinate(lat, lon))
    .map(([lat, lon]) => [lon, lat] as [number, number]);
}

function getRadarModeLineStyle(
  aircraft: PositionUpdate,
  isSelected: boolean,
): { color: string; opacity: number; width: number } {
  const isEmergency = aircraft.squawk && EMERGENCY_SQUAWKS.has(aircraft.squawk);
  const isIdentActive =
    aircraft.identActive ||
    (typeof aircraft.identUntil === "number" &&
      aircraft.identUntil > Date.now());

  if (isEmergency) {
    return {
      color: "#ef4444",
      opacity: isSelected ? 0.95 : 0.8,
      width: isSelected ? 2.6 : 1.7,
    };
  }

  if (isIdentActive) {
    return {
      color: "#fbbf24",
      opacity: isSelected ? 0.95 : 0.82,
      width: isSelected ? 2.5 : 1.6,
    };
  }

  if (isSelected) {
    return {
      color: "#4ade80",
      opacity: 0.95,
      width: 2.4,
    };
  }

  return {
    color: "#22d3ee",
    opacity: 0.72,
    width: 1.5,
  };
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
  button.className =
    "pointer-events-auto relative h-8 w-8 cursor-pointer overflow-visible bg-transparent p-0";
  button.style.border = "none";
  button.style.outline = "none";
  button.style.padding = "0";
  button.style.margin = "0";
  button.style.overflow = "visible";
  button.style.textAlign = "left";
  return button;
}

function syncAircraftMarkerElement(
  element: HTMLButtonElement,
  aircraft: PositionUpdate,
  isRadarMode: boolean,
  isSelected: boolean,
  showTags: boolean,
  hasSelection: boolean,
  isDesktop: boolean,
  speedUnit: "kts" | "mach",
  altitudeUnit: "auto" | "feet" | "fl",
) {
  const isEmergency =
    Boolean(aircraft.squawk) && EMERGENCY_SQUAWKS.has(aircraft.squawk);
  const isIdentActive =
    aircraft.identActive ||
    (typeof aircraft.identUntil === "number" &&
      aircraft.identUntil > Date.now());
  const iconUrl = getAircraftIconUrl(aircraft.type, aircraft.af);
  const filter = getAircraftIconFilter(isEmergency, isSelected);
  const altMSL = Number(aircraft.altMSL ?? aircraft.alt ?? 0);
  const altAGL = Number(aircraft.alt ?? 0);
  const speedKts = Number(aircraft.speed ?? 0);
  const isOnGround = altAGL < 100;
  const displayAlt = isOnGround
    ? `${altAGL.toFixed(0)}`
    : formatAltitude(altMSL, altitudeUnit);
  const displaySpeed = isOnGround
    ? `${speedKts.toFixed(0)}kt`
    : `${formatSpeed(speedKts, speedUnit, altMSL)}${speedSuffix(speedUnit)}`;
  const compactType = getCompactAircraftType(aircraft.type);
  const primaryLabelBase = aircraft.flightNo || aircraft.callsign || "N/A";
  const primaryLabel = compactType
    ? `${primaryLabelBase}<span style="font-size:78%; opacity:0.72;"> ${compactType}</span>`
    : primaryLabelBase;
  const detailLabel = `${displayAlt} ${displaySpeed}`;
  const secondaryLabel =
    aircraft.callsign && aircraft.callsign !== primaryLabelBase
      ? aircraft.callsign
      : "";
  const shouldShowTag = showTags && (!hasSelection || isSelected);

  element.setAttribute(
    "aria-label",
    aircraft.flightNo || aircraft.callsign || "Aircraft",
  );

  if (isRadarMode) {
    const dotSize = isSelected ? (isDesktop ? 9 : 7) : isDesktop ? 5 : 4;
    const dotColor = isEmergency
      ? "#ef4444"
      : isIdentActive
        ? "#fbbf24"
        : isSelected
          ? "#4ade80"
          : "#22d3ee";
    const glowColor = isEmergency
      ? "rgba(239,68,68,0.8)"
      : isIdentActive
        ? "rgba(251,191,36,0.95)"
        : isSelected
          ? "rgba(74,222,128,0.9)"
          : "rgba(0,255,255,0.5)";
    const connectorColor = isEmergency
      ? "rgba(248,113,113,0.8)"
      : isSelected
        ? "rgba(187,247,208,0.95)"
        : "rgba(226,232,240,0.7)";
    const centerX = 16;
    const centerY = 16;
    const dotLeft = centerX - dotSize / 2;
    const dotTop = centerY - dotSize / 2;
    const tagWidth = isDesktop ? 138 : 108;
    const tagFontSize = isDesktop ? 12 : 10;
    const tagHeaderSize = isDesktop ? 13 : 11;
    const tagSecondarySize = isDesktop ? 10 : 8;
    const labelOffset = isDesktop ? 20 : 16;
    const connectorGap = isDesktop ? 10 : 8;
    const tagLeft = centerX + labelOffset;

    const identRing = isIdentActive
      ? `<div style="position:absolute; top:${dotTop - 6}px; left:${dotLeft - 6}px; width:${dotSize + 12}px; height:${dotSize + 12}px; border-radius:9999px; border:2px solid rgba(251,191,36,0.95); animation:radar-ident-pulse 1s ease-in-out infinite; pointer-events:none;"></div>`
      : "";
    const selectionRing = isSelected
      ? `<div style="position:absolute; top:${dotTop - 4}px; left:${dotLeft - 4}px; width:${dotSize + 8}px; height:${dotSize + 8}px; border-radius:9999px; border:1.5px solid ${isEmergency ? "#ef4444" : "#4ade80"}; box-shadow:0 0 6px ${isEmergency ? "rgba(239,68,68,0.6)" : "rgba(74,222,128,0.6)"}; animation:radar-ring-pulse 1.5s ease-in-out infinite; pointer-events:none;"></div>`
      : "";

    element.innerHTML = `
      ${identRing}
      ${selectionRing}
      <div
        style="
          position:absolute;
          top:${dotTop}px;
          left:${dotLeft}px;
          width:${dotSize}px;
          height:${dotSize}px;
          border-radius:9999px;
          background-color:${dotColor};
          box-shadow:0 0 ${isSelected ? "8px" : "4px"} ${glowColor}${isSelected ? `, 0 0 14px ${glowColor}` : ""};
          ${isSelected ? "animation:radar-selected-pulse 1.5s ease-in-out infinite;" : ""}
          pointer-events:none;
        "
      ></div>
      <div
        style="
          position:absolute;
          top:${centerY}px;
          left:${centerX + connectorGap}px;
          width:${Math.max(0, labelOffset - connectorGap)}px;
          height:1px;
          background:linear-gradient(90deg, ${connectorColor}, rgba(148, 163, 184, 0.35));
          transform:translateY(-0.5px);
          display:${shouldShowTag ? "block" : "none"};
          pointer-events:none;
        "
      ></div>
      <div
        style="
          position:absolute;
          top:50%;
          left:${tagLeft}px;
          transform:translateY(-50%);
          width:${tagWidth}px;
          display:${shouldShowTag ? "block" : "none"};
          pointer-events:none;
          z-index:10;
          color:${isEmergency ? "#fca5a5" : isSelected ? "#dcfce7" : "#f8fafc"};
          font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;
          font-size:${tagFontSize}px;
          line-height:1.05;
          letter-spacing:0.03em;
          text-shadow:0 0 6px ${glowColor};
          text-align:left;
        "
      >
        <div style="font-weight:700; font-size:${tagHeaderSize}px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${primaryLabel}${isEmergency ? " !" : ""}
        </div>
        <div style="margin-top:2px; opacity:0.95; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${detailLabel}
        </div>
        ${
          secondaryLabel
            ? `<div style="margin-top:2px; opacity:0.65; font-size:${tagSecondarySize}px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${secondaryLabel}</div>`
            : ""
        }
      </div>
    `;
    return;
  }

  const selectionRing = isSelected
    ? `<div style="position:absolute; inset:1px; border-radius:9999px; border:1.5px solid rgba(250,204,21,0.95); box-shadow:0 0 10px rgba(250,204,21,0.45);"></div>`
    : "";
  const identRing = isIdentActive
    ? `<div style="position:absolute; inset:-4px; border-radius:9999px; border:2px solid rgba(251,191,36,0.95); animation:radar-ident-pulse 1s ease-in-out infinite; pointer-events:none;"></div>`
    : "";
  const tagWidth = isDesktop ? 132 : 104;
  const tagFontSize = isDesktop ? 12 : 10;
  const tagHeaderSize = isDesktop ? 13 : 11;
  const tagSecondarySize = isDesktop ? 10 : 8;
  const tagMinHeight = secondaryLabel
    ? isDesktop
      ? 56
      : 46
    : isDesktop
      ? 40
      : 32;

  element.innerHTML = `
    ${identRing}
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
    <div
      style="
        position:absolute;
        top:50%;
        left:40px;
        transform:translateY(-50%);
        width:${tagWidth}px;
        display:${shouldShowTag ? "block" : "none"};
        pointer-events:none;
        z-index:10;
      "
    >
      <div
        style="
          display:flex;
          flex-direction:column;
          align-items:stretch;
          gap:2px;
          overflow:hidden;
          border-radius:4px;
          border:1px solid ${isEmergency ? "rgba(239,68,68,0.7)" : "rgba(34,211,238,0.3)"};
          background:rgba(0,0,0,0.5);
          color:${isEmergency ? "rgb(248,113,113)" : "rgb(165,243,252)"};
          backdrop-filter:blur(8px);
          padding:${isDesktop ? "4px 6px" : "3px 5px"};
          min-height:${tagMinHeight}px;
          box-sizing:border-box;
          text-align:left;
          font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;
          font-size:${tagFontSize}px;
          line-height:1.2;
          box-shadow:0 8px 24px rgba(0,0,0,0.22);
        "
      >
        <div
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:6px;
            font-size:${tagHeaderSize}px;
            font-weight:600;
            line-height:1.1;
            width:100%;
          "
        >
          <span style="display:block; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${primaryLabel}</span>
          ${isEmergency ? '<span style="color:rgb(239,68,68);">!</span>' : ""}
        </div>
        <div style="width:100%; opacity:0.85; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${detailLabel}
        </div>
        ${
          secondaryLabel
            ? `<div style="width:100%; opacity:0.65; font-size:${tagSecondarySize}px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${secondaryLabel}</div>`
            : ""
        }
      </div>
    </div>
  `;
}

function buildBaseStyle(
  baseLayerMode: GlobeBaseLayer,
  isOpenAIPEnabled: boolean,
  openAipMinZoom: number,
): StyleSpecification {
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
        ...getBaseSourceSpec(baseLayerMode),
      },
      [OPENAIP_SOURCE_ID]: {
        type: "raster",
        tiles: [OPENAIP_TILES],
        tileSize: 256,
        minzoom: openAipMinZoom,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: BASE_LAYER_IDS.satellite,
        type: "raster",
        source: "satellite",
        paint: getBaseLayerPaint(baseLayerMode),
      },
      {
        id: BASE_LAYER_IDS.openAip,
        type: "raster",
        source: OPENAIP_SOURCE_ID,
        minzoom: openAipMinZoom,
        layout: {
          visibility: isOpenAIPEnabled ? "visible" : "none",
        },
        paint: {
          "raster-opacity": isOpenAIPEnabled ? 0.9 : 0,
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
    const history = preparePathForWorldCopy(
      aircraft.flightPath ?? [],
      aircraft.lon,
    );
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
      const waypoints = JSON.parse(
        aircraft.flightPlan,
      ) as FlightPlanWaypointLike[];
      if (waypoints.length === 0) return;

      const activeWaypointIndex = findActiveWaypointIndex(aircraft, waypoints);
      const { coords, validWaypoints } = getUnwrappedWaypointCoords(
        waypoints,
        aircraft.lon,
      );
      const routeCoords = coords.map(
        ([lat, lon]) => [lon, lat] as [number, number],
      );
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

interface GlobeControlButtonProps {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function GlobeControlButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
}: GlobeControlButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-md border text-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.28)] transition-all duration-200 ${
        active
          ? "border-cyan-300/80 bg-cyan-500/20 shadow-[0_0_14px_rgba(34,211,238,0.48)]"
          : "border-cyan-400/30 bg-black/70 hover:border-cyan-300/60 hover:bg-cyan-500/10"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

const MobileGlobeMap: React.FC<MapComponentProps> = ({
  aircrafts,
  runways = [],
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
  mapRenderer = "globe",
  onMapRendererChange,
  showDesktopControls = false,
  showLeftControls = showDesktopControls,
  hideUi = false,
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
  const headingStartPointRef = useRef<maplibregl.LngLat | null>(null);
  const headingPopupRef = useRef<maplibregl.Popup | null>(null);
  const waypointSignatureRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [isRadarMode, setIsRadarMode] = useState(() =>
    getBooleanCookie("map_radar_mode", false),
  );
  const [isOSMMode, setIsOSMMode] = useState(() =>
    getBooleanCookie("map_osm_mode", false),
  );
  const [isOpenAIPEnabled, setIsOpenAIPEnabled] = useState(() =>
    getBooleanCookie("map_openaip", false),
  );
  const [showWaypoints, setShowWaypoints] = useState(() =>
    getBooleanCookie("map_waypoints", false),
  );
  const [showPrecipitation, setShowPrecipitation] = useState(() =>
    getBooleanCookie("weather_precipitation", false),
  );
  const [showAirmets, setShowAirmets] = useState(() =>
    getBooleanCookie("weather_airmets", false),
  );
  const [showSigmets, setShowSigmets] = useState(() =>
    getBooleanCookie("weather_sigmets", false),
  );
  const [showConflicts, setShowConflicts] = useState(() =>
    getBooleanCookie("traffic_conflicts", false),
  );
  const [showTags, setShowTags] = useState(true);
  const [radarTrailPreferences, setRadarTrailPreferences] = useState(() =>
    getStoredRadarTrailPreferences(),
  );
  const [radarModeLinePreferences, setRadarModeLinePreferences] = useState(() =>
    getStoredRadarModeLinePreferences(),
  );
  const [runwayCenterlinePreferences, setRunwayCenterlinePreferences] =
    useState(() => getStoredRunwayCenterlinePreferences());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHeadingMode, setIsHeadingMode] = useState(false);
  const [layerPresets, setLayerPresets] = useState(() =>
    getStoredMapLayerPresets(),
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isDesktopGlobe] = useState(showDesktopControls);
  const [viewportRevision, setViewportRevision] = useState(0);

  const { isProUser } = useProStatus();
  const { speedUnit, altitudeUnit } = useUnitPreferences();
  const canUseRadarMode = isProUser;
  const shouldShowLeftControls = showLeftControls;
  const defaultZoom = isDesktopGlobe
    ? DESKTOP_DEFAULT_ZOOM
    : MOBILE_DEFAULT_ZOOM;
  const minZoom = isDesktopGlobe ? DESKTOP_MIN_ZOOM : MOBILE_MIN_ZOOM;
  const userLocationResetZoom = isDesktopGlobe
    ? DESKTOP_USER_LOCATION_RESET_ZOOM
    : MOBILE_USER_LOCATION_RESET_ZOOM;
  const zoomCookieKey = isDesktopGlobe
    ? DESKTOP_COOKIE_ZOOM
    : MOBILE_COOKIE_ZOOM;
  const latCookieKey = isDesktopGlobe ? DESKTOP_COOKIE_LAT : MOBILE_COOKIE_LAT;
  const lngCookieKey = isDesktopGlobe ? DESKTOP_COOKIE_LNG : MOBILE_COOKIE_LNG;

  const selectedAircraftKeySet = useMemo(
    () => new Set(selectedAircraftIds),
    [selectedAircraftIds],
  );

  useEffect(() => {
    if (isDesktopGlobe || selectedAircraftIds.length > 0) return;
    setIsSettingsOpen(false);
  }, [isDesktopGlobe, selectedAircraftIds]);

  const currentLayerState = useMemo<MapLayerPresetState>(
    () => ({
      baseLayer: isRadarMode ? "radar" : isOSMMode ? "osm" : "satellite",
      mapRenderer,
      openAIP: isOpenAIPEnabled,
      runwayCenterlines: runwayCenterlinePreferences.enabled,
      waypoints: showWaypoints,
      precipitation: showPrecipitation,
      airmets: showAirmets,
      sigmets: showSigmets,
      conflicts: showConflicts,
    }),
    [
      isOpenAIPEnabled,
      isOSMMode,
      isRadarMode,
      mapRenderer,
      runwayCenterlinePreferences.enabled,
      showWaypoints,
      showAirmets,
      showConflicts,
      showPrecipitation,
      showSigmets,
    ],
  );

  const activePreset = useMemo(
    () =>
      layerPresets.find((preset) =>
        mapLayerPresetStateEquals(preset, currentLayerState, {
          allowLegacyRendererMatch: true,
        }),
      ) ?? null,
    [currentLayerState, layerPresets],
  );

  const baseLayerMode = useMemo(
    () => getBaseLayerMode(isRadarMode, isOSMMode),
    [isOSMMode, isRadarMode],
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

  useEffect(() => {
    setStoredMapLayerPresets(layerPresets);
  }, [layerPresets]);

  useEffect(() => {
    setSelectedPresetId((current) => {
      if (activePreset?.id) {
        return activePreset.id;
      }

      if (current && layerPresets.some((preset) => preset.id === current)) {
        return current;
      }

      return null;
    });
  }, [activePreset, layerPresets]);

  const updateBaseLayerVisibility = useCallback(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded() !== true) return;

    if (map.getLayer(BASE_LAYER_IDS.satellite)) {
      map.removeLayer(BASE_LAYER_IDS.satellite);
    }
    if (map.getSource("satellite")) {
      map.removeSource("satellite");
    }

    const satelliteBeforeLayer = map.getLayer(BASE_LAYER_IDS.openAip)
      ? BASE_LAYER_IDS.openAip
      : FIRST_OVERLAY_LAYER_ID;

    map.addSource("satellite", getBaseSourceSpec(baseLayerMode));
    map.addLayer(
      {
        id: BASE_LAYER_IDS.satellite,
        type: "raster",
        source: "satellite",
        paint: getBaseLayerPaint(baseLayerMode),
      },
      satelliteBeforeLayer,
    );
  }, [baseLayerMode]);

  const clearHeadingMeasurement = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      setSourceData(map, SOURCE_IDS.headingLine, emptyFeatureCollection());
      setSourceData(map, SOURCE_IDS.headingStart, emptyFeatureCollection());
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
    }

    headingPopupRef.current?.remove();
    headingPopupRef.current = null;
    headingStartPointRef.current = null;
  }, []);

  const toggleRadarMode = useCallback(() => {
    if (!canUseRadarMode) {
      Analytics.upgradeButtonClicked({
        source: "globe_radar_mode_control",
        feature: "radar_mode_layer",
      });
      window.location.href = "/pricing";
      return;
    }

    setIsRadarMode((prev) => {
      const next = !prev;
      if (next) {
        setIsOSMMode(false);
      }
      Analytics.mapModeChanged({
        mode: next ? "radar" : isOSMMode ? "osm" : "satellite",
      });
      return next;
    });
  }, [canUseRadarMode, isOSMMode]);

  const toggleOSMMode = useCallback(() => {
    setIsOSMMode((prev) => {
      const next = !prev;
      if (next) {
        setIsRadarMode(false);
      }
      Analytics.mapModeChanged({
        mode: next ? "osm" : isRadarMode ? "radar" : "satellite",
      });
      return next;
    });
  }, [isRadarMode]);

  const toggleOpenAIPMode = useCallback(() => {
    setIsOpenAIPEnabled((prev) => !prev);
  }, []);

  const zoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 250 });
  }, []);

  const zoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 250 });
  }, []);

  const toggleHeadingMode = useCallback(() => {
    setIsSettingsOpen(false);
    setIsHeadingMode((prev) => {
      const next = !prev;
      if (!next) {
        clearHeadingMeasurement();
      }
      Analytics.headingModeToggled({ enabled: next });
      return next;
    });
  }, [clearHeadingMeasurement]);

  const applyLayerPreset = useCallback(
    (presetId: string) => {
      const preset = layerPresets.find((entry) => entry.id === presetId);
      if (!preset) return;

      const nextRunwayCenterlines =
        canUseRadarMode && (preset.runwayCenterlines ?? false);

      setBooleanCookie("map_radar_mode", preset.baseLayer === "radar");
      setBooleanCookie("map_osm_mode", preset.baseLayer === "osm");
      setBooleanCookie("map_openaip", preset.openAIP);
      setRunwayCenterlinePreferences((currentPreferences) =>
        setStoredRunwayCenterlinePreferences({
          ...currentPreferences,
          enabled: nextRunwayCenterlines,
        }),
      );
      setBooleanCookie("map_waypoints", preset.waypoints ?? false);
      setBooleanCookie("weather_precipitation", preset.precipitation);
      setBooleanCookie("weather_airmets", preset.airmets);
      setBooleanCookie("weather_sigmets", preset.sigmets);
      setBooleanCookie("traffic_conflicts", preset.conflicts);

      setIsRadarMode(preset.baseLayer === "radar");
      setIsOSMMode(preset.baseLayer === "osm");
      setIsOpenAIPEnabled(preset.openAIP);
      setShowWaypoints(preset.waypoints ?? false);
      setShowPrecipitation(preset.precipitation);
      setShowAirmets(preset.airmets);
      setShowSigmets(preset.sigmets);
      setShowConflicts(preset.conflicts);
      setSelectedPresetId(presetId);

      if (
        preset.mapRenderer &&
        onMapRendererChange &&
        preset.mapRenderer !== mapRenderer
      ) {
        onMapRendererChange(preset.mapRenderer);
      }
    },
    [canUseRadarMode, layerPresets, mapRenderer, onMapRendererChange],
  );

  const saveLayerPreset = useCallback(
    (name: string) => {
      const normalizedName = name.trim();
      if (!normalizedName) {
        return { ok: false as const, error: "Enter a preset name" };
      }

      const duplicateState = layerPresets.find((preset) =>
        mapLayerPresetStateEquals(preset, currentLayerState),
      );
      if (duplicateState) {
        return {
          ok: false as const,
          error: `Current setup already matches ${duplicateState.name}`,
        };
      }

      const preset = createMapLayerPreset(normalizedName, currentLayerState);
      setLayerPresets((prev) =>
        [...prev, preset].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      setSelectedPresetId(preset.id);
      toast.success(`Saved preset: ${preset.name}`);
      return { ok: true as const };
    },
    [currentLayerState, layerPresets],
  );

  const updateLayerPreset = useCallback(
    (presetId: string) => {
      const preset = layerPresets.find((entry) => entry.id === presetId);
      if (!preset) return;

      setLayerPresets((prev) =>
        prev.map((entry) =>
          entry.id === presetId
            ? { ...entry, ...currentLayerState, updatedAt: Date.now() }
            : entry,
        ),
      );
      toast.success(`Updated preset: ${preset.name}`);
    },
    [currentLayerState, layerPresets],
  );

  const deleteLayerPreset = useCallback(
    (presetId: string) => {
      const preset = layerPresets.find((entry) => entry.id === presetId);
      if (!preset) return;

      setLayerPresets((prev) => prev.filter((entry) => entry.id !== presetId));
      setSelectedPresetId((current) => (current === presetId ? null : current));
      toast.success(`Deleted preset: ${preset.name}`);
    },
    [layerPresets],
  );

  const resetMapView = useCallback(
    (targetLocation?: MapResetLocation | null) => {
      const map = mapRef.current;
      if (!map) return;

      const center: [number, number] = targetLocation
        ? [targetLocation.lng, targetLocation.lat]
        : DEFAULT_CENTER;
      const zoom = targetLocation ? userLocationResetZoom : defaultZoom;

      map.easeTo({
        center,
        zoom,
        pitch: 0,
        bearing: 0,
        duration: 800,
      });
      setCookie(zoomCookieKey, String(zoom));
      setCookie(latCookieKey, String(center[1]));
      setCookie(lngCookieKey, String(center[0]));
    },
    [
      defaultZoom,
      latCookieKey,
      lngCookieKey,
      userLocationResetZoom,
      zoomCookieKey,
    ],
  );

  useEffect(() => {
    onLayerModeChange?.(isRadarMode || isOSMMode);
  }, [isOSMMode, isRadarMode, onLayerModeChange]);

  useEffect(() => {
    setBooleanCookie("map_radar_mode", isRadarMode);
  }, [isRadarMode]);

  useEffect(() => {
    setBooleanCookie("map_osm_mode", isOSMMode);
  }, [isOSMMode]);

  useEffect(() => {
    setBooleanCookie("map_openaip", isOpenAIPEnabled);
  }, [isOpenAIPEnabled]);

  useEffect(() => {
    setBooleanCookie("map_waypoints", showWaypoints);
  }, [showWaypoints]);

  useEffect(() => {
    setBooleanCookie("weather_precipitation", showPrecipitation);
  }, [showPrecipitation]);

  useEffect(() => {
    setBooleanCookie("weather_airmets", showAirmets);
  }, [showAirmets]);

  useEffect(() => {
    setBooleanCookie("weather_sigmets", showSigmets);
  }, [showSigmets]);

  useEffect(() => {
    setBooleanCookie("traffic_conflicts", showConflicts);
  }, [showConflicts]);

  useEffect(() => {
    if (!shouldShowLeftControls || hideUi) {
      setIsSettingsOpen(false);
      setIsHeadingMode(false);
      clearHeadingMeasurement();
    }
  }, [clearHeadingMeasurement, hideUi, shouldShowLeftControls]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true";

      if ((event.key === "l" || event.key === "L") && !isInputFocused) {
        setShowTags((prev) => !prev);
      }
      if (
        !hideUi &&
        (event.key === "t" || event.key === "T") &&
        !isInputFocused
      ) {
        setIsHeadingMode(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hideUi]);

  const mapStyle = useMemo(
    () => buildBaseStyle(baseLayerMode, isOpenAIPEnabled, minZoom),
    [baseLayerMode, isOpenAIPEnabled, minZoom],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const savedZoom = Number.parseFloat(getCookie(zoomCookieKey) ?? "");
    const savedLat = Number.parseFloat(getCookie(latCookieKey) ?? "");
    const savedLng = Number.parseFloat(getCookie(lngCookieKey) ?? "");

    const initialCenter: [number, number] =
      Number.isFinite(savedLng) && Number.isFinite(savedLat)
        ? [savedLng, savedLat]
        : DEFAULT_CENTER;
    const initialZoom = Number.isFinite(savedZoom)
      ? Math.min(MAX_ZOOM, Math.max(minZoom, savedZoom))
      : defaultZoom;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      minZoom,
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
      map.addSource(SOURCE_IDS.radarTrails, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.radarModeLines, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.runwayCenterlines, {
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
      map.addSource(SOURCE_IDS.headingLine, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.headingStart, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
      map.addSource(SOURCE_IDS.worldWaypoints, {
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
        id: "mobile-globe-radar-mode-lines",
        type: "line",
        source: SOURCE_IDS.radarModeLines,
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#22d3ee"],
          "line-width": ["coalesce", ["get", "width"], 1.5],
          "line-opacity": ["coalesce", ["get", "opacity"], 0.72],
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });

      map.addLayer({
        id: "mobile-globe-runway-centerlines",
        type: "line",
        source: SOURCE_IDS.runwayCenterlines,
        minzoom: RUNWAY_CENTERLINE_MIN_ZOOM,
        paint: {
          "line-color": "#f8fafc",
          "line-width": 1.2,
          "line-opacity": 0.45,
          "line-dasharray": [7, 9],
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });

      map.addLayer({
        id: "mobile-globe-radar-trails",
        type: "circle",
        source: SOURCE_IDS.radarTrails,
        paint: {
          "circle-color": RADAR_TRAIL_COLOR,
          "circle-radius": ["coalesce", ["get", "radius"], 2],
          "circle-opacity": ["coalesce", ["get", "opacity"], 0.5],
          "circle-stroke-color": RADAR_TRAIL_COLOR,
          "circle-stroke-opacity": ["coalesce", ["get", "opacity"], 0.5],
          "circle-stroke-width": 0.6,
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
        id: "mobile-globe-selected-airport-radius-fill",
        type: "fill",
        source: SOURCE_IDS.selectedAirport,
        paint: {
          "fill-color": "#22d3ee",
          "fill-opacity": 0.07,
        },
      });

      map.addLayer({
        id: "mobile-globe-selected-airport-radius-outline",
        type: "line",
        source: SOURCE_IDS.selectedAirport,
        paint: {
          "line-color": "#22d3ee",
          "line-width": 2,
          "line-opacity": 0.8,
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
          "circle-radius": ["case", ["==", ["get", "active"], true], 7, 5],
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
        id: "mobile-globe-world-waypoints",
        type: "circle",
        source: SOURCE_IDS.worldWaypoints,
        minzoom: MIN_WAYPOINT_ZOOM,
        paint: {
          "circle-radius": 4,
          "circle-color": "#7df9ff",
          "circle-stroke-color": "rgba(0, 10, 15, 0.9)",
          "circle-stroke-width": 1.4,
          "circle-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "mobile-globe-world-waypoint-labels",
        type: "symbol",
        source: SOURCE_IDS.worldWaypoints,
        minzoom: MIN_WAYPOINT_ZOOM,
        layout: {
          "text-field": ["get", "ident"],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-size": 10,
          "text-offset": [0.8, 0],
          "text-anchor": "left",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        },
        paint: {
          "text-color": "#d2fcff",
          "text-halo-color": "rgba(0, 10, 15, 0.95)",
          "text-halo-width": 1.4,
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

      map.addLayer({
        id: "mobile-globe-heading-line",
        type: "line",
        source: SOURCE_IDS.headingLine,
        paint: {
          "line-color": "#22d3ee",
          "line-width": 2.5,
          "line-opacity": 0.9,
          "line-dasharray": [3, 2],
        },
      });

      map.addLayer({
        id: "mobile-globe-heading-start",
        type: "circle",
        source: SOURCE_IDS.headingStart,
        paint: {
          "circle-radius": 5,
          "circle-color": "#22d3ee",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ecfeff",
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
      setCookie(zoomCookieKey, String(map.getZoom()));
      setCookie(latCookieKey, String(center.lat));
      setCookie(lngCookieKey, String(center.lng));
      setViewportRevision((current) => current + 1);
    });

    map.on("click", (event) => {
      const target = event.originalEvent.target;
      if (
        target instanceof HTMLElement &&
        target.closest("[data-aircraft-marker]")
      ) {
        return;
      }
      setIsSettingsOpen(false);
      onAircraftSelectRef.current(null);
    });

    return () => {
      aircraftMarkers.forEach(({ marker }) => marker.remove());
      aircraftMarkers.clear();
      headingPopupRef.current?.remove();
      headingPopupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [
    defaultZoom,
    isOpenAIPEnabled,
    latCookieKey,
    lngCookieKey,
    mapStyle,
    minZoom,
    updateBaseLayerVisibility,
    zoomCookieKey,
  ]);

  useEffect(() => {
    updateBaseLayerVisibility();
  }, [updateBaseLayerVisibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!map.getLayer(BASE_LAYER_IDS.openAip)) return;

    map.setLayoutProperty(
      BASE_LAYER_IDS.openAip,
      "visibility",
      isOpenAIPEnabled ? "visible" : "none",
    );
    map.setPaintProperty(
      BASE_LAYER_IDS.openAip,
      "raster-opacity",
      isOpenAIPEnabled ? 0.9 : 0,
    );
  }, [isOpenAIPEnabled, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const clearWaypoints = () => {
      waypointSignatureRef.current = "";
      setSourceData(map, SOURCE_IDS.worldWaypoints, emptyFeatureCollection());
    };
    const isStaleWaypointLoad = () => cancelled || mapRef.current !== map;

    const loadWaypoints = () => {
      if (!showWaypoints || map.getZoom() < MIN_WAYPOINT_ZOOM) {
        clearWaypoints();
        return;
      }

      const bounds = map.getBounds();
      const signature = `${bounds.getSouth().toFixed(2)}:${bounds.getWest().toFixed(2)}:${bounds.getNorth().toFixed(2)}:${bounds.getEast().toFixed(2)}:${Math.floor(map.getZoom())}`;
      if (signature === waypointSignatureRef.current) return;
      waypointSignatureRef.current = signature;

      loadNavFixes()
        .then((fixes) => {
          if (isStaleWaypointLoad()) return;

          const features = filterNavFixesInBounds(
            fixes,
            buildWaypointBoundsParams(map),
            MAX_RENDERED_WAYPOINTS,
          )
            .filter((fix) => isValidCoordinate(fix.lat, fix.lon))
            .map((fix) =>
              buildPointFeature(fix.lon, fix.lat, {
                ident: fix.ident,
              }),
            );

          setSourceData(map, SOURCE_IDS.worldWaypoints, {
            type: "FeatureCollection",
            features,
          });
        })
        .catch(() => {
          if (isStaleWaypointLoad()) return;

          setSourceData(
            map,
            SOURCE_IDS.worldWaypoints,
            emptyFeatureCollection(),
          );
        });
    };

    const scheduleLoad = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(loadWaypoints, WAYPOINT_QUERY_DEBOUNCE_MS);
    };

    scheduleLoad();
    map.on("moveend", scheduleLoad);
    map.on("zoomend", scheduleLoad);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      if (mapRef.current === map) {
        map.off("moveend", scheduleLoad);
        map.off("zoomend", scheduleLoad);
        clearWaypoints();
      } else {
        waypointSignatureRef.current = "";
      }
    };
  }, [mapReady, showWaypoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!isHeadingMode) {
      clearHeadingMeasurement();
      return;
    }

    map.getCanvas().style.cursor = HEADING_MODE_CURSOR;

    const handleMouseDown = (event: maplibregl.MapMouseEvent) => {
      headingStartPointRef.current = event.lngLat;
      map.dragPan.disable();
      setSourceData(map, SOURCE_IDS.headingStart, {
        type: "FeatureCollection",
        features: [buildPointFeature(event.lngLat.lng, event.lngLat.lat)],
      });
      setSourceData(map, SOURCE_IDS.headingLine, emptyFeatureCollection());
    };

    const handleMouseMove = (event: maplibregl.MapMouseEvent) => {
      const start = headingStartPointRef.current;
      if (!start) return;

      const end = event.lngLat;
      const line = buildLineFeature([
        [start.lng, start.lat],
        [end.lng, end.lat],
      ]);
      setSourceData(map, SOURCE_IDS.headingLine, {
        type: "FeatureCollection",
        features: line ? [line] : [],
      });

      const heading = calculateBearing(start.lat, start.lng, end.lat, end.lng);
      const distanceKm = calculateDistance(
        start.lat,
        start.lng,
        end.lat,
        end.lng,
        "km",
      );
      const distanceMiles = calculateDistance(
        start.lat,
        start.lng,
        end.lat,
        end.lng,
        "miles",
      );

      if (!headingPopupRef.current) {
        headingPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 18,
          className: "globe-heading-popup",
        });
      }

      headingPopupRef.current
        .setLngLat(end)
        .setHTML(
          `<div>
            <div class="globe-heading-popup__heading">Heading: ${heading.toFixed(1)}°</div>
            <div class="globe-heading-popup__distance">Distance: ${distanceKm.toFixed(1)} km / ${distanceMiles.toFixed(1)} mi</div>
          </div>`,
        )
        .addTo(map);
    };

    const handleMouseUp = () => {
      clearHeadingMeasurement();
      setIsHeadingMode(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clearHeadingMeasurement();
      setIsHeadingMode(false);
    };

    map.on("mousedown", handleMouseDown);
    map.on("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleEscape);

    return () => {
      map.off("mousedown", handleMouseDown);
      map.off("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleEscape);
      clearHeadingMeasurement();
    };
  }, [clearHeadingMeasurement, isHeadingMode, mapReady]);

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
          syncAircraftMarkerElement(
            element,
            aircraft,
            isRadarMode,
            isSelected,
            showTags,
            selectedAircraftKeySet.size > 0,
            isDesktopGlobe,
            speedUnit,
            altitudeUnit,
          );
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            const target = event.currentTarget as HTMLButtonElement;
            const key = target.dataset.aircraftKey;
            if (!key) return;
            onAircraftSelectRef.current(
              aircraftLookupRef.current.get(key) ?? null,
              false,
            );
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

        syncAircraftMarkerElement(
          existing.element,
          aircraft,
          isRadarMode,
          isSelected,
          showTags,
          selectedAircraftKeySet.size > 0,
          isDesktopGlobe,
          speedUnit,
          altitudeUnit,
        );
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
  }, [
    aircrafts,
    altitudeUnit,
    isRadarMode,
    isDesktopGlobe,
    mapReady,
    onInitialTrafficPaint,
    selectedAircraftKeySet,
    showTags,
    speedUnit,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (
      !selectedAirport ||
      !isValidCoordinate(selectedAirport.lat, selectedAirport.lon)
    ) {
      setSourceData(map, SOURCE_IDS.selectedAirport, emptyFeatureCollection());
      return;
    }

    setSourceData(map, SOURCE_IDS.selectedAirport, {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              createGeodesicCircle(
                selectedAirport.lat,
                selectedAirport.lon,
                SELECTED_AIRPORT_RADIUS_MILES,
              ),
            ],
          },
          properties: {
            icao: selectedAirport.icao,
          },
        },
        buildPointFeature(selectedAirport.lon, selectedAirport.lat, {
          icao: selectedAirport.icao,
        }),
      ],
    });
  }, [mapReady, selectedAirport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (
      !isRadarMode ||
      !runwayCenterlinePreferences.enabled ||
      map.getZoom() < RUNWAY_CENTERLINE_MIN_ZOOM
    ) {
      setSourceData(
        map,
        SOURCE_IDS.runwayCenterlines,
        emptyFeatureCollection(),
      );
      return;
    }

    const bounds = map.getBounds();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const lonInBounds = (lon: number) =>
      west <= east ? lon >= west && lon <= east : lon >= west || lon <= east;
    const pointInBounds = (lat: number, lon: number) =>
      lat >= south && lat <= north && lonInBounds(lon);
    const pathInBounds = (path: [number, number][]) => {
      if (path.some(([lat, lon]) => pointInBounds(lat, lon))) return true;

      const lats = path.map(([lat]) => lat);
      const lons = path.map(([, lon]) => lon);
      const pathSouth = Math.min(...lats);
      const pathNorth = Math.max(...lats);
      const pathWest = Math.min(...lons);
      const pathEast = Math.max(...lons);

      return (
        pathNorth >= south &&
        pathSouth <= north &&
        pathEast >= west &&
        pathWest <= east
      );
    };

    const features = runways.flatMap((runway) => {
      const centerlinePaths = buildRunwayCenterlinePaths(
        runway,
        runwayCenterlinePreferences,
      );

      if (!centerlinePaths.some(pathInBounds)) {
        return [];
      }

      return centerlinePaths.flatMap((path) => {
        const line = buildLineFeature(toLngLatCoords(path), {
          airport: runway.airportIdent,
          runway: `${runway.leIdent}/${runway.heIdent}`,
        });
        return line ? [line] : [];
      });
    });

    setSourceData(map, SOURCE_IDS.runwayCenterlines, {
      type: "FeatureCollection",
      features,
    });
  }, [
    isRadarMode,
    mapReady,
    runwayCenterlinePreferences,
    runways,
    viewportRevision,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!isRadarMode || !radarModeLinePreferences.enabled) {
      setSourceData(map, SOURCE_IDS.radarModeLines, emptyFeatureCollection());
      return;
    }

    const features = aircrafts.flatMap((aircraft) => {
      const aircraftKey = aircraft.callsign || aircraft.id;
      const line = buildLineFeature(
        toLngLatCoords(
          buildRadarModeLinePath(aircraft, radarModeLinePreferences),
        ),
        getRadarModeLineStyle(
          aircraft,
          selectedAircraftKeySet.has(aircraftKey),
        ),
      );
      return line ? [line] : [];
    });

    setSourceData(map, SOURCE_IDS.radarModeLines, {
      type: "FeatureCollection",
      features,
    });
  }, [
    aircrafts,
    isRadarMode,
    mapReady,
    radarModeLinePreferences,
    selectedAircraftKeySet,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!isRadarMode || !radarTrailPreferences.enabled) {
      setSourceData(map, SOURCE_IDS.radarTrails, emptyFeatureCollection());
      return;
    }

    const features = aircrafts.flatMap((aircraft) =>
      buildRadarTrailDots(aircraft, radarTrailPreferences)
        .filter((dot) => isValidCoordinate(dot.lat, dot.lon))
        .map((dot) =>
          buildPointFeature(dot.lon, dot.lat, {
            radius: dot.radius,
            opacity: dot.opacity,
          }),
        ),
    );

    setSourceData(map, SOURCE_IDS.radarTrails, {
      type: "FeatureCollection",
      features,
    });
  }, [aircrafts, isRadarMode, mapReady, radarTrailPreferences]);

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
      setSourceData(
        map,
        SOURCE_IDS.importedFlightPlan,
        emptyFeatureCollection(),
      );
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
    <>
      <div
        ref={mapContainerRef}
        className={`h-full w-full bg-[#020814] transition-opacity duration-300 ${
          isMapVisible ? "opacity-100" : "opacity-0"
        }`}
      />

      {shouldShowLeftControls && !hideUi ? (
        <>
          <div
            className={`absolute left-3 z-[10018] flex flex-col gap-2 ${
              isDesktopGlobe ? "top-[92px]" : "top-[64px]"
            }`}
          >
            <GlobeControlButton title="Zoom in" onClick={zoomIn}>
              <Plus size={18} strokeWidth={1.8} />
            </GlobeControlButton>
            <GlobeControlButton title="Zoom out" onClick={zoomOut}>
              <Minus size={18} strokeWidth={1.8} />
            </GlobeControlButton>
            <GlobeControlButton
              title="Heading mode"
              active={isHeadingMode}
              onClick={toggleHeadingMode}
            >
              <Crosshair size={18} strokeWidth={1.8} />
            </GlobeControlButton>
            <GlobeControlButton
              title={canUseRadarMode ? "Radar mode" : "Radar mode (PRO)"}
              active={isRadarMode}
              onClick={toggleRadarMode}
            >
              <Image
                src="/icons/radar.svg"
                alt=""
                width={18}
                height={18}
                style={{
                  filter:
                    "brightness(0) saturate(100%) invert(79%) sepia(44%) saturate(1177%) hue-rotate(152deg) brightness(98%) contrast(90%)",
                }}
              />
            </GlobeControlButton>
            <GlobeControlButton
              title="OpenStreetMap"
              active={isOSMMode}
              onClick={toggleOSMMode}
            >
              <Image src="/icons/OSM.svg" alt="" width={18} height={18} />
            </GlobeControlButton>
            <GlobeControlButton
              title="OpenAIP overlay"
              active={isOpenAIPEnabled}
              onClick={toggleOpenAIPMode}
            >
              <Globe2 size={18} strokeWidth={1.8} />
            </GlobeControlButton>
            <GlobeControlButton
              title="Map settings"
              active={isSettingsOpen}
              onClick={() => setIsSettingsOpen((prev) => !prev)}
            >
              <Settings2 size={18} strokeWidth={1.8} />
            </GlobeControlButton>
          </div>

          {!hideUi ? (
            <MapSettingsSidebar
              isOpen={isSettingsOpen}
              isMobile={!isDesktopGlobe}
              onClose={() => setIsSettingsOpen(false)}
            >
              <RadarSettings
                isPRO={isProUser}
                mapRenderer={mapRenderer}
                onMapRendererChange={onMapRendererChange}
                radarTrailPreferences={radarTrailPreferences}
                radarModeLinePreferences={radarModeLinePreferences}
                runwayCenterlinePreferences={runwayCenterlinePreferences}
                onRadarTrailPreferencesChange={(nextPreferences) => {
                  setRadarTrailPreferences(
                    setStoredRadarTrailPreferences(nextPreferences),
                  );
                }}
                onRadarModeLinePreferencesChange={(nextPreferences) => {
                  setRadarModeLinePreferences(
                    setStoredRadarModeLinePreferences(nextPreferences),
                  );
                }}
                onRunwayCenterlinePreferencesChange={(nextPreferences) => {
                  setRunwayCenterlinePreferences(
                    setStoredRunwayCenterlinePreferences(nextPreferences),
                  );
                }}
                presets={layerPresets}
                activePresetId={activePreset?.id ?? null}
                selectedPresetId={selectedPresetId}
                onApplyPreset={applyLayerPreset}
                onSavePreset={saveLayerPreset}
                onUpdatePreset={updateLayerPreset}
                onDeletePreset={deleteLayerPreset}
                showWaypoints={showWaypoints}
                setShowWaypoints={setShowWaypoints}
                showPrecipitation={showPrecipitation}
                setShowPrecipitation={setShowPrecipitation}
                showAirmets={showAirmets}
                setShowAirmets={setShowAirmets}
                showSigmets={showSigmets}
                setShowSigmets={setShowSigmets}
                showConflicts={showConflicts}
                setShowConflicts={setShowConflicts}
              />
            </MapSettingsSidebar>
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default MobileGlobeMap;
