import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { formatSpeed, formatAltitude, speedSuffix, type UnitPreferences, DEFAULT_UNIT_PREFERENCES } from "~/lib/units";

const EMERGENCY_SQUAWKS = new Set(["7700", "7600", "7500"]);
const DEFAULT_AIRCRAFT_ICON = "/icons/e195.svg";

function getAircraftIconUrl(aircraftClass?: string, airForce?: string) {
  const type = aircraftClass?.trim().toLowerCase() ?? "";
  const af = airForce?.trim().toLowerCase() ?? "";

  if (af) return "/icons/c130.svg";
  if (!type) return DEFAULT_AIRCRAFT_ICON;
  if (
    type.includes("military") ||
    type.includes("fighter") ||
    type.includes("cargo") ||
    type.includes("tanker")
  ) {
    return "/icons/c130.svg";
  }
  if (type.includes("super")) return "/icons/md11.svg";
  if (type.includes("heavy")) return "/icons/md11.svg";
  if (
    type.includes("business") ||
    type.includes("biz") ||
    type.includes("corporate") ||
    type.includes("executive")
  ) {
    return "/icons/glf5.svg";
  }
  if (
    type.includes("light") ||
    type.includes("prop") ||
    type.includes("ga") ||
    type.includes("general aviation")
  ) {
    return "/icons/cessna.svg";
  }
  if (
    type.includes("regional") ||
    type.includes("commuter") ||
    type.includes("medium")
  ) {
    return "/icons/crjx.svg";
  }

  return DEFAULT_AIRCRAFT_ICON;
}

