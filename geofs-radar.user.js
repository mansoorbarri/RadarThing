// ==UserScript==
// @name         RadarThing
// @namespace    http://tampermonkey.net/
// @version      1.2.7
// @description  Always loads the latest GeoFS ATC Radar script from GitHub
// @Author       xyzmani
// @match        http://*/geofs.php*
// @match        https://*/geofs.php*
// @require      https://raw.githubusercontent.com/mansoorbarri/radarthing/main/userscript.js?nocache=1
// @require      https://raw.githubusercontent.com/mansoorbarri/radarthing/main/seabus.js?nocache=1
// @grant        none
// ==/UserScript==

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
        ATC Flight Info
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
