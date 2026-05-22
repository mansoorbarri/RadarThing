import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { getRadarLineBearing } from "~/lib/map-utils";
import {
  formatSpeed,
  formatAltitude,
  speedSuffix,
  type UnitPreferences,
  DEFAULT_UNIT_PREFERENCES,
} from "~/lib/units";
import { getCompactAircraftType, normalizeAircraftType } from "~/lib/utils";

const EMERGENCY_SQUAWKS = new Set(["7700", "7600", "7500"]);
const DEFAULT_AIRCRAFT_ICON = "/icons/e195.svg";
const AIRCRAFT_ICONS = {
  helicopter: "/icons/a7.svg",
  military: "/icons/a6.svg",
  militaryTransport: "/icons/c130.svg",
  heavy: "/icons/md11.svg",
  largeBusiness: "/icons/glf5.svg",
  trijetBusiness: "/icons/fa7x.svg",
  lightBusiness: "/icons/learjet.svg",
  generalAviation: "/icons/cessna.svg",
  regionalJet: "/icons/crjx.svg",
  smallRegional: "/icons/erj.svg",
  narrowbody: "/icons/e195.svg",
  rearEngineJet: "/icons/f100.svg",
} as const;
const MILITARY_AF_CODES = new Set([
  "usaf",
  "raf",
  "rnzaf",
  "rmaf",
  "paf",
  "iaf",
  "luftwaffe",
  "usn",
  "usmc",
  "rafac",
]);

function isHelicopterType(type: string) {
  return (
    type.includes("helicopter") ||
    type.includes("heli") ||
    type.includes("rotor") ||
    type.includes("rotary") ||
    /\b(ah|uh|ch|mh|hh)-?\d{1,3}\b/.test(type)
  );
}

function isMilitaryAirForce(airForce: string) {
  if (!airForce) return false;

  if (MILITARY_AF_CODES.has(airForce)) return true;

  return (
    /\bair\s*force\b/.test(airForce) ||
    /\bnavy\b/.test(airForce) ||
    /\barmy\b/.test(airForce) ||
    /\bmarines?\b/.test(airForce) ||
    /\bcoast\s*guard\b/.test(airForce) ||
    /\bguardia\b/.test(airForce) ||
    /\bdefen[cs]e\b/.test(airForce) ||
    /\bmil(?:itary)?\b/.test(airForce) ||
    /^[a-z]{2,6}af$/.test(airForce)
  );
}

function normalizeAircraftTypeForIcon(type: string) {
  const cleaned = type.trim().toUpperCase();
  const normalized = normalizeAircraftType(type);

  if (normalized) {
    return normalized;
  }

  if (/\bA?20N\b/.test(cleaned)) return "A320";
  if (/\bA?21N\b/.test(cleaned)) return "A321";
  if (/\bA?223\b/.test(cleaned)) return "A220";
  if (/\bA?306\b|\bA?30B\b/.test(cleaned)) return "A300";
  if (/\bA?332\b|\bA?333\b|\bA?338\b|\bA?339\b/.test(cleaned)) return "A330";
  if (/\bA?342\b|\bA?343\b|\bA?345\b|\bA?346\b/.test(cleaned)) return "A340";
  if (/\bA?359\b|\bA?35K\b/.test(cleaned)) return "A350";
  if (/\bA?388\b/.test(cleaned)) return "A380";

  if (/\bB?73[0-9A-Z]\b|\b73[0-9A-Z]\b/.test(cleaned)) return "B737";
  if (/\bB?74[0-9A-Z]\b|\b74[0-9A-Z]\b/.test(cleaned)) return "B747";
  if (/\bB?75[0-9A-Z]\b|\b75[0-9A-Z]\b/.test(cleaned)) return "B757";
  if (/\bB?76[0-9A-Z]\b|\b76[0-9A-Z]\b/.test(cleaned)) return "B767";
  if (/\bB?77[0-9A-Z]\b|\b77[0-9A-Z]\b/.test(cleaned)) return "B777";
  if (/\bB?78[0-9A-Z]\b|\b78[0-9A-Z]\b/.test(cleaned)) return "B787";

  if (/\bE75[LS]?\b/.test(cleaned)) return "E175";
  if (/\bE19[05]\b|\bE9[05][LS]?\b/.test(cleaned)) return "E195";
  if (/\bERJ[- ]?1?(35|40|45)\b|\bE145\b/.test(cleaned)) return "ERJ145";
  if (/\bCRJ[- ]?[1279]\d{2}\b|\bCR[1279]\b|\bCL65\b/.test(cleaned)) {
    return "CRJ";
  }

  if (/\bAT7[26]\b/.test(cleaned)) return "ATR72";
  if (/\bDH8[ABCD]?\b|\bQ4?00\b/.test(cleaned)) return "DH8D";

  if (/\bC17\b/.test(cleaned)) return "C17";
  if (/\bC130\b|\bL100\b/.test(cleaned)) return "C130";
  if (/\bC5\b/.test(cleaned)) return "C5";
  if (/\bKC[- ]?(10|135|46)\b/.test(cleaned)) return "KC";
  if (/\bA400M\b/.test(cleaned)) return "A400M";

  if (/\bFA7X\b|\bFA8X\b/.test(cleaned)) return "FA7X";
  if (/\bGLF[3456]\b|\bG[4-8]00\b|\bGLEX\b|\bGALX\b/.test(cleaned)) {
    return "GLF5";
  }
  if (
    /\bLJ\d{2}\b|\bC25[A-Z]?\b|\bC56X\b|\bCL30\b|\bCL35\b|\bH25B\b/.test(
      cleaned,
    )
  ) {
    return "LJ";
  }

  return cleaned;
}

