import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type PositionUpdate } from '~/lib/aircraft-store';

interface MapComponentProps {
  aircrafts: PositionUpdate[];
  airports: Airport[];
  onAircraftSelect: (aircraft: PositionUpdate | null) => void;
}

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

let mapInstance: L.Map | null = null;
let flightPlanLayerGroup: L.LayerGroup | null = null;
let aircraftMarkersLayer: L.LayerGroup | null = null;
let airportMarkersLayer: L.LayerGroup | null = null;
let isInitialLoad = true;

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

const getAircraftDivIcon = (aircraft: PositionUpdate & { altMSL?: number }) => {
  const iconUrl = 'https://i.ibb.co/6cNhyMMj/1.png';
  const planeSize = 30;
  const tagHeight = 45;
  const tagWidth = 150;
  const tagHorizontalSpacing = 10;

  const iconWidth = planeSize + tagHorizontalSpacing + tagWidth;
  const iconHeight = Math.max(planeSize, tagHeight);

  const anchorX = planeSize / 2;
  const anchorY = iconHeight / 2;

  const containerStyle = `
    position: absolute;
    top: ${(iconHeight - planeSize) / 2}px;
    left: 0;
    width: ${planeSize}px;
    height: ${planeSize}px;
  `;

  const tagStyle = `
    position: absolute;
    top: ${(planeSize / 2) - (tagHeight / 2)}px;
    left: ${planeSize + tagHorizontalSpacing}px;

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
    transform: none;
  `;

  const altMSL = aircraft.altMSL ?? aircraft.alt;
  const altAGL = aircraft.alt;
  const isOnGround = altAGL < 100;
  const displayAlt = isOnGround ? `${altAGL.toFixed(0)}ft AGL` : 
                     altMSL >= 18000 ? `FL${Math.round(altMSL / 100)}` :
                     `${altAGL.toFixed(0)}ft AGL`;

  const detailContent = `
    <div style="font-size: 12px; font-weight: bold; color: #fff;">
      ${aircraft.callsign || aircraft.flightNo || 'N/A'} (${aircraft.flightNo || 'N/A'})
    </div>
    <div style="font-size: 10px; opacity: 0.9;">
      ${displayAlt} | HDG ${aircraft.heading.toFixed(0)}° | ${aircraft.speed.toFixed(0)}kt
    </div>
    <div style="font-size: 10px; opacity: 0.8;">
      SQK: ${aircraft.squawk || 'N/A'} | ${aircraft.departure || 'UNK'} → ${aircraft.arrival || 'UNK'}
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="${containerStyle}" class="aircraft-marker-container">
        <img src="${iconUrl}"
             style="width:${planeSize}px; height:${planeSize}px; transform:rotate(${aircraft.heading || 0}deg); display: block;"
             alt="${aircraft.callsign}"
        />
        <div class="aircraft-tag" style="${tagStyle}">
          ${detailContent}
        </div>
      </div>
    `,
    className: 'leaflet-aircraft-icon',
    iconSize: [iconWidth, iconHeight],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -15],
  });
};

