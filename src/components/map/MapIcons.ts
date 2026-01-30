import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";

const EMERGENCY_SQUAWKS = new Set(["7700", "7600", "7500"]);

export const WaypointIcon = L.divIcon({
  html: `
    <div class="
      w-3 h-3 rounded-full
      bg-fuchsia-400
      border-2 border-white
      shadow-[0_0_8px_rgba(245,66,227,0.8)]
    "></div>
  `,
  className: "leaflet-waypoint-icon",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const ActiveWaypointIcon = L.divIcon({
  html: `
    <div class="
      w-4 h-4 rounded-full
      bg-gradient-to-br from-green-400 to-green-600
      border-2 border-white
      shadow-[0_0_12px_rgba(0,255,0,0.9)]
      animate-pulse
    "></div>
  `,
  className: "leaflet-active-waypoint-icon",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export const RadarWaypointIcon = L.divIcon({
  html: `
    <div class="
      w-1.5 h-1.5 rounded-full
      bg-cyan-400
      shadow-[0_0_4px_rgba(0,255,255,0.6)]
    "></div>
  `,
  className: "leaflet-radar-waypoint-icon",
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

export const RadarActiveWaypointIcon = L.divIcon({
  html: `
    <div class="
      w-2.5 h-2.5 rounded-full
      bg-green-400
      border border-white
      shadow-[0_0_8px_rgba(0,255,0,0.8)]
      animate-pulse
    "></div>
  `,
  className: "leaflet-radar-active-waypoint-icon",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export const getAircraftDivIcon = (
  aircraft: PositionUpdate & { altMSL?: number },
  selectedAircraftId: string | null,
  showTags = true,
) => {
  const iconUrl = "https://i.ibb.co/6cNhyMMj/1.png";
  const planeSize = 30;
  const tagHeight = 50;
  const tagWidth = 155;
  const tagOffsetFromPlane = 12;

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
    z-index: 2;
    ${
      isEmergency
        ? `
        filter: brightness(1.4) saturate(1.6);
        animation: pulse 1s infinite alternate;
      `
        : ""
    }
  `;

  const tagStyle = `
    position: absolute;
    top: ${(totalHeight - tagHeight) / 2}px;
    left: ${planeSize + tagOffsetFromPlane}px;
    width: ${tagWidth}px;
    cursor: pointer;
    z-index: 1000;
    ${!showTags || (selectedAircraftId && !isCurrentAircraftSelected) ? "display: none;" : ""}
  `;

  const detailContent = `
    <div class="
      flex flex-col gap-0.5 px-2.5 py-1.5
      rounded-md
      bg-black/75 backdrop-blur
      border
      ${isEmergency ? "border-red-500/70" : "border-cyan-400/40"}
      shadow-[0_0_6px_rgba(0,255,255,0.25)]
      font-mono text-[11px]
      ${isEmergency ? "text-red-400" : "text-cyan-200"}
    ">
      <div class="flex items-center justify-between font-semibold text-[12px]">
        <span>${aircraft.flightNo || aircraft.callsign || "N/A"}</span>
        ${
          isEmergency
            ? `<span class="text-red-500 animate-pulse">EMRG</span>`
            : ""
        }
      </div>
      <div class="opacity-90">
        ${displayAlt} · HDG ${aircraft.heading.toFixed(0)}°
      </div>
      <div class="opacity-80">
        ${aircraft.speed.toFixed(0)}kt · SQK ${aircraft.squawk || "---"}
      </div>
      <div class="opacity-65 text-[10px]">
        ${aircraft.departure || "UNK"} → ${aircraft.arrival || "UNK"}
      </div>
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px; pointer-events: auto; cursor: pointer;">
        <img src="${iconUrl}" style="${planeStyle} pointer-events: none;" />
        <div style="${tagStyle} pointer-events: none;">
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
  showTags = true,
) => {
  const isEmergency = aircraft.squawk && EMERGENCY_SQUAWKS.has(aircraft.squawk);

  const isCurrentAircraftSelected =
    selectedAircraftId &&
    (aircraft.id === selectedAircraftId ||
      aircraft.callsign === selectedAircraftId);

  // Larger dot and heading line when selected for better visibility
  const dotSize = isCurrentAircraftSelected ? 12 : 8;
  const headingLineLength = isCurrentAircraftSelected ? 22 : 14;
  const labelHeight = 38;
  const labelWidth = 100;
  const labelOffsetFromDot = 16;

  const totalWidth =
    dotSize + headingLineLength + labelOffsetFromDot + labelWidth;
  const totalHeight = Math.max(dotSize + 8, labelHeight); // Extra space for selection ring

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

  // Color scheme: selected = bright green, emergency = red, normal = cyan
  const dotColor = isEmergency ? "#ef4444" : isCurrentAircraftSelected ? "#4ade80" : "#22d3ee";
  const glowColor = isEmergency ? "rgba(239,68,68,0.8)" : isCurrentAircraftSelected ? "rgba(74,222,128,0.9)" : "rgba(0,255,255,0.5)";

  const dotStyle = `
    position: absolute;
    top: ${(totalHeight - dotSize) / 2}px;
    left: 0;
    width: ${dotSize}px;
    height: ${dotSize}px;
    border-radius: 9999px;
    background-color: ${dotColor};
    box-shadow: 0 0 ${isCurrentAircraftSelected ? "12px" : "5px"} ${glowColor}${isCurrentAircraftSelected ? `, 0 0 20px ${glowColor}` : ""};
    ${isCurrentAircraftSelected ? "animation: radar-selected-pulse 1.5s ease-in-out infinite;" : ""}
  `;

  // Selection ring around selected aircraft
  const selectionRingStyle = isCurrentAircraftSelected ? `
    position: absolute;
    top: ${(totalHeight - dotSize) / 2 - 6}px;
    left: -6px;
    width: ${dotSize + 12}px;
    height: ${dotSize + 12}px;
    border-radius: 9999px;
    border: 2px solid ${isEmergency ? "#ef4444" : "#4ade80"};
    box-shadow: 0 0 8px ${isEmergency ? "rgba(239,68,68,0.6)" : "rgba(74,222,128,0.6)"};
    animation: radar-ring-pulse 1.5s ease-in-out infinite;
  ` : "";

  const headingLineStyle = `
    position: absolute;
    top: ${totalHeight / 2 - (isCurrentAircraftSelected ? 1.5 : 1)}px;
    left: ${dotSize / 2}px;
    width: ${headingLineLength}px;
    height: ${isCurrentAircraftSelected ? 3 : 2}px;
    background-color: ${dotColor};
    transform-origin: 0% 50%;
    transform: rotate(${(aircraft.heading || 0) - 90}deg);
    ${isCurrentAircraftSelected ? `box-shadow: 0 0 6px ${glowColor};` : ""}
  `;

  const labelStyle = `
    position: absolute;
    top: ${(totalHeight - labelHeight) / 2}px;
    left: ${dotSize + labelOffsetFromDot}px;
    width: ${labelWidth}px;
    cursor: pointer;
    z-index: 1000;
    ${!showTags || (selectedAircraftId && !isCurrentAircraftSelected) ? "display: none;" : ""}
  `;

  const detailContent = `
    <div class="
      px-2.5 py-1.5
      rounded-sm
      bg-black/80 backdrop-blur
      border
      ${isEmergency ? "border-red-500/70" : "border-cyan-400/40"}
      shadow-[0_0_6px_rgba(0,255,255,0.25)]
      font-mono text-[11px] leading-snug
      ${isEmergency ? "text-red-400" : "text-cyan-200"}
    ">
      <div class="flex justify-between font-semibold text-[12px]">
        <span>${aircraft.flightNo || aircraft.callsign || "N/A"}</span>
        ${isEmergency ? `<span class="animate-pulse">!</span>` : ""}
      </div>
      <div class="opacity-90">
        ${displayAlt} · ${aircraft.heading.toFixed(0)}°
      </div>
      <div class="opacity-80">
        ${aircraft.speed.toFixed(0)}kt ${aircraft.squawk || ""}
      </div>
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px; pointer-events: auto; cursor: pointer;">
        ${isCurrentAircraftSelected ? `<div style="${selectionRingStyle} pointer-events: none;"></div>` : ""}
        <div style="${dotStyle} pointer-events: none;"></div>
        <div style="${headingLineStyle} pointer-events: none;"></div>
        <div style="${labelStyle} pointer-events: none;">
          ${detailContent}
        </div>
      </div>
    `,
    className: "leaflet-radar-aircraft-icon",
    iconSize: [totalWidth, totalHeight],
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
    <div class="
      w-2.5 h-2.5 rounded-full
      bg-cyan-400
      shadow-[0_0_5px_rgba(0,255,255,0.7)]
    "></div>
  `,
  className: "leaflet-radar-airport-icon",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
});