function isMilitaryTransportType(rawType: string, normalizedType: string) {
  return (
    /\b(transport|airlifter|tanker|awacs|surveillance|recon|patrol)\b/.test(
      rawType,
    ) ||
    /^(C\d+|KC\d+|A400M|AN\d+|IL\d+|TU95|P8|E3|E7|C130|C17|C5)$/.test(
      normalizedType,
    )
  );
}

function isMilitaryCombatType(rawType: string, normalizedType: string) {
  return (
    /\b(military|fighter|bomber|attack|interceptor|trainer|gunship)\b/.test(
      rawType,
    ) ||
    /^(F\d+|SU\d+|MIG\d+|TU160|B1|B2|B21|B52|A10|A4|A6|A7|AV8|T\d+|M2000|JAS39|L39|YAK130)$/.test(
      normalizedType,
    )
  );
}

function isGeneralAviationType(rawType: string, normalizedType: string) {
  return (
    /\b(light|prop|piston|ga|general aviation)\b/.test(rawType) ||
    /\b(cessna|piper|cirrus|diamond|mooney|bonanza|baron|skyhawk|skylane|seneca|seminole|beechcraft)\b/.test(
      rawType,
    ) ||
    /^(C\d{3}|PA\d{2,3}|SR\d{2}|DA\d{2}|BE\d{2})$/.test(normalizedType)
  );
}

function isBusinessType(rawType: string) {
  return /\b(business|biz|corporate|executive|private|gulfstream|falcon|learjet|citation|challenger|hawker|phenom|praetor|global express)\b/.test(
    rawType,
  );
}

