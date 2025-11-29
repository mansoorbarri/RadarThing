// components/map/MapIcons.ts
import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";

const EMERGENCY_SQUAWKS = new Set(["7700", "7600", "7500"]);

export const WaypointIcon = L.divIcon({
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
  className: "leaflet-waypoint-icon",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const ActiveWaypointIcon = L.divIcon({
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
  className: "leaflet-active-waypoint-icon",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export const RadarWaypointIcon = L.divIcon({
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
  className: "leaflet-radar-waypoint-icon",
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

export const RadarActiveWaypointIcon = L.divIcon({
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
  className: "leaflet-radar-active-waypoint-icon",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export const getAircraftDivIcon = (
  aircraft: PositionUpdate & { altMSL?: number },
  selectedAircraftId: string | null,
) => {
  const iconUrl = "https://i.ibb.co/6cNhyMMj/1.png";
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

  const isEmergency = aircraft.squawk && EMERGENCY_SQUAWKS.has(aircraft.squawk);

  const isCurrentAircraftSelected =
    selectedAircraftId &&
    (aircraft.id === selectedAircraftId ||
      aircraft.callsign === selectedAircraftId);

  const planeStyle = `
    position: absolute;
    top: ${(totalHeight - planeSize) / 2}px;
    left: 0;
    width:${planeSize}px;
    height:${planeSize}px;
    transform:rotate(${aircraft.heading || 0}deg);
    transform-origin: 50% 50%;
    display: block;
    z-index: 2;
    ${
      isEmergency
        ? `
        filter: hue-rotate(200deg) brightness(1.5) saturate(2);
        animation: emergency-plane-pulse 1s infinite alternate;
        border: 2px solid #ff0000;
        box-shadow: 0 0 10px #ff0000, 0 0 20px #ff0000;
        border-radius: 50%;
      `
        : ""
    }
  `;

  const tagStyle = `
    position: absolute;
    top: ${(totalHeight - tagHeight) / 2}px;
    left: ${planeSize + tagOffsetFromPlane}px;
    width: ${tagWidth}px;
    padding: 4px 6px;
    background-color: ${isEmergency ? "rgba(255, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.4)"};
    color: #fff;
    border-radius: 4px;
    white-space: normal;
    text-align: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.6);
    line-height: 1.3;
    z-index: 1000;
    pointer-events: none;
    ${isEmergency ? "border: 1px solid white;" : ""}
    ${selectedAircraftId && !isCurrentAircraftSelected ? "visibility: hidden;" : ""}
  `;

  const detailContent = `
    <div style="font-size: 12px; font-weight: bold; color: #fff;">
      ${isEmergency ? "&#x26A0; EMERGENCY &#x26A0;<br/>" : ""}
      ${aircraft.callsign || aircraft.flightNo || "N/A"} (${
        aircraft.flightNo || "N/A"
      })
    </div>
    <div style="font-size: 10px; opacity: 0.9;">
      ${displayAlt} | HDG ${aircraft.heading.toFixed(0)}° | ${aircraft.speed.toFixed(
        0,
      )}kt
    </div>
    <div style="font-size: 10px; opacity: 0.8;">
      SQK: ${aircraft.squawk || "N/A"} | ${aircraft.departure || "UNK"} → ${
        aircraft.arrival || "UNK"
      }
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px;">
        <img src="${iconUrl}"
             style="${planeStyle}"
             alt="${aircraft.callsign}"
        />
        <div class="aircraft-tag" style="${tagStyle}">
          ${detailContent}
        </div>
      </div>
    `,
    className: "leaflet-aircraft-icon",
    iconSize: [totalWidth, totalHeight],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -planeSize / 2],
  });
};

export const getRadarAircraftDivIcon = (
  aircraft: PositionUpdate & { altMSL?: number },
  selectedAircraftId: string | null,
) => {
  const dotSize = 8;
  const headingLineLength = 15;
  const labelHeight = 35;
  const labelWidth = 90;
  const labelOffsetFromDot = 20;

  const totalEffectiveWidthForPositioning =
    dotSize + labelOffsetFromDot + labelWidth;
  const totalWidth = Math.max(
    totalEffectiveWidthForPositioning,
    dotSize + headingLineLength,
  );
  const totalHeight = Math.max(dotSize, labelHeight, headingLineLength);

  const anchorX = dotSize / 2;
  const anchorY = totalHeight / 2;

  const altMSL = aircraft.altMSL ?? aircraft.alt;
  const altAGL = aircraft.alt;
  const isOnGround = altAGL < 100;
  const displayAlt = isOnGround
    ? `${altAGL.toFixed(0)}AGL`
    : altMSL >= 18000
      ? `FL${Math.round(altMSL / 100)}`
      : `${altAGL.toFixed(0)}AGL`;

  const isEmergency = aircraft.squawk && EMERGENCY_SQUAWKS.has(aircraft.squawk);

  const isCurrentAircraftSelected =
    selectedAircraftId &&
    (aircraft.id === selectedAircraftId ||
      aircraft.callsign === selectedAircraftId);

  const dotColor = isEmergency ? "#ff0000" : "#00ff00";
  const lineColor = isEmergency ? "#ff0000" : "#00ff00";
  const labelBorderColor = isEmergency ? "#ff0000" : "#00ff00";
  const labelTextColor = isEmergency ? "#ff0000" : "#00ff00";
  const labelShadowColor = isEmergency
    ? "rgba(255, 0, 0, 0.7)"
    : "rgba(0, 255, 0, 0.5)";

  const dotStyle = `
    position: absolute;
    top: ${(totalHeight - dotSize) / 2}px;
    left: 0;
    width: ${dotSize}px;
    height: ${dotSize}px;
    background-color: ${dotColor};
    border-radius: 50%;
    box-shadow: 0 0 5px ${labelShadowColor};
    z-index: 2;
    ${isEmergency ? "animation: radar-emergency-pulse 1s infinite alternate;" : ""}
  `;

  const headingLineStyle = `
    position: absolute;
    top: ${totalHeight / 2 - 1}px;
    left: ${dotSize / 2}px;
    width: ${headingLineLength}px;
    height: 2px;
    background-color: ${lineColor};
    transform-origin: 0% 50%;
    transform: rotate(${(aircraft.heading || 0) - 90}deg);
    z-index: 1;
  `;

  const labelStyle = `
    position: absolute;
    top: ${(totalHeight - labelHeight) / 2}px;
    left: ${dotSize + labelOffsetFromDot}px;
    width: ${labelWidth}px;
    padding: 2px 4px;
    background-color: rgba(0, 0, 0, 0.6);
    color: ${labelTextColor};
    border: 1px solid ${labelBorderColor};
    border-radius: 2px;
    white-space: nowrap;
    text-align: left;
    font-family: 'monospace', 'Courier New', monospace;
    font-size: 10px;
    line-height: 1.2;
    box-shadow: 0 0 3px ${labelShadowColor};
    z-index: 1000;
    pointer-events: none;
    ${isEmergency ? "font-weight: bold;" : ""}
    ${selectedAircraftId && !isCurrentAircraftSelected ? "visibility: hidden;" : ""}
  `;

  const detailContent = `
    <div style="font-weight: bold;">
      ${isEmergency ? "EMRGNCY " : ""}${aircraft.flightNo || aircraft.callsign || "N/A"}
    </div>
    <div>
      ${displayAlt} ${aircraft.heading.toFixed(0)}°
    </div>
    <div>
      ${aircraft.speed.toFixed(0)}kt ${aircraft.squawk || ""}
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${totalWidth}px;
        height: ${totalHeight}px;
      ">
        <div style="${dotStyle}"></div>
        <div style="${headingLineStyle}"></div>
        <div class="aircraft-label" style="${labelStyle}">
          ${detailContent}
        </div>
      </div>
    `,
    className: "leaflet-radar-aircraft-icon",
    iconSize: [
      dotSize + headingLineLength + labelOffsetFromDot + labelWidth,
      totalHeight,
    ],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -dotSize / 2],
  });
};

export const AirportIcon = L.icon({
  iconUrl:
    "https://i0.wp.com/microshare.io/wp-content/uploads/2024/04/airport2-icon.png?resize=510%2C510&ssl=1",
  iconSize: [30, 30],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

export const RadarAirportIcon = L.divIcon({
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
  className: "leaflet-radar-airport-icon",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
});