const AirportIcon = L.icon({
  iconUrl: 'https://i0.wp.com/microshare.io/wp-content/uploads/2024/04/airport2-icon.png?resize=510%2C510&ssl=1',
  iconSize: [30, 30],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = toDeg(Math.atan2(y, x));

  return (θ + 360) % 360;
};

const findActiveWaypointIndex = (aircraft: PositionUpdate, waypoints: any[]): number => {
  if (waypoints.length < 1) return -1;

  const currentLat = aircraft.lat;
  const currentLon = aircraft.lon;

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

  if (minDistanceKm < 50 && closestWaypointIndex < waypoints.length - 1) {
    return closestWaypointIndex + 1;
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

  constructor(options: L.ControlOptions, toggleHeadingMode: React.Dispatch<React.SetStateAction<boolean>>) {
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

const MapComponent: React.FC<MapComponentProps> = ({
  aircrafts,
  airports,
  onAircraftSelect,
}) => {
  const [isHeadingMode, setIsHeadingMode] = useState<boolean>(false);
  const headingStartPointRef = useRef<L.LatLng | null>(null);
  const headingLineRef = useRef<L.Polyline | null>(null);
  const headingTooltipRef = useRef<L.Tooltip | null>(null);
  const headingMarkerRef = useRef<L.Marker | null>(null);
  const headingControlRef = useRef<HeadingModeControl | null>(null);
  const currentSelectedAircraftRef = useRef<string | null>(null);
  const hasZoomedToFlightPlan = useRef<boolean>(false);

  useEffect(() => {
    if (headingControlRef.current) {
      headingControlRef.current.updateState(isHeadingMode);
    }
  }, [isHeadingMode]);

  useEffect(() => {
    if (!mapInstance) {
      mapInstance = L.map('map-container', {
        zoomAnimation: true,
      }).setView([20, 0], 2);

      L.tileLayer('https://mt0.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        attribution: 'Esri, Garmin, FAO, USGS, NPS',
        maxZoom: 18,
        transparent: true,
        pane: 'overlayPane',
      }).addTo(mapInstance);

      flightPlanLayerGroup = L.layerGroup().addTo(mapInstance);
      aircraftMarkersLayer = L.layerGroup().addTo(mapInstance);
      airportMarkersLayer = L.layerGroup().addTo(mapInstance);

      const headingControl = new HeadingModeControl({}, setIsHeadingMode);
      mapInstance.addControl(headingControl);
      headingControlRef.current = headingControl;

      mapInstance.on('click', (e) => {
        const target = e.originalEvent.target as HTMLElement;
        if (
          !target.closest('.leaflet-marker-icon') &&
          !target.closest('.leaflet-popup-pane') &&
          !target.closest('.leaflet-control') &&
          flightPlanLayerGroup
        ) {
          flightPlanLayerGroup.clearLayers();
          currentSelectedAircraftRef.current = null;
          hasZoomedToFlightPlan.current = false;
          onAircraftSelect(null);
        }
      });
    }

    if (airportMarkersLayer) {
      airportMarkersLayer.clearLayers();
      
      airports.forEach((airport) => {
        const popupContent = `**Airport:** ${airport.name}<br>(${airport.icao})`;

        L.marker([airport.lat, airport.lon], {
          title: airport.name,
          icon: AirportIcon,
        })
          .addTo(airportMarkersLayer!)
          .bindPopup(popupContent);
      });
    }

    const drawFlightPlan = (aircraft: PositionUpdate, shouldZoom: boolean = false) => {
      if (!mapInstance || !aircraft.flightPlan || !flightPlanLayerGroup) return;

      try {
        flightPlanLayerGroup.clearLayers();
        currentSelectedAircraftRef.current = aircraft.id || aircraft.callsign;

        const waypoints = JSON.parse(aircraft.flightPlan);

        if (waypoints.length === 0) return;

        const activeWaypointIndex = findActiveWaypointIndex(aircraft, waypoints);
        const coordinates: L.LatLngTuple[] = [];

        waypoints.forEach((wp: any, index: number) => {
          if (wp.lat && wp.lon) {
            coordinates.push([wp.lat, wp.lon]);

            const popupContent = `
              <div style="font-family: system-ui; padding: 4px;">
                <strong style="color: #f542e3; font-size: 14px;">${wp.ident}</strong>
                <div style="font-size: 11px; color: #666; margin-top: 2px;">${wp.type}</div>
                <div style="margin-top: 6px; font-size: 12px;">
                  <div>Alt: <strong>${wp.alt ? wp.alt + ' ft' : 'N/A'}</strong></div>
                  <div>Speed: <strong>${wp.spd ? wp.spd + ' kt' : 'N/A'}</strong></div>
                </div>
              </div>
            `;

            const icon = index === activeWaypointIndex ? ActiveWaypointIcon : WaypointIcon;

            const waypointMarker = L.marker([wp.lat, wp.lon], {
              icon: icon,
              title: wp.ident,
              zIndexOffset: 100,
            })
              .bindPopup(popupContent)
              .addTo(flightPlanLayerGroup!);

            waypointMarker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
            });
          }
        });

        if (coordinates.length < 2) return;

        const aircraftPosition: L.LatLngTuple = [aircraft.lat, aircraft.lon];

        if (activeWaypointIndex >= 0) {
          const completedCoords = coordinates.slice(0, activeWaypointIndex + 1);
          completedCoords.push(aircraftPosition);
          
          const completedPolyline = L.polyline(completedCoords, {
            color: '#00ff00',
            weight: 5,
            opacity: 0.7,
            dashArray: '10, 5',
          });
          flightPlanLayerGroup.addLayer(completedPolyline);
        }

        if (activeWaypointIndex >= 0 && activeWaypointIndex < coordinates.length) {
          const remainingCoords = [aircraftPosition, ...coordinates.slice(activeWaypointIndex + 1)];
          
          const remainingPolyline = L.polyline(remainingCoords, {
            color: '#ff00ff',
            weight: 5,
            opacity: 0.7,
            dashArray: '10, 5',
          });
          flightPlanLayerGroup.addLayer(remainingPolyline);
        }

        if (shouldZoom) {
          const fullPolyline = L.polyline(coordinates, { opacity: 0 });
          mapInstance.fitBounds(fullPolyline.getBounds(), { padding: [50, 50] });
          hasZoomedToFlightPlan.current = true;
        }
      } catch (error) {
        console.error('Error drawing flight plan:', error);
      }
    };

    if (aircraftMarkersLayer) {
      aircraftMarkersLayer.clearLayers();

      aircrafts.forEach((aircraft) => {
        const icon = getAircraftDivIcon(aircraft);

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
        ac => (ac.id || ac.callsign) === currentSelectedAircraftRef.current
      );
      if (selectedAircraft) {
        drawFlightPlan(selectedAircraft, false);
      }
    }

    isInitialLoad = false;
  }, [aircrafts, airports, onAircraftSelect]);

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
          html: '<div style="background-color: #2563eb; width: 10px; height: 10px; border-radius: 50%;"></div>',
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
          color: 'blue',
          weight: 3,
          dashArray: '5, 5',
        }).addTo(map);
      }

      const distance = calculateDistance(
        start.lat,
        start.lng,
        end.lat,
        end.lng,
      );
      const heading = calculateBearing(
        start.lat,
        start.lng,
        end.lat,
        end.lng,
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
    }

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.dragging.enable();
      map.getContainer().style.cursor = '';
    };
  }, [isHeadingMode]);

  return (
    <>
      <style jsx>{`
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
      `}</style>
      <div id="map-container" style={{ height: '100%', width: '100%' }} />
    </>
  );
};

export default MapComponent;