function getAircraftIconFilter(isEmergency: boolean, isSelected: boolean) {
  if (isEmergency) {
    return "brightness(0) saturate(100%) invert(41%) sepia(96%) saturate(2084%) hue-rotate(338deg) brightness(98%) contrast(93%) drop-shadow(0 0 8px rgba(239,68,68,0.9))";
  }

  if (isSelected) {
    return "brightness(0) saturate(100%) invert(79%) sepia(44%) saturate(1177%) hue-rotate(152deg) brightness(98%) contrast(90%) drop-shadow(0 0 8px rgba(34,211,238,0.8))";
  }

  return "brightness(0) saturate(100%) invert(80%) sepia(20%) saturate(742%) hue-rotate(152deg) brightness(90%) contrast(95%) drop-shadow(0 0 6px rgba(34,211,238,0.45))";
}

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
  isMobile = false,
  unitPrefs: UnitPreferences = DEFAULT_UNIT_PREFERENCES,
) => {
  const iconUrl = getAircraftIconUrl(aircraft.type, aircraft.af);
  const planeSize = isMobile ? 24 : 28;
  const tagHeight = isMobile ? 38 : 52;
  const tagWidth = isMobile ? 85 : 115;
  const tagOffsetFromPlane = isMobile ? 6 : 8;

  const totalWidth = planeSize + tagOffsetFromPlane + tagWidth;
  const totalHeight = Math.max(planeSize, tagHeight);

  const anchorX = planeSize / 2;
  const anchorY = totalHeight / 2;

  const altMSL = aircraft.altMSL ?? aircraft.alt;
  const altAGL = aircraft.alt;
  const isOnGround = altAGL < 100;
  const displayAlt = isOnGround
    ? `${altAGL.toFixed(0)}`
    : formatAltitude(altMSL, unitPrefs.altitudeUnit);
  const displaySpeed = isOnGround
    ? `${aircraft.speed.toFixed(0)}kt`
    : `${formatSpeed(aircraft.speed, unitPrefs.speedUnit, altMSL)}${speedSuffix(unitPrefs.speedUnit)}`;

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
    filter: ${getAircraftIconFilter(Boolean(isEmergency), Boolean(isCurrentAircraftSelected))};
    ${isEmergency ? "animation: pulse 1s infinite alternate;" : ""}
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

  const fontSize = isMobile ? "10px" : "12px";
  const callsignDisplay = aircraft.callsign || "";
  const detailContent = `
    <div class="
      flex flex-col px-1.5 py-1
      rounded-sm
      bg-black/40 backdrop-blur
      border
      ${isEmergency ? "border-red-500/70" : "border-cyan-400/30"}
      font-mono
      ${isEmergency ? "text-red-400" : "text-cyan-200"}
    " style="font-size: ${fontSize}; line-height: 1.3;">
      <div class="flex items-center justify-between font-semibold" style="font-size: ${isMobile ? "11px" : "13px"};">
        <span>${aircraft.flightNo || aircraft.callsign || "N/A"}</span>
        ${isEmergency ? `<span class="text-red-500 animate-pulse">!</span>` : ""}
      </div>
      <div class="opacity-80">
        ${displayAlt} ${displaySpeed}
      </div>
      ${callsignDisplay ? `<div class="opacity-60" style="font-size: ${isMobile ? "8px" : "10px"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${callsignDisplay}</div>` : ""}
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
  isMobile = false,
  unitPrefs: UnitPreferences = DEFAULT_UNIT_PREFERENCES,
) => {
  const isEmergency = aircraft.squawk && EMERGENCY_SQUAWKS.has(aircraft.squawk);

  const isCurrentAircraftSelected =
    selectedAircraftId &&
    (aircraft.id === selectedAircraftId ||
      aircraft.callsign === selectedAircraftId);

  // Smaller dot and heading line, even smaller on mobile
  const dotSize = isCurrentAircraftSelected
    ? isMobile
      ? 8
      : 10
    : isMobile
      ? 5
      : 6;
  const headingLineLength = isCurrentAircraftSelected
    ? isMobile
      ? 14
      : 18
    : isMobile
      ? 10
      : 12;
  const labelHeight = isMobile ? 32 : 46;
  const labelWidth = isMobile ? 75 : 100;
  const labelOffsetFromDot = isMobile ? 10 : 12;

  const totalWidth =
    dotSize + headingLineLength + labelOffsetFromDot + labelWidth;
  const totalHeight = Math.max(dotSize + 8, labelHeight);

  const anchorX = dotSize / 2;
  const anchorY = totalHeight / 2;

  const altMSL = aircraft.altMSL ?? aircraft.alt;
  const altAGL = aircraft.alt;
  const isOnGround = altAGL < 100;
  const displayAlt = isOnGround
    ? `${altAGL.toFixed(0)}`
    : formatAltitude(altMSL, unitPrefs.altitudeUnit);
  const displaySpeed = isOnGround
    ? `${aircraft.speed.toFixed(0)}kt`
    : `${formatSpeed(aircraft.speed, unitPrefs.speedUnit, altMSL)}${speedSuffix(unitPrefs.speedUnit)}`;

  // Color scheme: selected = bright green, emergency = red, normal = cyan
  const dotColor = isEmergency
    ? "#ef4444"
    : isCurrentAircraftSelected
      ? "#4ade80"
      : "#22d3ee";
  const glowColor = isEmergency
    ? "rgba(239,68,68,0.8)"
    : isCurrentAircraftSelected
      ? "rgba(74,222,128,0.9)"
      : "rgba(0,255,255,0.5)";

  const dotStyle = `
    position: absolute;
    top: ${(totalHeight - dotSize) / 2}px;
    left: 0;
    width: ${dotSize}px;
    height: ${dotSize}px;
    border-radius: 9999px;
    background-color: ${dotColor};
    box-shadow: 0 0 ${isCurrentAircraftSelected ? "8px" : "4px"} ${glowColor}${isCurrentAircraftSelected ? `, 0 0 14px ${glowColor}` : ""};
    ${isCurrentAircraftSelected ? "animation: radar-selected-pulse 1.5s ease-in-out infinite;" : ""}
  `;

  // Selection ring around selected aircraft
  const selectionRingStyle = isCurrentAircraftSelected
    ? `
    position: absolute;
    top: ${(totalHeight - dotSize) / 2 - 4}px;
    left: -4px;
    width: ${dotSize + 8}px;
    height: ${dotSize + 8}px;
    border-radius: 9999px;
    border: 1.5px solid ${isEmergency ? "#ef4444" : "#4ade80"};
    box-shadow: 0 0 6px ${isEmergency ? "rgba(239,68,68,0.6)" : "rgba(74,222,128,0.6)"};
    animation: radar-ring-pulse 1.5s ease-in-out infinite;
  `
    : "";

  const headingLineStyle = `
    position: absolute;
    top: ${totalHeight / 2 - (isCurrentAircraftSelected ? 1 : 0.5)}px;
    left: ${dotSize / 2}px;
    width: ${headingLineLength}px;
    height: ${isCurrentAircraftSelected ? 2 : 1}px;
    background-color: ${dotColor};
    transform-origin: 0% 50%;
    transform: rotate(${(aircraft.heading || 0) - 90}deg);
    ${isCurrentAircraftSelected ? `box-shadow: 0 0 4px ${glowColor};` : ""}
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

  const fontSize = isMobile ? "10px" : "12px";
  const callsignDisplay = aircraft.callsign || "";
  const detailContent = `
    <div class="
      px-1.5 py-1
      rounded-sm
      bg-black/60
      border
      ${isEmergency ? "border-red-500/60" : "border-cyan-400/30"}
      font-mono
      ${isEmergency ? "text-red-400" : "text-cyan-300"}
    " style="font-size: ${fontSize}; line-height: 1.3;">
      <div class="font-semibold" style="font-size: ${isMobile ? "11px" : "13px"};">
        ${aircraft.flightNo || aircraft.callsign || "N/A"}${isEmergency ? " !" : ""}
      </div>
      <div class="opacity-85">
        ${displayAlt} ${displaySpeed}
      </div>
      ${callsignDisplay ? `<div class="opacity-60" style="font-size: ${isMobile ? "8px" : "10px"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${callsignDisplay}</div>` : ""}
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

// Replay aircraft icon with heading rotation
export const getReplayAircraftIcon = (heading: number) => {
  const iconUrl = DEFAULT_AIRCRAFT_ICON;
  const planeSize = 36;

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${planeSize}px; height: ${planeSize}px;">
        <img
          src="${iconUrl}"
          style="
            width: ${planeSize}px;
            height: ${planeSize}px;
            transform: rotate(${heading}deg);
            transform-origin: 50% 50%;
            filter: brightness(0) saturate(100%) invert(73%) sepia(73%) saturate(1374%) hue-rotate(342deg) brightness(101%) contrast(95%) drop-shadow(0 0 8px rgba(245, 158, 11, 0.8));
          "
        />
        <div style="
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border: 2px solid rgba(245, 158, 11, 0.6);
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
      </div>
    `,
    className: "leaflet-replay-aircraft-icon",
    iconSize: [planeSize, planeSize],
    iconAnchor: [planeSize / 2, planeSize / 2],
  });
};
