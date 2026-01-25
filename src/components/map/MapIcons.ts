import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";

const EMERGENCY_SQUAWKS = new Set(["7700", "7600", "7500"]);

// Aircraft category types
type AircraftCategory = "light" | "turboprop" | "medium" | "heavy" | "super" | "helicopter" | "military";

// Light aircraft (single/twin engine piston)
const LIGHT_AIRCRAFT = new Set([
  "C172", "C152", "C182", "C206", "C208", "C210", "C310", "C340", "C402", "C414",
  "PA28", "PA32", "PA34", "PA44", "PA46", "PA18", "PA24", "PA30",
  "BE33", "BE35", "BE36", "BE55", "BE58", "BE76", "BE95", "BE99",
  "SR20", "SR22", "TBM7", "TBM8", "TBM9", "PC12", "PC24",
  "DA40", "DA42", "DA62", "M20P", "M20T", "P28A", "P28B", "P28R",
  "AA5", "AA1", "TB20", "TB21", "SF50", "EVOT", "P210", "T210",
]);

// Turboprop aircraft
const TURBOPROP_AIRCRAFT = new Set([
  "AT43", "AT45", "AT72", "AT75", "AT76", "ATR", "ATP",
  "DH8A", "DH8B", "DH8C", "DH8D", "DHC6", "DHC7",
  "SF34", "SB20", "JS31", "JS32", "JS41",
  "B190", "B350", "BE20", "BE30", "BE40",
  "C130", "C295", "CN35", "E120", "L188", "P180",
  "Q100", "Q200", "Q300", "Q400",
]);

// Medium jets (regional jets)
const MEDIUM_JETS = new Set([
  "CRJ1", "CRJ2", "CRJ7", "CRJ9", "CRJX",
  "E135", "E145", "E170", "E175", "E190", "E195", "E75S", "E75L", "E290", "E295",
  "A318", "A319",
  "B731", "B732", "B733", "B734", "B735", "B736",
  "F70", "F100", "F28", "DC9", "MD80", "MD81", "MD82", "MD83", "MD87", "MD88",
  "BCS1", "BCS3", // A220
  "C510", "C525", "C550", "C560", "C650", "C680", "C700", "C750",
  "CL30", "CL35", "CL60", "GLEX", "GL5T", "GL7T",
  "LJ31", "LJ35", "LJ40", "LJ45", "LJ60", "LJ70", "LJ75",
  "FA50", "FA7X", "FA8X", "F900", "F2TH", "GALX", "G150", "G200", "G280",
  "E35L", "E50P", "E55P", "EA50", "H25B", "H25C", "HA4T", "HDJT",
  "PRM1", "PC24",
]);

// Heavy jets (narrowbody and widebody)
const HEAVY_JETS = new Set([
  "A320", "A321", "A20N", "A21N",
  "B737", "B738", "B739", "B37M", "B38M", "B39M", "B3XM",
  "B752", "B753", "B762", "B763", "B764",
  "B772", "B773", "B77L", "B77W", "B778", "B779",
  "B788", "B789", "B78X",
  "A332", "A333", "A338", "A339",
  "A342", "A343", "A345", "A346",
  "A359", "A35K",
  "MD10", "MD11", "DC10",
  "L101", "IL96", "IL86",
  "G450", "G500", "G550", "G600", "G650", "GLEX", "GLF4", "GLF5", "GLF6",
]);

// Super heavy (very large aircraft)
const SUPER_HEAVY = new Set([
  "A380", "A388",
  "B741", "B742", "B743", "B744", "B748", "B74D", "B74R", "B74S",
  "A124", "AN24", "AN22", "A225",
  "C5", "C5M",
]);

// Helicopters
const HELICOPTERS = new Set([
  "EC35", "EC45", "EC55", "EC75", "EC20", "EC30", "EC25", "EC65",
  "AS50", "AS55", "AS65", "AS32", "AS33", "AS35", "AS55", "AS65",
  "B06", "B06T", "B105", "B212", "B214", "B222", "B230", "B407", "B412", "B429", "B430", "B47G", "B505",
  "R22", "R44", "R66",
  "S76", "S92", "S61", "S64", "S70", "S58", "S55",
  "A109", "A119", "A139", "A149", "A169", "A189", "AW09", "AW39", "AW69", "AW89",
  "MD52", "MD50", "MD60", "MDEX",
  "H125", "H130", "H135", "H145", "H155", "H160", "H175", "H215", "H225",
  "UH1", "UH60", "AH64", "CH47", "CH53",
  "MI8", "MI17", "MI24", "MI26", "MI28", "KA32", "KA50", "KA52",
]);

