// ~/lib/easterEggs.ts
import type { PositionUpdate } from "~/lib/aircraft-store";

const now = new Date();
const month = now.getMonth(); // 0 = January, 11 = December
const date = now.getDate();

export const ENABLE_EASTER_EGGS =
  (month === 11 && date >= 25) || (month === 0 && date <= 2);
  
export const EASTER_EGG_FLAGS = {
  secretAircraft: true,
  ufoSpawn: true,
  konamiCode: true,
  rainbowRadar: true,
  happyNewYear: true,
  doubleClickClock: true,
  supersonicMode: true,
  nightOpsMode: true,
  rotateMapEasterEgg: true,
  topGunSpawn: true,
  area51Alert: true,
};

function mockAircraft(overrides: Partial<PositionUpdate>): PositionUpdate {
  const now = Date.now();
  return {
    id: "mock-" + Math.random().toString(36).slice(2, 9),
    callsign: "UNKNOWN",
    type: "A",
    lat: 0,
    lon: 0,
    alt: 0,
    altMSL: 0,
    heading: 0,
    speed: 0,
    flightNo: "",
    departure: "",
    arrival: "",
    takeoffTime: "",
    squawk: "",
    flightPlan: "",
    vspeed: "0",
    nextWaypoint: "",
    ts: now,
    lastSeen: now,
    ...overrides,
  };
}

export function maybeAddSecretAircraft(aircrafts: PositionUpdate[]) {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.secretAircraft) return aircrafts;
  if (!aircrafts.some((a) => a.callsign === "SR71")) {
    if (Math.random() < 0.002) {
      aircrafts.push(
        mockAircraft({
          id: "SR71",
          callsign: "SR71",
          lat: 37 + Math.random() * 5,
          lon: -122 + Math.random() * 5,
          alt: 80000,
          altMSL: 80000,
          speed: 2200,
          heading: Math.random() * 360,
        }),
      );
    }
  }
  return aircrafts;
}

export function maybeSpawnUFO(aircrafts: PositionUpdate[]) {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.ufoSpawn) return aircrafts;
  const existing = aircrafts.find((a) => a.callsign === "UFO-01");
  if (!existing && Math.random() < 0.0015) {
    aircrafts.push(
      mockAircraft({
        id: "UFO-01",
        callsign: "UFO-01",
        lat: 37.5 + Math.random() * 2 - 1,
        lon: -122 + Math.random() * 2 - 1,
        alt: 45000,
        altMSL: 45000,
        speed: 2100,
        heading: Math.random() * 360,
      }),
    );
  }
  return aircrafts;
}

export function maybeAddTopGunAircraft(aircrafts: PositionUpdate[]) {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.topGunSpawn) return aircrafts;
  if (aircrafts.some((a) => a.callsign === "TOPGUN")) return aircrafts;
  if (Math.random() < 0.002) {
    aircrafts.push(
      mockAircraft({
        id: "TOPGUN",
        callsign: "TOPGUN",
        lat: 32.82 + Math.random() * 1,
        lon: -117.13 + Math.random() * 1,
        alt: 20000 + Math.random() * 5000,
        altMSL: 20000,
        speed: 980 + Math.random() * 100,
        heading: Math.random() * 360,
      }),
    );
  }
  return aircrafts;
}

export function enableKeyboardEasterEggs() {
  if (!ENABLE_EASTER_EGGS) return;
  window.addEventListener("keydown", (e) => {
    if (e.shiftKey && e.key.toLowerCase() === "a") {
      if (EASTER_EGG_FLAGS.area51Alert) {
        alert("🛸 Restricted airspace detected: Groom Lake facility online.");
      }
    }
    if (e.shiftKey && e.key.toLowerCase() === "t") {
      if (EASTER_EGG_FLAGS.topGunSpawn) {
        alert("🔥 Maverick inbound — map spin engaged!");
        const mapElm = document.querySelector(".leaflet-container");
        if (mapElm instanceof HTMLElement) {
          mapElm.style.transition = "transform 5s ease-in-out";
          mapElm.style.transform = "rotate(360deg)";
          setTimeout(() => {
            mapElm.style.transform = "";
          }, 6000);
        }
      }
    }
  });
}

export function useKonamiCode(callback: () => void) {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.konamiCode) return;
  const sequence = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];
  let index = 0;
  const handler = (event: KeyboardEvent) => {
    if (event.key === sequence[index]) {
      index++;
      if (index === sequence.length) {
        callback();
        index = 0;
      }
    } else {
      index = 0;
    }
  };
  document.addEventListener("keydown", handler);
}

export function injectRainbowRadar() {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.rainbowRadar) return;
  const css = `
    @keyframes radarRainbow {
      0% { filter: hue-rotate(0deg); }
      100% { filter: hue-rotate(360deg); }
    }
    .leaflet-container {
      animation: radarRainbow 10s linear infinite;
    }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
}

export function showNewYearMessage() {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.happyNewYear) return;
  const now = new Date();
  if (now.getMonth() === 0 && now.getDate() === 1) {
    alert("🎉 Happy New Year, Captain!");
  }
}

export function handleClockDoubleClick() {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.doubleClickClock) return;
  alert("🕒 Time flies... when you control it.");
}

let lastBoom = 0;
export function detectSupersonicAircraft(aircrafts: PositionUpdate[]) {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.supersonicMode) return;
  const now = Date.now();
  if (
    aircrafts.some((a) => a.speed && a.speed > 560) &&
    now - lastBoom > 5000
  ) {
    lastBoom = now;
    const boom = new Audio(
      "https://9sczucfuom.ufs.sh/f/5HjOZMKb42YigSE2ofuGMt4o9J6KQOlhHZwcWbUNiB3r8Vvq",
    );
    boom.play().catch(() => null);
  }
}

export function enableNightOps() {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.nightOpsMode) return;
  document.body.style.background = "black";
  document.body.style.transition = "background 1s";
  alert("🌒 Night Ops Mode: Engaged.");
}

export function rotateMapOnSecretCallsign(aircrafts: PositionUpdate[]) {
  if (!ENABLE_EASTER_EGGS || !EASTER_EGG_FLAGS.rotateMapEasterEgg) return;
  if (aircrafts.some((a) => a.callsign?.toLowerCase() === "topgun")) {
    const mapElm = document.querySelector(".leaflet-container");
    if (mapElm instanceof HTMLElement) {
      mapElm.style.transition = "transform 5s ease-in-out";
      mapElm.style.transform = "rotate(360deg)";
      setTimeout(() => {
        mapElm.style.transform = "";
      }, 6000);
    }
  }
}