export function getAircraftIconUrl(aircraftClass?: string, airForce?: string) {
  const rawType = aircraftClass?.trim().toLowerCase() ?? "";
  const af = airForce?.trim().toLowerCase() ?? "";
  const normalizedType = aircraftClass
    ? normalizeAircraftTypeForIcon(aircraftClass)
    : "";

  if (isHelicopterType(rawType)) return AIRCRAFT_ICONS.helicopter;
  if (!rawType) {
    return isMilitaryAirForce(af)
      ? AIRCRAFT_ICONS.military
      : DEFAULT_AIRCRAFT_ICON;
  }

  const isMilitary =
    isMilitaryAirForce(af) || isMilitaryCombatType(rawType, normalizedType);
  if (isMilitary) {
    return isMilitaryTransportType(rawType, normalizedType)
      ? AIRCRAFT_ICONS.militaryTransport
      : AIRCRAFT_ICONS.military;
  }

  if (
    /^(A300|A310|A330|A340|A350|A380|B747|B767|B777|B787|MD11|DC10|L1011|IL96)$/.test(
      normalizedType,
    ) ||
    /\b(widebody|heavy|super|dreamliner)\b/.test(rawType)
  ) {
    return AIRCRAFT_ICONS.heavy;
  }

  if (/^(B717|B727|DC8|DC9|MD80|MD90|F70|F100)$/.test(normalizedType)) {
    return AIRCRAFT_ICONS.rearEngineJet;
  }

  if (
    /^(E170|E175|E190|E195|A220|A318|A319|A320|A321|B737|B757|C919|MC21)$/.test(
      normalizedType,
    )
  ) {
    return AIRCRAFT_ICONS.narrowbody;
  }

  if (
    /^(CRJ)$/.test(normalizedType) ||
    /\b(canadair|regional jet)\b/.test(rawType)
  ) {
    return AIRCRAFT_ICONS.regionalJet;
  }

  if (
    /^(ERJ145|ATR42|ATR72|DH8D|SF34|SW4)$/.test(normalizedType) ||
    /\b(embraer regional|commuter|turboprop|dash 8|atr)\b/.test(rawType)
  ) {
    return AIRCRAFT_ICONS.smallRegional;
  }

  if (isBusinessType(rawType)) {
    if (/^(FA7X)$/.test(normalizedType)) return AIRCRAFT_ICONS.trijetBusiness;
    if (/^(GLF5)$/.test(normalizedType)) return AIRCRAFT_ICONS.largeBusiness;
    if (/^(LJ)$/.test(normalizedType)) return AIRCRAFT_ICONS.lightBusiness;
    return AIRCRAFT_ICONS.largeBusiness;
  }

  if (isGeneralAviationType(rawType, normalizedType)) {
    return AIRCRAFT_ICONS.generalAviation;
  }

  if (/\b(regional|commuter)\b/.test(rawType))
    return AIRCRAFT_ICONS.regionalJet;
  if (/\b(business|corporate|executive)\b/.test(rawType)) {
    return AIRCRAFT_ICONS.largeBusiness;
  }
  if (/\b(light|prop|ga|general aviation)\b/.test(rawType)) {
    return AIRCRAFT_ICONS.generalAviation;
  }

  return DEFAULT_AIRCRAFT_ICON;
}

