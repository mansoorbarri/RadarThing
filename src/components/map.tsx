import React, { useEffect } from 'react';
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
let isInitialLoad = true; 

const WaypointIcon = L.divIcon({
    html: '<div style="font-size: 16px; font-weight: bold; color: #f54291; text-shadow: 0 0 2px #000;">X</div>',
    className: 'leaflet-waypoint-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10], 
});

const ActiveWaypointIcon = L.divIcon({
    html: '<div style="font-size: 16px; font-weight: bold; color: #00ff00; text-shadow: 0 0 4px #000; animation: pulse-active 1.5s ease-in-out infinite;">▲</div>',
    className: 'leaflet-active-waypoint-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10], 
});

const getAircraftDivIcon = (aircraft: PositionUpdate) => {
  const iconUrl = 'https://i.ibb.co/6cNhyMMj/1.png'; 
  const planeSize = 30; 
  const tagHeight = 45; 
  const tagWidth = 140; 
  const tagHorizontalSpacing = 10; 

  const iconWidth = planeSize + tagHorizontalSpacing + tagWidth;
  const iconHeight = Math.max(planeSize, tagHeight); 

  const anchorX = planeSize / 2; 
  const anchorY = iconHeight / 2; 

  const containerStyle = `
    position: absolute;
    top: ${ (iconHeight - planeSize) / 2 }px; 
    left: 0; 
    width: ${planeSize}px;
    height: ${planeSize}px;
  `;

  const tagStyle = `
    position: absolute;
    top: ${ (planeSize / 2) - (tagHeight / 2) }px; 
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
  
  const detailContent = `
    <div style="font-size: 12px; font-weight: bold; color: #fff;">
      ${aircraft.callsign || aircraft.flightNo || 'N/A'} (${aircraft.flightNo || 'N/A'})
    </div>
    <div style="font-size: 10px; opacity: 0.9;">
      ${aircraft.alt.toFixed(0)}ft | HDG ${aircraft.heading.toFixed(0)}° | ${aircraft.speed.toFixed(0)}kt
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
    popupAnchor: [0, -15]
  });
};

const AirportIcon = L.icon({
    iconUrl: 'https://i0.wp.com/microshare.io/wp-content/uploads/2024/04/airport2-icon.png?resize=510%2C510&ssl=1',
    iconSize: [30, 30],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Helper function to calculate great-circle distance (Haversine formula, in km)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Simplified logic to determine the active waypoint
const findActiveWaypointIndex = (aircraft: PositionUpdate, waypoints: any[]): number => {
    if (waypoints.length < 1) return -1;
    
    const currentLat = aircraft.lat;
    const currentLon = aircraft.lon;
    
    let closestWaypointIndex = -1;
    let minDistanceKm = Infinity;

    // Find the closest waypoint that is NOT the departure point (usually the 0th or 1st)
    for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        if (!wp.lat || !wp.lon) continue;

        const distance = calculateDistance(currentLat, currentLon, wp.lat, wp.lon);
        
        // This simple logic finds the overall closest waypoint and assumes it's the target.
        // In a real system, you'd use cross-track error and bearing.
        // We'll filter for waypoints that are likely ahead of the aircraft.
        if (distance < minDistanceKm) {
            minDistanceKm = distance;
            closestWaypointIndex = i;
        }
    }
    
    // Safety check: if the aircraft is very close to the identified waypoint, 
    // try to move to the next one if it exists. (Acts as a simple 'passed' check)
    if (minDistanceKm < 50 && closestWaypointIndex < waypoints.length - 1) { // 50km tolerance
        return closestWaypointIndex + 1;
    }
    
    return closestWaypointIndex;
};


const MapComponent: React.FC<MapComponentProps> = ({ aircrafts, airports, onAircraftSelect }) => {
  
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
      
      mapInstance.on('click', (e) => {
          const target = e.originalEvent.target as HTMLElement;
          if (
              !target.closest('.leaflet-marker-icon') &&
              !target.closest('.leaflet-popup-pane') &&
              !target.closest('.leaflet-control') &&
              flightPlanLayerGroup
          ) {
              flightPlanLayerGroup.clearLayers();
              onAircraftSelect(null);
          }
      });
    }
    
    mapInstance.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            mapInstance?.removeLayer(layer);
        }
    });

    airports.forEach(airport => {
        const popupContent = `**Airport:** ${airport.name}<br>(${airport.icao})`;
        
        L.marker([airport.lat, airport.lon], {
            title: airport.name,
            icon: AirportIcon,
        }).addTo(mapInstance!)
          .bindPopup(popupContent);
    });

    const drawFlightPlan = (aircraft: PositionUpdate) => {
        if (!mapInstance || !aircraft.flightPlan || !flightPlanLayerGroup) return;

        try {
            flightPlanLayerGroup.clearLayers();
            
            const waypoints = JSON.parse(aircraft.flightPlan);
            
            if (waypoints.length === 0) return;
            
            const activeWaypointIndex = findActiveWaypointIndex(aircraft, waypoints);
            const coordinates: L.LatLngTuple[] = [];

            waypoints.forEach((wp: any, index: number) => {
                if (wp.lat && wp.lon) {
                    coordinates.push([wp.lat, wp.lon]);

                    const popupContent = `
                        <strong>Waypoint: ${wp.ident}</strong> (${wp.type})<br>
                        Altitude: ${wp.alt ? wp.alt + ' ft' : 'N/A'}<br>
                        Speed: ${wp.spd ? wp.spd + ' kt' : 'N/A'}
                    `;
                    
                    const icon = index === activeWaypointIndex ? ActiveWaypointIcon : WaypointIcon;

                    const waypointMarker = L.marker([wp.lat, wp.lon], {
                        icon: icon,
                        title: wp.ident
                    })
                    .bindPopup(popupContent)
                    .addTo(flightPlanLayerGroup!); 
                    
                    waypointMarker.on('click', (e) => { L.DomEvent.stopPropagation(e); });
                }
            });

            if (coordinates.length < 2) return;

            const polyline = L.polyline(coordinates, {
                color: '#ff00ff', 
                weight: 10, 
                opacity: 0.7,
                dashArray: '10, 5'
            });

            flightPlanLayerGroup.addLayer(polyline);

            mapInstance.fitBounds(polyline.getBounds(), { padding: [50, 50] });

        } catch (error) {
            console.error("Error drawing flight plan:", error);
        }
    };

    aircrafts.forEach(aircraft => {
      const icon = getAircraftDivIcon(aircraft);

      const marker = L.marker([aircraft.lat, aircraft.lon], {
        title: aircraft.callsign,
        icon: icon,
      }).addTo(mapInstance!);
      
      marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e); 
          drawFlightPlan(aircraft);
          onAircraftSelect(aircraft);
      });
    });

    isInitialLoad = false;
  }, [aircrafts, airports, onAircraftSelect]); 

  return <div id="map-container" style={{ height: '100%', width: '100%' }} />;
};

export default MapComponent;