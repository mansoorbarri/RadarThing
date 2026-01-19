// @ts-nocheck
// ==UserScript==
// @name         RadarThing (Local Testing)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Combined RadarThing userscript for local testing
// @author       xyzmani
// @match        http://*/geofs.php*
// @match        https://*/geofs.php*
// @grant        none
// ==/UserScript==

// =============================================
// PART 1: Data Transmission & Command Handling
// =============================================
(function () {
  "use strict";

  // ========== CONFIGURATION ==========
  // Set to true for local testing, false for production
  const USE_LOCAL_SERVER = true;
  const LOCAL_SERVER_URL = "http://localhost:3001";
  const PROD_SERVER_URL = "https://sse.radarthing.com";
  // ====================================

  const BASE_URL = USE_LOCAL_SERVER ? LOCAL_SERVER_URL : PROD_SERVER_URL;
  const API_URL = `${BASE_URL}/api/atc/position`;
  const COMMANDS_URL = `${BASE_URL}/api/commands`;
  const SEND_INTERVAL_MS = 5000;
  const COMMAND_POLL_INTERVAL_MS = 2000;

  console.log(`[RadarThing] Using ${USE_LOCAL_SERVER ? "LOCAL" : "PRODUCTION"} server: ${BASE_URL}`);

  let info = { active: false, dep: "", arr: "", flt: "", sqk: "" };
  let wasOnGround = true;
  let takeoffTimeUTC = "";

  // Command execution handlers
  function executeCommand(cmd) {
    if (!geofs?.autopilot || !geofs?.aircraft?.instance) {
      console.warn("[RadarThing] Cannot execute command - GeoFS not ready");
      return;
    }

    console.log("[RadarThing] Executing command:", cmd.type, cmd.value);

    try {
      switch (cmd.type) {
        case "setSpeed":
          if (typeof geofs.autopilot.setSpeed === "function") {
            geofs.autopilot.setSpeed(Number(cmd.value));
          }
          break;

        case "setAltitude":
          if (typeof geofs.autopilot.setAltitude === "function") {
            geofs.autopilot.setAltitude(Number(cmd.value));
          }
          break;

        case "setHeading":
          if (typeof geofs.autopilot.setCourse === "function") {
            geofs.autopilot.setCourse(Number(cmd.value));
          }
          break;

        case "setVS":
          if (typeof geofs.autopilot.setVS === "function") {
            geofs.autopilot.setVS(Number(cmd.value));
          }
          break;

        case "setSquawk":
          // Update the squawk in flight info
          if (info) {
            info.sqk = String(cmd.value);
            window.dispatchEvent(
              new CustomEvent("atc-data-sync", { detail: info })
            );
          }
          break;

        case "disableNav":
          // Disable NAV mode to allow manual heading control
          if (geofs.autopilot && geofs.autopilot.modes) {
            geofs.autopilot.modes.heading = true;
            geofs.autopilot.modes.nav = false;
          }
          break;

        case "toggleAutopilot":
          if (cmd.value && typeof geofs.autopilot.turnOn === "function") {
            geofs.autopilot.turnOn();
          } else if (!cmd.value && typeof geofs.autopilot.turnOff === "function") {
            geofs.autopilot.turnOff();
          }
          break;

        default:
          console.warn("[RadarThing] Unknown command type:", cmd.type);
      }

      // Notify UI of command execution
      window.dispatchEvent(
        new CustomEvent("radarthing-command-executed", {
          detail: { type: cmd.type, value: cmd.value, success: true },
        })
      );
    } catch (err) {
      console.error("[RadarThing] Command execution error:", err);
      window.dispatchEvent(
        new CustomEvent("radarthing-command-executed", {
          detail: { type: cmd.type, value: cmd.value, success: false, error: err.message },
        })
      );
    }
  }

  // Poll for commands from RadarThing server
  async function pollCommands() {
    if (!info.active || !geofs?.userRecord) return;

    const id = geofs.userRecord.googleid || geofs.userRecord.callsign;
    if (!id) return;

    try {
      const res = await fetch(`${COMMANDS_URL}/${encodeURIComponent(id)}`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.commands && data.commands.length > 0) {
        console.log(`[RadarThing] Received ${data.commands.length} commands`);
        data.commands.forEach(executeCommand);
      }
    } catch (err) {
      // Silent fail - server might be unavailable
    }
  }

  // Start command polling
  setInterval(pollCommands, COMMAND_POLL_INTERVAL_MS);

  function broadcastStatus() {
    let status = { text: "Flight info required", color: "#e74c3c" };
    if (info.active) {
      status = { text: "Transmitting to API", color: "#27ae60" };
    }
    window.dispatchEvent(
      new CustomEvent("atc-status-update", { detail: status }),
    );
  }

  window.addEventListener("atc-data-sync", (e) => {
    info = e.detail;
    broadcastStatus();
  });

  function calculateAGL() {
    try {
      const altitudeMSL = geofs?.animation?.values?.altitude;
      const groundElevationFeet = geofs?.animation?.values?.groundElevationFeet;
      const aircraft = geofs?.aircraft?.instance;
      if (
        typeof altitudeMSL === "number" &&
        typeof groundElevationFeet === "number" &&
        aircraft?.collisionPoints?.length >= 2
      ) {
        const collisionZFeet =
          aircraft.collisionPoints[aircraft.collisionPoints.length - 2]
            .worldPosition[2] * 3.2808399;
        return Math.round(altitudeMSL - groundElevationFeet + collisionZFeet);
      }
    } catch (err) {}
    return null;
  }

  setInterval(async () => {
    if (!info.active || !geofs?.aircraft?.instance) return;

    const inst = geofs.aircraft.instance;
    const onGround = inst.groundContact ?? true;
    if (wasOnGround && !onGround) takeoffTimeUTC = new Date().toISOString();
    wasOnGround = onGround;

    const lla = inst.llaLocation || [];
    const altMSL = lla[2] ? lla[2] * 3.28084 : geofs.animation.values.altitude;
    const altAGL = calculateAGL();

    const payload = {
      id: geofs.userRecord.googleid || geofs.userRecord.callsign,
      googleId: geofs.userRecord.googleid || null,
      callsign: geofs.userRecord.callsign,
      type: inst.aircraftRecord.name || "Unknown",
      lat: lla[0],
      lon: lla[1],
      alt: typeof altAGL === "number" ? altAGL : Math.round(altMSL),
      altMSL: Math.round(altMSL),
      heading: Math.round(geofs.animation.values.heading360 || 0),
      speed: Math.round(geofs.animation.values.kias || 0),
      flightNo: info.flt,
      departure: info.dep,
      arrival: info.arr,
      takeoffTime: takeoffTimeUTC,
      squawk: info.sqk,
      flightPlan: geofs.flightPlan?.export ? geofs.flightPlan.export() : [],
      nextWaypoint: geofs.flightPlan?.trackedWaypoint?.ident || null,
      vspeed: Math.floor(geofs.animation?.values?.verticalSpeed || 0),
    };

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, SEND_INTERVAL_MS);
})();

// =============================================
// PART 2: Flight Info UI Panel
// =============================================
(function () {
  "use strict";

  const STORAGE_KEY = "geofs-atc-toggle-key";
  let toggleKey = localStorage.getItem(STORAGE_KEY) || "w";

  const UI_CONTAINER_ID = "geofs-atc-radar-flightInfoUI";
  const DEP_INPUT_ID = "atc-depInput";
  const ARR_INPUT_ID = "atc-arrInput";
  const FLT_INPUT_ID = "atc-fltInput";
  const SQK_INPUT_ID = "atc-sqkInput";
  const SAVE_BTN_ID = "atc-saveBtn";
  const CLEAR_BTN_ID = "atc-clearBtn";
  const STATUS_INDICATOR_ID = "atc-statusIndicator";
  const KEYBIND_BTN_ID = "atc-keybind-btn";

  let flightUI;
  let isListeningForKey = false;

  function validateSquawk(squawk) {
    const rgx = /^[0-7]{4}$/;
    return squawk.length === 0 || rgx.test(squawk);
  }

  function showToast(msg, isError = false) {
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.cssText = `
      position:fixed;
      bottom:20px;
      right:20px;
      background:${isError ? "rgba(239,68,68,0.9)" : "rgba(16,185,129,0.9)"};
      color:#fff;
      padding:12px 16px;
      border-radius:12px;
      font-size:12px;
      font-weight:600;
      letter-spacing:0.05em;
      z-index:1000000;
      opacity:0;
      transition:opacity 0.3s ease;
      box-shadow:0 10px 30px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function buildInputRow(label, id, placeholder) {
    return `
      <div style="display:flex; gap:8px; align-items:center;">
        <div style="
          width:64px;
          font-size:10px;
          letter-spacing:0.12em;
          color:#94a3b8;
        ">${label}</div>
        <input id="${id}"
          placeholder="${placeholder}"
          maxlength="8"
          autocomplete="off"
          style="
            flex:1;
            height:30px;
            border-radius:8px;
            background:rgba(255,255,255,0.08);
            border:1px solid rgba(255,255,255,0.1);
            color:#e5e7eb;
            padding:0 8px;
            font-size:11px;
            outline:none;
          "
        />
      </div>
    `;
  }

  function injectFlightUI() {
    flightUI = document.createElement("div");
    flightUI.id = UI_CONTAINER_ID;
    flightUI.style.cssText = `
      position:fixed;
      top:72px;
      right:16px;
      width:260px;
      padding:16px;
      background:rgba(2,6,23,0.75);
      backdrop-filter:blur(18px);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:16px;
      color:#e5e7eb;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;
      box-shadow:0 20px 40px rgba(0,0,0,0.6);
      z-index:999999;
    `;

    flightUI.innerHTML = `
      <div style="
        text-align:center;
        margin-bottom:12px;
        font-size:11px;
        letter-spacing:0.18em;
        text-transform:uppercase;
        color:#22d3ee;
        font-weight:600;
      ">
        ATC Flight Info (LOCAL)
      </div>

      <div style="display:grid; gap:10px;">
        ${buildInputRow("DEP", DEP_INPUT_ID, "ICAO")}
        ${buildInputRow("ARR", ARR_INPUT_ID, "ICAO")}
        ${buildInputRow("CALLSIGN", FLT_INPUT_ID, "ABC123")}
        ${buildInputRow("SQUAWK", SQK_INPUT_ID, "7000")}
      </div>

      <div style="display:flex; gap:8px; margin-top:14px;">
        <button id="${SAVE_BTN_ID}" style="
          flex:1;
          height:36px;
          border-radius:10px;
          border:1px solid rgba(34,211,238,0.3);
          background:rgba(34,211,238,0.15);
          color:#67e8f9;
          font-size:11px;
          font-weight:600;
          letter-spacing:0.12em;
          text-transform:uppercase;
          cursor:pointer;
        ">Save</button>

        <button id="${CLEAR_BTN_ID}" style="
          flex:1;
          height:36px;
          border-radius:10px;
          border:1px solid rgba(239,68,68,0.3);
          background:rgba(239,68,68,0.12);
          color:#fca5a5;
          font-size:11px;
          font-weight:600;
          letter-spacing:0.12em;
          text-transform:uppercase;
          cursor:pointer;
        ">Clear</button>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-top:10px;
        font-size:9px;
        color:#94a3b8;
      ">
        <span>Toggle key</span>
        <button id="${KEYBIND_BTN_ID}" style="
          padding:4px 8px;
          border-radius:6px;
          border:1px solid rgba(255,255,255,0.15);
          background:rgba(255,255,255,0.08);
          color:#e5e7eb;
          font-size:9px;
          letter-spacing:0.12em;
          cursor:pointer;
        ">${toggleKey.toUpperCase()}</button>
      </div>

      <div id="${STATUS_INDICATOR_ID}" style="
        margin-top:8px;
        text-align:center;
        font-size:10px;
        letter-spacing:0.1em;
        text-transform:uppercase;
        color:#f87171;
      ">
        Flight info required
      </div>
    `;

    document.body.appendChild(flightUI);

    [DEP_INPUT_ID, ARR_INPUT_ID, FLT_INPUT_ID, SQK_INPUT_ID].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        el.value = el.value.toUpperCase();
      });
    });

    document.getElementById(KEYBIND_BTN_ID).onclick = () => {
      isListeningForKey = true;
      document.getElementById(KEYBIND_BTN_ID).textContent = "...";
    };

    document.getElementById(SAVE_BTN_ID).onclick = () => {
      const dep = document.getElementById(DEP_INPUT_ID).value.trim();
      const arr = document.getElementById(ARR_INPUT_ID).value.trim();
      const flt = document.getElementById(FLT_INPUT_ID).value.trim();
      const sqk = document.getElementById(SQK_INPUT_ID).value.trim();

      if (!dep || !arr || !flt) {
        showToast("Required fields missing", true);
        return;
      }

      if (sqk && !validateSquawk(sqk)) {
        showToast("Invalid squawk", true);
        return;
      }

      window.dispatchEvent(
        new CustomEvent("atc-data-sync", {
          detail: { dep, arr, flt, sqk, active: true },
        }),
      );
      showToast("Flight info saved");
    };

    document.getElementById(CLEAR_BTN_ID).onclick = () => {
      [DEP_INPUT_ID, ARR_INPUT_ID, FLT_INPUT_ID, SQK_INPUT_ID].forEach(
        (id) => (document.getElementById(id).value = ""),
      );
      window.dispatchEvent(
        new CustomEvent("atc-data-sync", { detail: { active: false } }),
      );
      showToast("Flight info cleared");
    };
  }

  window.addEventListener("keydown", (e) => {
    if (isListeningForKey) {
      toggleKey = e.key.toLowerCase();
      localStorage.setItem(STORAGE_KEY, toggleKey);
      document.getElementById(KEYBIND_BTN_ID).textContent =
        toggleKey.toUpperCase();
      isListeningForKey = false;
      showToast("Toggle key updated");
      return;
    }

    if (
      e.key.toLowerCase() === toggleKey &&
      e.target.tagName !== "INPUT" &&
      e.target.tagName !== "TEXTAREA"
    ) {
      flightUI.style.display =
        flightUI.style.display === "none" ? "block" : "none";
    }
  });

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.target.tagName === "INPUT") e.stopPropagation();
    },
    true,
  );

  window.addEventListener("atc-status-update", (e) => {
    const statusEl = document.getElementById(STATUS_INDICATOR_ID);
    if (statusEl) {
      statusEl.innerHTML = e.detail.text;
      statusEl.style.color = e.detail.color;
    }
  });

  injectFlightUI();
})();