// Military aircraft
const MILITARY_AIRCRAFT = new Set([
  "F16", "F15", "F18", "F22", "F35", "FA18",
  "A10", "A400", "F117", "B1", "B2", "B52",
  "C17", "C5", "C130", "C135", "KC10", "KC46", "KC135",
  "E3", "E6", "E8", "AWAC",
  "EUFI", "RFAL", "TORN", "HAWK", "T38", "T45",
  "MIG", "SU27", "SU30", "SU35", "SU57",
  "EF2K", "GR4", "NIMR", "SENT", "TYPH",
  "P3", "P8", "RC135",
]);

// Normalize aircraft type string to ICAO code
// e.g., "Airbus A350-900" -> "A350", "Boeing 777-300ER" -> "B777"
const normalizeTypeCode = (typeString: string): string => {
  if (!typeString) return "";
  const cleaned = typeString.trim().toUpperCase();

  // A380, A350, A320, etc.
  const airbusMatch = /A\d{3}/.exec(cleaned);
  if (airbusMatch) return airbusMatch[0];

  // B737, B777, B787, etc.
  const boeingMatch = /B\d{3}/.exec(cleaned);
  if (boeingMatch) return boeingMatch[0];

  // "Boeing 777", "Boeing 737-800", "777-300" -> B777, B737
  const boeingNameMatch = /\b(7[0-9]7)\b/.exec(cleaned);
  if (boeingNameMatch) return `B${boeingNameMatch[1]}`;

  // CRJ, ERJ, E175, E190, etc.
  const embraerMatch = /E\d{3}|ERJ\d{3}|CRJ\d{2,3}/.exec(cleaned);
  if (embraerMatch) return embraerMatch[0];

  // ATR 42, ATR 72, etc.
  const atrMatch = /ATR?\s*(\d{2})/.exec(cleaned);
  if (atrMatch) return `AT${atrMatch[1]}`;

  // DHC-8, Dash 8, Q400, etc.
  if (cleaned.includes("Q400") || cleaned.includes("DASH 8") || cleaned.includes("DHC-8") || cleaned.includes("DH8")) {
    return "DH8D";
  }

  // Cessna 172, C172, etc.
  const cessnaMatch = /C\d{3}|CESSNA\s*(\d{3})/.exec(cleaned);
  if (cessnaMatch) return cessnaMatch[1] ? `C${cessnaMatch[1]}` : cessnaMatch[0];

  // Helicopter patterns
  if (cleaned.includes("HELICOPTER") || cleaned.includes("HELI") ||
      /EC\d{2,3}|AS\d{2,3}|H\d{3}|R\d{2}|S\d{2}|BELL|ROBINSON|SIKORSKY|AIRBUS H/.test(cleaned)) {
    return "HELI";
  }

  // Return the original cleaned string or first word
  const firstWord = cleaned.split(/[\s-]/)[0];
  return firstWord || cleaned;
};

// Function to determine aircraft category from type string
const getAircraftCategory = (typeString: string): AircraftCategory => {
  const rawType = typeString?.toUpperCase() || "";
  const code = normalizeTypeCode(typeString);

  // Check for helicopter keywords first
  if (rawType.includes("HELICOPTER") || rawType.includes("HELI") || code === "HELI" ||
      HELICOPTERS.has(code) || /^(EC|AS|H1|H2|R\d|S\d|B4|AW)/.test(code)) {
    return "helicopter";
  }

  // Military patterns
  if (MILITARY_AIRCRAFT.has(code) ||
      rawType.includes("MILITARY") || rawType.includes("FIGHTER") ||
      /^(F-?\d|C-?\d{1,2}$|KC|E-\d)/.test(code)) {
    return "military";
  }

  // Super heavy (A380, B747)
  if (SUPER_HEAVY.has(code) || code.startsWith("A38") || code.startsWith("B74") ||
      rawType.includes("A380") || rawType.includes("747")) {
    return "super";
  }

  // Heavy jets (A320-A350, B737-B787, widebodies)
  if (HEAVY_JETS.has(code) ||
      /^A3[2-5]/.test(code) || /^B7[3-8]/.test(code) ||
      rawType.includes("A320") || rawType.includes("A321") ||
      rawType.includes("A330") || rawType.includes("A340") || rawType.includes("A350") ||
      rawType.includes("737") || rawType.includes("757") || rawType.includes("767") ||
      rawType.includes("777") || rawType.includes("787")) {
    return "heavy";
  }

  // Medium jets (regional jets, smaller Airbus/Boeing)
  if (MEDIUM_JETS.has(code) ||
      /^(CRJ|E\d{2,3}|ERJ|BCS|A31)/.test(code) ||
      rawType.includes("CRJ") || rawType.includes("EMBRAER") ||
      rawType.includes("A318") || rawType.includes("A319") || rawType.includes("A220")) {
    return "medium";
  }

  // Turboprop
  if (TURBOPROP_AIRCRAFT.has(code) ||
      /^(AT|DH|Q\d|SF|JS)/.test(code) ||
      rawType.includes("ATR") || rawType.includes("TURBOPROP") ||
      rawType.includes("DASH") || rawType.includes("Q400")) {
    return "turboprop";
  }

  // Light aircraft
  if (LIGHT_AIRCRAFT.has(code) ||
      /^(C1|C2|PA|SR|DA|BE|TB|M20|P28)/.test(code) ||
      rawType.includes("CESSNA") || rawType.includes("PIPER") ||
      rawType.includes("CIRRUS") || rawType.includes("BEECH") ||
      rawType.includes("DIAMOND")) {
    return "light";
  }

  // Default to medium if unknown
  return "medium";
};

