import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type PositionUpdate } from '~/lib/aircraft-store';

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
  frequencies?: Array<{ type: string; frequency: string }>;
}

interface MapComponentProps {
  aircrafts: PositionUpdate[];
  airports: Airport[];
  onAircraftSelect: (aircraft: PositionUpdate | null) => void;
  selectedWaypointIndex?: number | null;
  selectedAirport?: Airport | undefined;
  setDrawFlightPlanOnMap: (
    func: (aircraft: PositionUpdate, shouldZoom?: boolean) => void
  ) => void;
}

let mapInstance: L.Map | null = null;
let flightPlanLayerGroup: L.LayerGroup | null = null;
let aircraftMarkersLayer: L.LayerGroup | null = null;
let airportMarkersLayer: L.LayerGroup | null = null;
let historyLayerGroup: L.LayerGroup | null = null;

let satelliteHybridLayer: L.TileLayer | null = null;
let radarBaseLayer: L.TileLayer | null = null;

const aircraftHistoryRef = { current: new Map<string, L.LatLngTuple[]>() };

const WaypointIcon = L.divIcon({
  html: `
    <div style="
      width: 12px;
      height: 12px;
      background-color: #f542e3;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(245, 66, 227, 0.8), 0 0 4px rgba(0,0,0,0.5);
    "></div>
  `,
  className: 'leaflet-waypoint-icon',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const ActiveWaypointIcon = L.divIcon({
  html: `
    <div style="
      width: 16px;
      height: 16px;
      background: linear-gradient(135deg, #00ff00 0%, #00cc00 100%);
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 12px rgba(0, 255, 0, 0.9), 0 0 6px rgba(0,0,0,0.5);
      animation: pulse-waypoint 1.5s ease-in-out infinite;
    "></div>
    <style>
      @keyframes pulse-waypoint {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.8; }
      }
    </style>
  `,
  className: 'leaflet-active-waypoint-icon',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const RadarWaypointIcon = L.divIcon({
  html: `
    <div style="
      width: 6px;
      height: 6px;
      background-color: #00ffff;
      border: 1px solid #00ffff;
      border-radius: 50%;
      box-shadow: 0 0 4px rgba(0, 255, 255, 0.6);
    "></div>
  `,
  className: 'leaflet-radar-waypoint-icon',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

const RadarActiveWaypointIcon = L.divIcon({
  html: `
    <div style="
      width: 10px;
      height: 10px;
      background-color: #00ff00;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(0, 255, 0, 0.8);
      animation: pulse-radar-waypoint 1.5s ease-in-out infinite;
    "></div>
    <style>
      @keyframes pulse-radar-waypoint {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.7; }
      }
    </style>
  `,
  className: 'leaflet-radar-active-waypoint-icon',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const getAircraftDivIcon = (
  aircraft: PositionUpdate & { altMSL?: number }
) => {
  const iconUrl = 'https://i.ibb.co/6cNhyMMj/1.png';
  const planeSize = 30;
  const tagHeight = 45;
  const tagWidth = 150;
  const tagOffsetFromPlane = 15;

  const totalWidth = planeSize + tagOffsetFromPlane + tagWidth;
  const totalHeight = Math.max(planeSize, tagHeight);

  const anchorX = planeSize / 2;
  const anchorY = totalHeight / 2;

  const altMSL = aircraft.altMSL ?? aircraft.alt;
  const altAGL = aircraft.alt;
  const isOnGround = altAGL < 100;
  const displayAlt = isOnGround
    ? `${altAGL.toFixed(0)}ft AGL`
    : altMSL >= 18000
      ? `FL${Math.round(altMSL / 100)}`
      : `${altAGL.toFixed(0)}ft AGL`;

  const detailContent = `
    <div style="font-size: 12px; font-weight: bold; color: #fff;">
      ${aircraft.callsign || aircraft.flightNo || 'N/A'} (${
    aircraft.flightNo || 'N/A'
  })
    </div>
    <div style="font-size: 10px; opacity: 0.9;">
      ${displayAlt} | HDG ${aircraft.heading.toFixed(0)}° | ${aircraft.speed.toFixed(
    0
  )}kt
    </div>
    <div style="font-size: 10px; opacity: 0.8;">
      SQK: ${aircraft.squawk || 'N/A'} | ${aircraft.departure || 'UNK'} → ${
    aircraft.arrival || 'UNK'
  }
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px;">
        <img src="${iconUrl}"
             style="
               position: absolute;
               top: ${(totalHeight - planeSize) / 2}px;
               left: 0;
               width:${planeSize}px;
               height:${planeSize}px;
               transform:rotate(${aircraft.heading || 0}deg);
               transform-origin: 50% 50%;
               display: block;
               z-index: 2;
             "
             alt="${aircraft.callsign}"
        />
        <div class="aircraft-tag" style="
          position: absolute;
          top: ${(totalHeight - tagHeight) / 2}px;
          left: ${planeSize + tagOffsetFromPlane}px;
          width: ${tagWidth}px;
          padding: 4px 6px;
          background-color: rgba(0, 0, 0, 0.4);
          color: #fff;
          border-radius: 4px;
          white-space: normal;
          text-align: center;
          box-shadow: 0 1px 4px rgba(0,0,0,0.6);
          line-height: 1.3;
          z-index: 1000;
          pointer-events: none;
        ">
          ${detailContent}
        </div>
      </div>
    `,
    className: 'leaflet-aircraft-icon',
    iconSize: [totalWidth, totalHeight],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -planeSize / 2],
  });
};

const getRadarAircraftDivIcon = (
  aircraft: PositionUpdate & { altMSL?: number }
) => {
  const dotSize = 8;
  const headingLineLength = 15;
  const labelHeight = 35;
  const labelWidth = 100;
  // Offset label from the right edge of the dot
  const labelOffsetFromDot = 20;

  // Calculate total width based on dot, the longest possible extension for the line (or simply the dot's space)
  // and the label. The line's rotation means it could extend in any direction,
  // but for iconSize we need a bounding box. Let's assume the label is placed
  // to the right of the dot, and the line rotates from the dot.
  // The icon's 'width' needs to accommodate the dot, any max line extension, and the label.
  // For a simple dot + line + label, a static totalWidth might be easier, but remember
  // the line's rotation means it might extend left or right from the dot's center.
  // However, Leaflet's `iconSize` acts as the overall bounding box for the entire HTML.
  // The `totalWidth` needs to be large enough to contain the dot + line + label
  // when the line is at its most "right-pointing" for positioning the label.
  // For the actual `iconSize`, it would be more accurate to calculate the bounding
  // box of the dot and the rotated line, but for this setup, the label drives the width.

  const totalEffectiveWidthForPositioning = dotSize + labelOffsetFromDot + labelWidth;
  const totalWidth = Math.max(
    totalEffectiveWidthForPositioning,
    dotSize + headingLineLength // Ensure space for the line
  );
  const totalHeight = Math.max(dotSize, labelHeight, headingLineLength); // Also ensure height for line if it points up/down

  const anchorX = dotSize / 2; // Anchor at the center of the dot
  const anchorY = totalHeight / 2;

  const altMSL = aircraft.altMSL ?? aircraft.alt;
  const altAGL = aircraft.alt;
  const isOnGround = altAGL < 100;
  const displayAlt = isOnGround
    ? `${altAGL.toFixed(0)}AGL`
    : altMSL >= 18000
      ? `FL${Math.round(altMSL / 100)}`
      : `${altAGL.toFixed(0)}AGL`;

  const detailContent = `
    <div style="font-weight: bold;">
      ${aircraft.flightNo || aircraft.callsign || 'N/A'}
    </div>
    <div>
      ${displayAlt} ${aircraft.heading.toFixed(0)}°
    </div>
    <div>
      ${aircraft.speed.toFixed(0)}kt
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${totalWidth}px;
        height: ${totalHeight}px;
      ">
        <div style="
          position: absolute;
          /* Center the dot vertically within totalHeight */
          top: ${(totalHeight - dotSize) / 2}px;
          left: 0;
          width: ${dotSize}px;
          height: ${dotSize}px;
          background-color: #00ff00;
          border-radius: 50%;
          box-shadow: 0 0 5px rgba(0, 255, 0, 0.7);
          z-index: 2;
        "></div>

        <div style="
          position: absolute;
          /* Position the line so its origin (left-middle) is at the center of the dot */
          top: ${totalHeight / 2 - 1}px; /* Adjusted for line height 2px */
          left: ${dotSize / 2}px; /* Starts at the horizontal center of the dot */
          width: ${headingLineLength}px;
          height: 2px;
          background-color: #00ff00;
          transform-origin: 0% 50%; /* Rotate around its left-middle point */
          /* Convert aviation heading (0=N, 90=E) to CSS rotation (0=R, 90=D) */
          transform: rotate(${(aircraft.heading || 0) - 90}deg);
          z-index: 1;
        "></div>

        <div class="aircraft-label" style="
          position: absolute;
          /* Center label vertically relative to total height */
          top: ${(totalHeight - labelHeight) / 2}px;
          /* Position label relative to the right of the dot */
          left: ${dotSize + labelOffsetFromDot}px;
          width: ${labelWidth}px;
          padding: 2px 4px;
          background-color: rgba(0, 0, 0, 0.6);
          color: #00ff00;
          border: 1px solid #00ff00;
          border-radius: 2px;
          white-space: nowrap;
          text-align: left;
          font-family: 'monospace', 'Courier New', monospace;
          font-size: 10px;
          line-height: 1.2;
          box-shadow: 0 0 3px rgba(0,255,0,0.5);
          z-index: 1000;
          pointer-events: none;
        ">
          ${detailContent}
        </div>
      </div>
    `,
    className: 'leaflet-radar-aircraft-icon',
    // The iconSize should encompass all elements at their maximum extent.
    // If the label is always to the right, and the dot is at 0,0,
    // then the width is (dot + line in its longest horizontal state + label).
    // The height is the tallest element.
    iconSize: [dotSize + headingLineLength + labelOffsetFromDot + labelWidth, totalHeight],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -dotSize / 2],
  });
};

const AirportIcon = L.icon({
  iconUrl:
    'https://i0.wp.com/microshare.io/wp-content/uploads/2024/04/airport2-icon.png?resize=510%2C510&ssl=1',
  iconSize: [30, 30],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const RadarAirportIcon = L.divIcon({
  html: `
    <div style="
      width: 10px;
      height: 10px;
      background-color: #00ffff;
      border: 1px solid #00ffff;
      border-radius: 50%;
      box-shadow: 0 0 5px rgba(0, 255, 255, 0.7);
    "></div>
  `,
  className: 'leaflet-radar-airport-icon',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
});

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = toDeg(Math.atan2(y, x));

  return (θ + 360) % 360;
};

const findActiveWaypointIndex = (
  aircraft: PositionUpdate,
  waypoints: any[]
): number => {
  if (waypoints.length < 1) return -1;

  const currentLat = aircraft.lat;
  const currentLon = aircraft.lon;
  const currentHeading = aircraft.heading;

  let closestWaypointIndex = -1;
  let minDistanceKm = Infinity;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (!wp.lat || !wp.lon) continue;

    const distance = calculateDistance(currentLat, currentLon, wp.lat, wp.lon);

    if (distance < minDistanceKm) {
      minDistanceKm = distance;
      closestWaypointIndex = i;
    }
  }

  if (minDistanceKm > 100) {
    return -1;
  }

  if (minDistanceKm < 50 && closestWaypointIndex < waypoints.length - 1) {
    const nextWp = waypoints[closestWaypointIndex + 1];
    if (nextWp.lat && nextWp.lon) {
      const bearingToNext = calculateBearing(
        currentLat,
        currentLon,
        nextWp.lat,
        nextWp.lon
      );

      let headingDiff = Math.abs(currentHeading - bearingToNext);
      if (headingDiff > 180) headingDiff = 360 - headingDiff;

      if (headingDiff < 90) {
        return closestWaypointIndex + 1;
      }
    }
  }

  return closestWaypointIndex;
};

class HeadingModeControl extends L.Control {
  public options = {
    position: 'topleft' as L.ControlPosition,
  };
  public _container: HTMLDivElement | null = null;
  private _toggleHeadingMode: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClickHandler: (event: Event) => void;

  constructor(
    options: L.ControlOptions,
    toggleHeadingMode: React.Dispatch<React.SetStateAction<boolean>>
  ) {
    super(options);
    this._toggleHeadingMode = toggleHeadingMode;
    this._boundClickHandler = (event: Event) => {
      this._toggleHeadingMode((prev) => !prev);
    };
  }

  onAdd(map: L.Map): HTMLDivElement {
    const container = L.DomUtil.create('div');
    container.style.cssText = `
      width: 30px;
      height: 30px;
      line-height: 30px;
      text-align: center;
      cursor: pointer;
      background-color: white;
      border: 2px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.65);
      transition: all 0.2s ease;
      font-size: 16px;
      font-weight: bold;
    `;
    container.title = 'Toggle Heading Mode';
    container.innerHTML = '&#8599;';

    L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    L.DomEvent.on(container, 'click', L.DomEvent.preventDefault);
    L.DomEvent.on(container, 'click', this._boundClickHandler);
    this._container = container;
    return container;
  }

  onRemove(map: L.Map) {
    if (this._container) {
      L.DomEvent.off(this._container, 'click', this._boundClickHandler);
    }
  }

  updateState(enabled: boolean) {
    if (this._container) {
      if (enabled) {
        this._container.style.backgroundColor = '#3b82f6';
        this._container.style.color = 'white';
      } else {
        this._container.style.backgroundColor = 'white';
        this._container.style.color = 'black';
      }
    }
  }
}

class RadarModeControl extends L.Control {
  public options = {
    position: 'topleft' as L.ControlPosition,
  };
  public _container: HTMLDivElement | null = null;
  private _toggleRadarMode: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClickHandler: (event: Event) => void;

  constructor(
    options: L.ControlOptions,
    toggleRadarMode: React.Dispatch<React.SetStateAction<boolean>>
  ) {
    super(options);
    this._toggleRadarMode = toggleRadarMode;
    this._boundClickHandler = (event: Event) => {
      this._toggleRadarMode((prev) => !prev);
    };
  }

  onAdd(map: L.Map): HTMLDivElement {
    const container = L.DomUtil.create('div');
    container.style.cssText = `
      width: 30px;
      height: 30px;
      line-height: 30px;
      text-align: center;
      cursor: pointer;
      background-color: white;
      border: 2px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.65);
      transition: all 0.2s ease;
      font-size: 16px;
      font-weight: bold;
    `;
    container.title = 'Toggle Radar Mode';
    container.innerHTML = '&#x1F4DF;';

    L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    L.DomEvent.on(container, 'click', L.DomEvent.preventDefault);
    L.DomEvent.on(container, 'click', this._boundClickHandler);
    this._container = container;
    return container;
  }

  onRemove(map: L.Map) {
    if (this._container) {
      L.DomEvent.off(this._container, 'click', this._boundClickHandler);
    }
  }

  updateState(enabled: boolean) {
    if (this._container) {
      if (enabled) {
        this._container.style.backgroundColor = '#0066cc';
        this._container.style.color = 'white';
      } else {
        this._container.style.backgroundColor = 'white';
        this._container.style.color = 'black';
      }
    }
  }
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

  const headingStartPointRef = useRef<L.LatLng | null>(null);
  const headingLineRef = useRef<L.Polyline | null>(null);
  const headingTooltipRef = useRef<L.Tooltip | null>(null);
  const headingMarkerRef = useRef<L.Marker | null>(null);
  const headingControlRef = useRef<HeadingModeControl | null>(null);
  const radarControlRef = useRef<RadarModeControl | null>(null);
  const currentSelectedAircraftRef = useRef<string | null>(null);
  const hasZoomedToFlightPlan = useRef<boolean>(false);
  const selectedAirportMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (headingControlRef.current) {
      headingControlRef.current.updateState(isHeadingMode);
    }
    if (radarControlRef.current) {
      radarControlRef.current.updateState(isRadarMode);
    }
  }, [isHeadingMode, isRadarMode]);

  const drawFlightPlan = useCallback(
    (aircraft: PositionUpdate, shouldZoom = false) => {
      if (!mapInstance || !flightPlanLayerGroup || !historyLayerGroup) return;

      try {
        flightPlanLayerGroup.clearLayers();
        historyLayerGroup.clearLayers();
        currentSelectedAircraftRef.current = aircraft.id || aircraft.callsign;

        const aircraftId = aircraft.id || aircraft.callsign;
        const history = aircraftHistoryRef.current.get(aircraftId) || [];

        if (history.length >= 2) {
          const historyPolyline = L.polyline(history, {
            color: isRadarMode ? '#00ff00' : '#00ff00',
            weight: isRadarMode ? 2 : 4,
            opacity: isRadarMode ? 0.7 : 0.8,
            smoothFactor: 1,
            dashArray: isRadarMode ? '5, 5' : '',
          });
          historyLayerGroup.addLayer(historyPolyline);
        }

        if (aircraft.flightPlan) {
          const waypoints = JSON.parse(aircraft.flightPlan);

          if (waypoints.length > 0) {
            const coordinates: L.LatLngTuple[] = [];
            const activeWaypointIndex = findActiveWaypointIndex(
              aircraft,
              waypoints
            );

            waypoints.forEach((wp: any, index: number) => {
              if (wp.lat && wp.lon) {
                coordinates.push([wp.lat, wp.lon]);

                const popupContent = `
                  <div style="font-family: system-ui; padding: 4px; color: ${
                    isRadarMode ? '#00ff00' : '#333'
                  }; background-color: ${
                  isRadarMode ? 'rgba(0,0,0,0.8)' : 'white'
                }; border: ${isRadarMode ? '1px solid #00ff00' : 'none'};">
                    <strong style="color: ${
                      isRadarMode ? '#00ffff' : '#f542e3'
                    }; font-size: 14px;">${wp.ident}</strong>
                    <div style="font-size: 11px; color: ${
                      isRadarMode ? '#99ff99' : '#666'
                    }; margin-top: 2px;">${wp.type}</div>
                    <div style="margin-top: 6px; font-size: 12px;">
                      <div>Alt: <strong>${
                        wp.alt ? wp.alt + ' ft' : 'N/A'
                      }</strong></div>
                      <div>Speed: <strong>${
                        wp.spd ? wp.spd + ' kt' : 'N/A'
                      }</strong></div>
                    </div>
                  </div>
                `;

                const icon = isRadarMode
                  ? index === activeWaypointIndex
                    ? RadarActiveWaypointIcon
                    : RadarWaypointIcon
                  : index === activeWaypointIndex
                    ? ActiveWaypointIcon
                    : WaypointIcon;

                const waypointMarker = L.marker([wp.lat, wp.lon], {
                  icon: icon,
                  title: wp.ident,
                  zIndexOffset: 100,
                })
                  .bindPopup(popupContent, {
                    className: isRadarMode ? 'radar-popup' : '',
                  })
                  .addTo(flightPlanLayerGroup!);

                waypointMarker.on('click', (e) => {
                  L.DomEvent.stopPropagation(e);
                });
              }
            });

            if (coordinates.length >= 2) {
              const plannedPolyline = L.polyline(coordinates, {
                color: isRadarMode ? '#00ffff' : '#ff00ff',
                weight: isRadarMode ? 2 : 3,
                opacity: isRadarMode ? 0.7 : 0.6,
                dashArray: isRadarMode ? '8, 8' : '10, 5',
              });
              flightPlanLayerGroup.addLayer(plannedPolyline);
            }
          }
        }

        if (shouldZoom) {
          const allBounds: L.LatLng[] = [];

          if (history.length > 0) {
            history.forEach((pos) =>
              allBounds.push(L.latLng(pos[0], pos[1]))
            );
          }

          if (aircraft.flightPlan) {
            try {
              const waypoints = JSON.parse(aircraft.flightPlan);
              waypoints.forEach((wp: any) => {
                if (wp.lat && wp.lon) {
                  allBounds.push(L.latLng(wp.lat, wp.lon));
                }
              });
            } catch (e) {}
          }

          if (allBounds.length > 0) {
            const bounds = L.latLngBounds(allBounds);
            mapInstance.fitBounds(bounds, { padding: [50, 50] });
          }

          hasZoomedToFlightPlan.current = true;
        }
      } catch (error) {
        console.error('Error drawing flight plan:', error);
      }
    },
    [isRadarMode, onAircraftSelect]
  );

  useEffect(() => {
    if (!mapInstance) {
      const worldBounds = L.latLngBounds(
        L.latLng(-85, -180),
        L.latLng(85, 180)
      );

      mapInstance = L.map('map-container', {
        zoomAnimation: true,
        minZoom: 3,
        maxZoom: 18,
        maxBounds: worldBounds,
        maxBoundsViscosity: 1.0,
      }).setView([20, 0], 3);

      satelliteHybridLayer = L.tileLayer(
        'https://mt0.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
        {
          attribution: 'Esri, Garmin, FAO, USGS, NPS',
          maxZoom: 18,
          minZoom: 3,
          transparent: true,
          pane: 'overlayPane',
          noWrap: true,
          bounds: worldBounds,
        }
      );

      radarBaseLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
          minZoom: 3,
          noWrap: true,
          bounds: worldBounds,
        }
      );

      satelliteHybridLayer.addTo(mapInstance);

      flightPlanLayerGroup = L.layerGroup().addTo(mapInstance);
      aircraftMarkersLayer = L.layerGroup().addTo(mapInstance);
      airportMarkersLayer = L.layerGroup().addTo(mapInstance);
      historyLayerGroup = L.layerGroup().addTo(mapInstance);

      const headingControl = new HeadingModeControl({}, setIsHeadingMode);
      mapInstance.addControl(headingControl);
      headingControlRef.current = headingControl;

      const radarControl = new RadarModeControl({}, setIsRadarMode);
      mapInstance.addControl(radarControl);
      radarControlRef.current = radarControl;

      setDrawFlightPlanOnMap(drawFlightPlan);

      mapInstance.on('click', (e) => {
        const target = e.originalEvent.target as HTMLElement;
        if (
          !target.closest('.leaflet-marker-icon') &&
          !target.closest('.leaflet-popup-pane') &&
          !target.closest('.leaflet-control') &&
          flightPlanLayerGroup &&
          historyLayerGroup
        ) {
          flightPlanLayerGroup.clearLayers();
          historyLayerGroup.clearLayers();
          currentSelectedAircraftRef.current = null;
          hasZoomedToFlightPlan.current = false;
          onAircraftSelect(null);
        }
      });
    }

    if (satelliteHybridLayer && radarBaseLayer) {
      if (isRadarMode) {
        if (mapInstance.hasLayer(satelliteHybridLayer)) {
          mapInstance.removeLayer(satelliteHybridLayer);
        }
        if (!mapInstance.hasLayer(radarBaseLayer)) {
          mapInstance.addLayer(radarBaseLayer);
        }
      } else {
        if (mapInstance.hasLayer(radarBaseLayer)) {
          mapInstance.removeLayer(radarBaseLayer);
        }
        if (!mapInstance.hasLayer(satelliteHybridLayer)) {
          mapInstance.addLayer(satelliteHybridLayer);
        }
      }
    }

    aircrafts.forEach((aircraft) => {
      const aircraftId = aircraft.id || aircraft.callsign;
      const currentPosition: L.LatLngTuple = [aircraft.lat, aircraft.lon];

      if (!aircraftHistoryRef.current.has(aircraftId)) {
        aircraftHistoryRef.current.set(aircraftId, [currentPosition]);
      } else {
        const history = aircraftHistoryRef.current.get(aircraftId)!;
        const lastPosition = history[history.length - 1];

        if (
          lastPosition &&
          (lastPosition[0] !== currentPosition[0] ||
            lastPosition[1] !== currentPosition[1])
        ) {
          history.push(currentPosition);

          if (history.length > 500) {
            history.shift();
          }
        }
      }
    });

    const currentAircraftIds = new Set(
      aircrafts.map((ac) => ac.id || ac.callsign)
    );
    for (const [id] of aircraftHistoryRef.current) {
      if (!currentAircraftIds.has(id)) {
        aircraftHistoryRef.current.delete(id);
      }
    }

    if (airportMarkersLayer) {
      airportMarkersLayer.clearLayers();

      airports.forEach((airport) => {
        let popupContent = `
          <div style="color: ${isRadarMode ? '#00ffff' : '#333'}; background-color: ${
          isRadarMode ? 'rgba(0,0,0,0.8)' : 'white'
        }; border: ${isRadarMode ? '1px solid #00ffff' : 'none'}; padding: 4px;">
            <strong style="color: ${
              isRadarMode ? '#00ffff' : '#333'
            };">Airport:</strong> ${airport.name}<br>(${airport.icao})
          </div>
        `;
        
        if (airport.frequencies && airport.frequencies.length > 0) {
          popupContent += `
            <div style="margin-top: 8px;">
              <strong style="color: ${
                isRadarMode ? '#99ff99' : '#333'
              };">Frequencies:</strong><br>
              <ul style="list-style-type: none; padding: 0; margin: 0;">
          `;
          airport.frequencies.forEach((freq) => {
            popupContent += `
                <li style="font-size: 12px; margin-bottom: 2px;">
                  <span style="color: ${
                    isRadarMode ? '#00ffff' : '#666'
                  };">${freq.type}:</span>
                  <span style="font-weight: bold; color: ${
                    isRadarMode ? '#fff' : '#333'
                  };">${freq.frequency} MHz</span>
                </li>
            `;
          });
          popupContent += `
              </ul>
            </div>
          `;
        }

        const icon = isRadarMode ? RadarAirportIcon : AirportIcon;

        L.marker([airport.lat, airport.lon], {
          title: airport.name,
          icon: icon,
        })
          .addTo(airportMarkersLayer!)
          .bindPopup(popupContent, {
            className: isRadarMode ? 'radar-popup' : '',
          });
      });
    }

    if (aircraftMarkersLayer) {
      aircraftMarkersLayer.clearLayers();

      aircrafts.forEach((aircraft) => {
        const icon = isRadarMode
          ? getRadarAircraftDivIcon(aircraft)
          : getAircraftDivIcon(aircraft);

        const marker = L.marker([aircraft.lat, aircraft.lon], {
          title: aircraft.callsign,
          icon: icon,
          zIndexOffset: 1000,
        }).addTo(aircraftMarkersLayer!);

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          hasZoomedToFlightPlan.current = false;
          drawFlightPlan(aircraft, true);
          onAircraftSelect(aircraft);
        });
      });
    }

    if (currentSelectedAircraftRef.current) {
      const selectedAircraft = aircrafts.find(
        (ac) => (ac.id || ac.callsign) === currentSelectedAircraftRef.current
      );
      if (selectedAircraft) {
        drawFlightPlan(selectedAircraft, false);
      }
    }
  }, [
    aircrafts,
    airports,
    onAircraftSelect,
    drawFlightPlan,
    setDrawFlightPlanOnMap,
    isRadarMode,
  ]);

  useEffect(() => {
    if (!mapInstance) return;

    if (selectedAirport) {
      mapInstance.setView([selectedAirport.lat, selectedAirport.lon], 12);

      if (selectedAirportMarkerRef.current) {
        mapInstance.removeLayer(selectedAirportMarkerRef.current);
      }
      selectedAirportMarkerRef.current = L.marker(
        [selectedAirport.lat, selectedAirport.lon],
        {
          icon: L.divIcon({
            className: 'selected-airport-marker',
            html: `
              <div style="
                background-color: ${isRadarMode ? '#00ffff' : '#3b82f6'};
                color: ${isRadarMode ? 'black' : 'white'};
                padding: 5px 10px;
                border-radius: 5px;
                font-weight: bold;
                white-space: nowrap;
                border: 2px solid ${isRadarMode ? '#00ffff' : 'white'};
                box-shadow: 0 2px 5px rgba(0,0,0,0.4);
                transform: translate(-50%, -100%);
              ">
                ${selectedAirport.icao}
              </div>
              <div style="
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-top: 8px solid ${isRadarMode ? '#00ffff' : '#3b82f6'};
                position: absolute;
                bottom: 0px;
                left: 50%;
                transform: translateX(-50%);
              "></div>
            `,
            iconSize: [80, 40],
            iconAnchor: [40, 40],
          }),
          zIndexOffset: 2000,
        }
      )
        .addTo(mapInstance)
        .bindPopup(
          `<strong>${selectedAirport.name}</strong><br>${selectedAirport.icao}`,
          { className: isRadarMode ? 'radar-popup' : '' }
        )
        .openPopup();
    } else {
      if (selectedAirportMarkerRef.current) {
        mapInstance.removeLayer(selectedAirportMarkerRef.current);
        selectedAirportMarkerRef.current = null;
      }
    }
  }, [selectedAirport, isRadarMode]);

  useEffect(() => {
    if (!mapInstance) return;

    const map = mapInstance;

    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      if (!isHeadingMode) return;
      headingStartPointRef.current = e.latlng;

      if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
      }
      headingMarkerRef.current = L.marker(e.latlng, {
        icon: L.divIcon({
          className: '',
          html: `<div style="background-color: ${
            isRadarMode ? '#00ff00' : '#2563eb'
          }; width: 10px; height: 10px; border-radius: 50%;"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        }),
      }).addTo(map);

      map.dragging.disable();
    };

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!isHeadingMode || !headingStartPointRef.current) return;

      const start = headingStartPointRef.current;
      const end = e.latlng;

      if (headingLineRef.current) {
        headingLineRef.current.setLatLngs([start, end]);
      } else {
        headingLineRef.current = L.polyline([start, end], {
          color: isRadarMode ? '#00ff00' : 'blue',
          weight: 3,
          dashArray: '5, 5',
        }).addTo(map);
      }

      const distance = calculateDistance(
        start.lat,
        start.lng,
        end.lat,
        end.lng
      );
      const heading = calculateBearing(
        start.lat,
        start.lng,
        end.lat,
        end.lng
      );

      const tooltipContent = `
        <div style="font-weight: bold;">
          Heading: ${heading.toFixed(1)}°
        </div>
        <div>
          Distance: ${distance.toFixed(1)} km
        </div>
      `;

      if (headingTooltipRef.current) {
        headingTooltipRef.current.setLatLng(end).setContent(tooltipContent);
      } else {
        headingTooltipRef.current = L.tooltip({
          permanent: true,
          direction: 'auto',
          className: 'heading-tooltip',
        })
          .setLatLng(end)
          .setContent(tooltipContent)
          .addTo(map);
      }
    };

    const handleMouseUp = () => {
      if (!isHeadingMode) return;

      if (headingLineRef.current) {
        map.removeLayer(headingLineRef.current);
        headingLineRef.current = null;
      }
      if (headingTooltipRef.current) {
        map.removeLayer(headingTooltipRef.current);
        headingTooltipRef.current = null;
      }
      if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
        headingMarkerRef.current = null;
      }

      headingStartPointRef.current = null;
      map.dragging.enable();
    };

    if (isHeadingMode) {
      map.on('mousedown', handleMouseDown);
      map.on('mousemove', handleMouseMove);
      map.on('mouseup', handleMouseUp);
      map.getContainer().style.cursor = 'crosshair';
    } else {
      if (headingLineRef.current) {
        map.removeLayer(headingLineRef.current);
        headingLineRef.current = null;
      }
      if (headingTooltipRef.current) {
        map.removeLayer(headingTooltipRef.current);
        headingTooltipRef.current = null;
      }
      if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
        headingMarkerRef.current = null;
      }
      headingStartPointRef.current = null;

      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.dragging.enable();
      map.getContainer().style.cursor = '';
    };

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.dragging.enable();
      map.getContainer().style.cursor = '';
    };
  }, [isHeadingMode, isRadarMode]);

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
      
      /* Airport popup styles */
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
    <div id="map-container" style={{ height: '100%', width: '100%' }} />
  </>
);
};

export default MapComponent;