export function getAircraftIconFilter(
  isEmergency: boolean,
  isSelected: boolean,
) {
  if (isEmergency) {
    return "brightness(0) saturate(100%) invert(41%) sepia(96%) saturate(2084%) hue-rotate(338deg) brightness(102%) contrast(102%) drop-shadow(0 1px 2px rgba(15,23,42,0.95)) drop-shadow(0 0 6px rgba(239,68,68,0.5))";
  }

  if (isSelected) {
    return "brightness(0) saturate(100%) invert(86%) sepia(60%) saturate(1670%) hue-rotate(346deg) brightness(104%) contrast(105%) drop-shadow(0 1px 2px rgba(15,23,42,0.98)) drop-shadow(0 0 6px rgba(250,204,21,0.45))";
  }

  return "brightness(0) saturate(100%) invert(83%) sepia(77%) saturate(1238%) hue-rotate(353deg) brightness(103%) contrast(103%) drop-shadow(0 1px 2px rgba(15,23,42,0.98)) drop-shadow(0 0 4px rgba(250,204,21,0.35))";
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
  const callsignDisplay = aircraft.callsign || "";
  const tagHeight = callsignDisplay
    ? isMobile
      ? 46
      : 56
    : isMobile
      ? 38
      : 52;
  const tagWidth = isMobile ? 104 : 132;
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
  const compactType = getCompactAircraftType(aircraft.type);
  const primaryLabel = aircraft.flightNo || aircraft.callsign || "N/A";
  const headerContent = compactType
    ? `<span style="display:block; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${primaryLabel}<span style="font-size: 78%; opacity: 0.72;"> ${compactType}</span></span>`
    : `<span style="display:block; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${primaryLabel}</span>`;
  const detailLabel = `${displayAlt} ${displaySpeed}`;

  const isEmergency = aircraft.squawk && EMERGENCY_SQUAWKS.has(aircraft.squawk);
  const isIdentActive =
    aircraft.identActive ||
    (typeof aircraft.identUntil === "number" &&
      aircraft.identUntil > Date.now());

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

  const identStyle = isIdentActive
    ? `
    position: absolute;
    top: ${(totalHeight - planeSize) / 2 - 4}px;
    left: -4px;
    width: ${planeSize + 8}px;
    height: ${planeSize + 8}px;
    border-radius: 9999px;
    border: 2px solid rgba(251, 191, 36, 0.95);
    animation: radar-ident-pulse 1s ease-in-out infinite;
    z-index: 1;
  `
    : "";

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
  const detailContent = `
    <div class="
      flex flex-col px-1.5 py-1
      rounded-sm
      bg-black/40 backdrop-blur
      border
      ${isEmergency ? "border-red-500/70" : "border-cyan-400/30"}
      font-mono
      ${isEmergency ? "text-red-400" : "text-cyan-200"}
    " style="min-height: ${tagHeight}px; box-sizing: border-box; font-size: ${fontSize}; line-height: 1.3;">
      <div class="flex items-center justify-between font-semibold" style="font-size: ${isMobile ? "11px" : "13px"};">
        ${headerContent}
        ${isEmergency ? `<span class="text-red-500 animate-pulse">!</span>` : ""}
      </div>
      <div class="opacity-80" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${detailLabel}
      </div>
      ${callsignDisplay ? `<div class="opacity-60" style="font-size: ${isMobile ? "8px" : "10px"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${callsignDisplay}</div>` : ""}
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px; pointer-events: auto; cursor: pointer;">
        ${isIdentActive ? `<div style="${identStyle} pointer-events: none;"></div>` : ""}
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
  const isIdentActive =
    aircraft.identActive ||
    (typeof aircraft.identUntil === "number" &&
      aircraft.identUntil > Date.now());

  const isCurrentAircraftSelected =
    selectedAircraftId &&
    (aircraft.id === selectedAircraftId ||
      aircraft.callsign === selectedAircraftId);

  const dotSize = isCurrentAircraftSelected
    ? isMobile
      ? 7
      : 9
    : isMobile
      ? 4
      : 5;
  const headingLineLength = isCurrentAircraftSelected
    ? isMobile
      ? 18
      : 24
    : isMobile
      ? 13
      : 18;
  const callsignDisplay = aircraft.callsign || "";
  const shouldShowLabel =
    showTags && (!selectedAircraftId || Boolean(isCurrentAircraftSelected));
  const labelHeight = callsignDisplay
    ? isMobile
      ? 30
      : 34
    : isMobile
      ? 20
      : 24;
  const labelWidth = isMobile ? 108 : 138;
  const connectorGap = isMobile ? 8 : 10;
  const labelOffsetFromDot = isMobile ? 16 : 20;
  const centerYPadding = isMobile ? 8 : 10;
  const compactPadding = 8;
  const totalHeight = shouldShowLabel
    ? labelHeight + centerYPadding * 2
    : dotSize + compactPadding * 2;
  const centerY = totalHeight / 2;
  const dotLeft = compactPadding;
  const dotCenterX = dotLeft + dotSize / 2;
  const labelTop = shouldShowLabel
    ? Math.max(0, Math.min(totalHeight - labelHeight, centerY - labelHeight + 6))
    : centerY - dotSize / 2;
  const labelLeft = shouldShowLabel ? dotCenterX + labelOffsetFromDot : dotLeft;
  const connectorWidth = shouldShowLabel
    ? Math.max(0, labelLeft - dotCenterX - connectorGap)
    : 0;
  const totalWidth = shouldShowLabel
    ? labelLeft + labelWidth + 4
    : dotLeft + dotSize + compactPadding;

  const anchorX = dotCenterX;
  const anchorY = centerY;

  const altMSL = aircraft.altMSL ?? aircraft.alt;
  const altAGL = aircraft.alt;
  const isOnGround = altAGL < 100;
  const displayAlt = isOnGround
    ? `${altAGL.toFixed(0)}`
    : formatAltitude(altMSL, unitPrefs.altitudeUnit);
  const displaySpeed = isOnGround
    ? `${aircraft.speed.toFixed(0)}kt`
    : `${formatSpeed(aircraft.speed, unitPrefs.speedUnit, altMSL)}${speedSuffix(unitPrefs.speedUnit)}`;
  const compactType = getCompactAircraftType(aircraft.type);
  const primaryLabel = aircraft.flightNo || aircraft.callsign || "N/A";
  const headerContent = compactType
    ? `<span style="display:block; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${primaryLabel}<span style="font-size: 78%; opacity: 0.72;"> ${compactType}</span></span>`
    : `<span style="display:block; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${primaryLabel}</span>`;
  const detailLabel = `${displayAlt} ${displaySpeed}`;

  // Color scheme: selected = bright green, emergency = red, normal = cyan
  const dotColor = isEmergency
    ? "#ef4444"
    : isIdentActive
      ? "#fbbf24"
      : isCurrentAircraftSelected
        ? "#4ade80"
        : "#22d3ee";
  const glowColor = isEmergency
    ? "rgba(239,68,68,0.8)"
    : isIdentActive
      ? "rgba(251,191,36,0.95)"
      : isCurrentAircraftSelected
        ? "rgba(74,222,128,0.9)"
        : "rgba(0,255,255,0.5)";
  const connectorColor = isEmergency
    ? "rgba(248,113,113,0.8)"
    : isCurrentAircraftSelected
      ? "rgba(187,247,208,0.95)"
      : "rgba(226,232,240,0.7)";
  const radarLineBearing = getRadarLineBearing(aircraft);

  const dotStyle = `
    position: absolute;
    top: ${centerY - dotSize / 2}px;
    left: ${dotLeft}px;
    width: ${dotSize}px;
    height: ${dotSize}px;
    border-radius: 9999px;
    background-color: ${dotColor};
    box-shadow: 0 0 ${isCurrentAircraftSelected ? "8px" : "4px"} ${glowColor}${isCurrentAircraftSelected ? `, 0 0 14px ${glowColor}` : ""};
    ${isCurrentAircraftSelected ? "animation: radar-selected-pulse 1.5s ease-in-out infinite;" : ""}
  `;

  const identRingStyle = isIdentActive
    ? `
    position: absolute;
    top: ${centerY - dotSize / 2 - 6}px;
    left: ${dotLeft - 6}px;
    width: ${dotSize + 12}px;
    height: ${dotSize + 12}px;
    border-radius: 9999px;
    border: 2px solid rgba(251, 191, 36, 0.95);
    animation: radar-ident-pulse 1s ease-in-out infinite;
  `
    : "";

  // Selection ring around selected aircraft
  const selectionRingStyle = isCurrentAircraftSelected
    ? `
    position: absolute;
    top: ${centerY - dotSize / 2 - 4}px;
    left: ${dotLeft - 4}px;
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
    top: ${centerY - (isCurrentAircraftSelected ? 1 : 0.5)}px;
    left: ${dotCenterX}px;
    width: ${headingLineLength}px;
    height: ${isCurrentAircraftSelected ? 2 : 1}px;
    background-color: ${dotColor};
    transform-origin: 0% 50%;
    transform: rotate(${radarLineBearing - 90}deg);
    ${isCurrentAircraftSelected ? `box-shadow: 0 0 4px ${glowColor};` : ""}
  `;

  const connectorLineStyle = `
    position: absolute;
    top: ${centerY}px;
    left: ${dotCenterX + connectorGap}px;
    width: ${connectorWidth}px;
    height: 1px;
    background: linear-gradient(90deg, ${connectorColor}, rgba(148, 163, 184, 0.35));
    transform: translateY(-0.5px);
    ${!shouldShowLabel ? "display: none;" : ""}
  `;

  const labelStyle = `
    position: absolute;
    top: ${labelTop}px;
    left: ${labelLeft}px;
    width: ${labelWidth}px;
    cursor: pointer;
    z-index: 1000;
    ${!shouldShowLabel ? "display: none;" : ""}
  `;

  const detailContent = `
    <div style="
      min-height: ${labelHeight}px;
      box-sizing: border-box;
      color: ${isEmergency ? "#fca5a5" : isCurrentAircraftSelected ? "#dcfce7" : "#f8fafc"};
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: ${isMobile ? "10px" : "12px"};
      line-height: 1.05;
      letter-spacing: 0.03em;
      text-shadow: 0 0 6px ${glowColor};
    ">
      <div style="font-weight: 700; font-size: ${isMobile ? "11px" : "13px"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${headerContent}${isEmergency ? " !" : ""}
      </div>
      <div style="margin-top: 2px; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${detailLabel}
      </div>
    </div>
  `;

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px; overflow: visible; pointer-events: auto; cursor: pointer;">
        ${isIdentActive ? `<div style="${identRingStyle} pointer-events: none;"></div>` : ""}
        ${isCurrentAircraftSelected ? `<div style="${selectionRingStyle} pointer-events: none;"></div>` : ""}
        <div style="${dotStyle} pointer-events: none;"></div>
        <div style="${headingLineStyle} pointer-events: none;"></div>
        <div style="${connectorLineStyle} pointer-events: none;"></div>
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