// SVG icons for each aircraft category - showing engine configuration
const AIRCRAFT_SVGS: Record<AircraftCategory, string> = {
  // Light: Single engine with propeller at nose
  light: `<svg viewBox="0 0 32 32" fill="currentColor">
    <!-- Fuselage -->
    <path d="M16 6L15 10V14L9 18V20L15 18.5V25L12 27V29L16 28L20 29V27L17 25V18.5L23 20V18L17 14V10L16 6Z"/>
    <!-- Single propeller at nose -->
    <ellipse cx="16" cy="4" rx="4" ry="1.5" fill-opacity="0.7"/>
  </svg>`,

  // Turboprop: Twin propellers on wings
  turboprop: `<svg viewBox="0 0 32 32" fill="currentColor">
    <!-- Fuselage -->
    <path d="M16 4L14.5 9V13L7 17V20L14.5 18V25L11 27V29L16 28L21 29V27L17.5 25V18L25 20V17L17.5 13V9L16 4Z"/>
    <!-- Left propeller disc -->
    <ellipse cx="9" cy="16" rx="3" ry="1.2" fill-opacity="0.7"/>
    <line x1="9" y1="14" x2="9" y2="18" stroke="currentColor" stroke-width="1.5"/>
    <!-- Right propeller disc -->
    <ellipse cx="23" cy="16" rx="3" ry="1.2" fill-opacity="0.7"/>
    <line x1="23" y1="14" x2="23" y2="18" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  // Medium: 2 rear-mounted engines (like CRJ/E-Jets)
  medium: `<svg viewBox="0 0 32 32" fill="currentColor">
    <!-- Fuselage -->
    <path d="M16 2L14 8V13L6 18V21L14 19V25L10 27V30L16 28L22 30V27L18 25V19L26 21V18L18 13V8L16 2Z"/>
    <!-- Left rear engine -->
    <ellipse cx="13" cy="22" rx="1.5" ry="2.5"/>
    <!-- Right rear engine -->
    <ellipse cx="19" cy="22" rx="1.5" ry="2.5"/>
  </svg>`,

  // Heavy: 2 underwing engines (like A320, B737, B777)
  heavy: `<svg viewBox="0 0 32 32" fill="currentColor">
    <!-- Fuselage -->
    <path d="M16 1L13 9V13L3 19V23L13 20V26L8 28V31L16 29L24 31V28L19 26V20L29 23V19L19 13V9L16 1Z"/>
    <!-- Left underwing engine -->
    <ellipse cx="9" cy="17" rx="2" ry="3"/>
    <!-- Right underwing engine -->
    <ellipse cx="23" cy="17" rx="2" ry="3"/>
  </svg>`,

  // Super: 4 underwing engines (like A380, B747)
  super: `<svg viewBox="0 0 32 32" fill="currentColor">
    <!-- Fuselage - wider body -->
    <path d="M16 0L12 10V14L1 21V25L12 22V27L6 29V32L16 30L26 32V29L20 27V22L31 25V21L20 14V10L16 0Z"/>
    <!-- 4 underwing engines -->
    <ellipse cx="6" cy="19" rx="1.8" ry="2.8"/>
    <ellipse cx="11" cy="17" rx="1.8" ry="2.8"/>
    <ellipse cx="21" cy="17" rx="1.8" ry="2.8"/>
    <ellipse cx="26" cy="19" rx="1.8" ry="2.8"/>
  </svg>`,

  // Helicopter: Main rotor and tail rotor
  helicopter: `<svg viewBox="0 0 32 32" fill="currentColor">
    <!-- Body -->
    <ellipse cx="12" cy="18" rx="5" ry="3"/>
    <!-- Rotor mast -->
    <rect x="11" y="12" width="2" height="4"/>
    <!-- Main rotor blades -->
    <ellipse cx="12" cy="11" rx="10" ry="1.5" fill-opacity="0.6"/>
    <!-- Tail boom -->
    <path d="M17 17.5L27 16.5V18L17 19Z"/>
    <!-- Tail rotor -->
    <ellipse cx="28" cy="17" rx="1" ry="3" fill-opacity="0.7"/>
    <!-- Skids -->
    <rect x="7" y="21" width="10" height="1.5" rx="0.5"/>
  </svg>`,

  // Military: Fighter jet with afterburners
  military: `<svg viewBox="0 0 32 32" fill="currentColor">
    <!-- Fuselage - delta wing -->
    <path d="M16 1L14 12V14L5 22L7 25L14 20V25L10 27V29L16 27L22 29V27L18 25V20L25 25L27 22L18 14V12L16 1Z"/>
    <!-- Tail engines/afterburners -->
    <ellipse cx="14" cy="26" rx="1.2" ry="2"/>
    <ellipse cx="18" cy="26" rx="1.2" ry="2"/>
  </svg>`,
};

// Get SVG for aircraft category with optional color override
const getAircraftSVG = (category: AircraftCategory, color: string, size: number): string => {
  const svg = AIRCRAFT_SVGS[category];
  return `<div style="width:${size}px;height:${size}px;color:${color};">${svg}</div>`;
};

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

// Category colors for normal mode
const CATEGORY_COLORS: Record<AircraftCategory, string> = {
  light: "#22d3ee",      // cyan
  turboprop: "#a78bfa",  // purple
  medium: "#4ade80",     // green
  heavy: "#facc15",      // yellow
  super: "#fb923c",      // orange
  helicopter: "#f472b6", // pink
  military: "#ef4444",   // red
};

export const getAircraftDivIcon = (
  aircraft: PositionUpdate & { altMSL?: number },
  selectedAircraftId: string | null,
  showTags = true,
) => {
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
  const category = getAircraftCategory(aircraft.type);
  const iconColor = isEmergency ? "#ef4444" : CATEGORY_COLORS[category];

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
    filter: drop-shadow(0 0 3px ${iconColor}80);
    ${
      isEmergency
        ? `animation: pulse 1s infinite alternate;`
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

  const aircraftSvg = getAircraftSVG(category, iconColor, planeSize);

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px; pointer-events: auto; cursor: pointer;">
        <div style="${planeStyle} pointer-events: none;">
          ${aircraftSvg}
        </div>
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
  const dotSize = 8;
  const headingLineLength = 14;
  const labelHeight = 38;
  const labelWidth = 100;
  const labelOffsetFromDot = 16;

  const totalWidth =
    dotSize + headingLineLength + labelOffsetFromDot + labelWidth;
  const totalHeight = Math.max(dotSize, labelHeight);

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
  const category = getAircraftCategory(aircraft.type);
  const dotColor = isEmergency ? "#ef4444" : CATEGORY_COLORS[category];

  const isCurrentAircraftSelected =
    selectedAircraftId &&
    (aircraft.id === selectedAircraftId ||
      aircraft.callsign === selectedAircraftId);

  const dotStyle = `
    position: absolute;
    top: ${(totalHeight - dotSize) / 2}px;
    left: 0;
    width: ${dotSize}px;
    height: ${dotSize}px;
    border-radius: 9999px;
    background-color: ${dotColor};
    box-shadow: 0 0 5px ${dotColor}80;
  `;

  const headingLineStyle = `
    position: absolute;
    top: ${totalHeight / 2 - 1}px;
    left: ${dotSize / 2}px;
    width: ${headingLineLength}px;
    height: 2px;
    background-color: ${dotColor};
    transform-origin: 0% 50%;
    transform: rotate(${(aircraft.heading || 0) - 90}deg);
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
