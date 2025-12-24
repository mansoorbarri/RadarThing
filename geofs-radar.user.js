// ==UserScript==
// @name         GeoFS ATC Radar
// @namespace    http://tampermonkey.net/
// @version      1.2.2
// @description  Always loads the latest GeoFS ATC Radar script from GitHub
// @Author       Mansoor Barri
// @match        http://*/geofs.php*
// @match        https://*/geofs.php*
// @require      https://raw.githubusercontent.com/mansoorbarri/geofs-radar/main/userscript.js?nocache=1
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const UI_CONTAINER_ID = "geofs-atc-radar-flightInfoUI";
  const DEP_INPUT_ID = "atc-depInput";
  const ARR_INPUT_ID = "atc-arrInput";
  const FLT_INPUT_ID = "atc-fltInput";
  const SQK_INPUT_ID = "atc-sqkInput";
  const SAVE_BTN_ID = "atc-saveBtn";
  const CLEAR_BTN_ID = "atc-clearBtn";
  const STATUS_INDICATOR_ID = "atc-statusIndicator";

  let flightUI;
  let isFlightInfoSaved = false;

  function validateSquawk(squawk) {
    const rgx = /^[0-7]{4}$/;
    return squawk.length === 0 || rgx.test(squawk);
  }

  function showToast(msg, isError = false) {
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.cssText = `position:fixed; bottom:20px; right:20px; background:${isError ? "rgba(220,53,69,0.9)" : "rgba(40,167,69,0.9)"}; color:#fff; padding:12px 16px; border-radius:8px; font-size:14px; font-weight:500; z-index:1000000; opacity:0; transition:opacity 0.3s ease; boxShadow:0 4px 12px rgba(0,0,0,0.3);`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function injectFlightUI() {
    flightUI = document.createElement("div");
    flightUI.id = UI_CONTAINER_ID;
    flightUI.style.cssText = `position:fixed; top:60px; right:15px; background:rgba(35, 42, 49, 0.75); backdrop-filter:blur(14px) saturate(180%); border-radius:14px; color:#f1f2f6; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:12px; padding:16px; width:230px; border:1px solid rgba(255,255,255,0.15); box-shadow:0 8px 28px rgba(0,0,0,0.35); transition:transform 0.2s ease; z-index:999999;`;
    
    flightUI.innerHTML = `
      <div style="text-align:center; margin-bottom: 12px; font-weight:600; font-size:14px; letter-spacing:0.5px; color:#74b9ff;">ATC Flight Information</div>
      <div style="display: grid; gap: 8px;">
        ${buildInputRow("Departure", DEP_INPUT_ID, "ICAO")}
        ${buildInputRow("Arrival", ARR_INPUT_ID, "ICAO")}
        ${buildInputRow("Callsign", FLT_INPUT_ID, "ABC123")}
        ${buildInputRow("Squawk", SQK_INPUT_ID, "7000")}
      </div>
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button id="${SAVE_BTN_ID}" style="flex:1; padding:8px 0; background:linear-gradient(135deg,#00b894,#00cec9); color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer;">Save</button>
        <button id="${CLEAR_BTN_ID}" style="flex:1; padding:8px 0; background:linear-gradient(135deg,#d63031,#e17055); color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer;">Clear</button>
      </div>
      <div id="${STATUS_INDICATOR_ID}" style="margin-top:10px; text-align:center; font-size:11px; font-weight:500; color:#e74c3c;">Flight info required</div>
      <div style="margin-top:6px; text-align:center; font-size:10px; color:#95a5a6;">Press 'W' to hide/show this panel</div>
    `;

    function buildInputRow(labelTxt, id, placeholder) {
      return `<div style="display:flex; align-items:center; gap:6px;"><label style="width:70px; font-weight:500; color:#dfe6e9;">${labelTxt}:</label><input id="${id}" placeholder="${placeholder}" autocomplete="off" style="flex:1; padding:6px 7px; border:none; border-radius:6px; background:rgba(255,255,255,0.15); color:#fff; font-size:11.5px; outline:none; min-width:0;" maxlength="8"></div>`;
    }

    document.body.appendChild(flightUI);

    [DEP_INPUT_ID, ARR_INPUT_ID, FLT_INPUT_ID, SQK_INPUT_ID].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => { el.value = el.value.toUpperCase(); });
    });

    document.getElementById(SAVE_BTN_ID).onclick = () => {
      const dep = document.getElementById(DEP_INPUT_ID).value.trim();
      const arr = document.getElementById(ARR_INPUT_ID).value.trim();
      const flt = document.getElementById(FLT_INPUT_ID).value.trim();
      const sqk = document.getElementById(SQK_INPUT_ID).value.trim();

      if (!dep || !arr || !flt) { showToast("Please fill in Departure, Arrival, and Callsign", true); return; }
      if (sqk && !validateSquawk(sqk)) { showToast("Invalid squawk (digits 0–7 only)", true); return; }

      isFlightInfoSaved = true;
      window.dispatchEvent(new CustomEvent("atc-data-sync", { detail: { dep, arr, flt, sqk, active: true } }));
      showToast("Flight info saved. Data transmission started.");
    };

    document.getElementById(CLEAR_BTN_ID).onclick = () => {
      isFlightInfoSaved = false;
      [DEP_INPUT_ID, ARR_INPUT_ID, FLT_INPUT_ID, SQK_INPUT_ID].forEach(id => document.getElementById(id).value = "");
      window.dispatchEvent(new CustomEvent("atc-data-sync", { detail: { active: false } }));
      showToast("Flight info cleared.");
    };
  }

  window.addEventListener("atc-status-update", (e) => {
    const statusEl = document.getElementById(STATUS_INDICATOR_ID);
    if (statusEl) { statusEl.innerHTML = e.detail.text; statusEl.style.color = e.detail.color; }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "w" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      flightUI.style.display = flightUI.style.display === "none" ? "block" : "none";
    }
  });

  document.addEventListener("keydown", (e) => { if (e.target.tagName === "INPUT") e.stopPropagation(); }, true);

  injectFlightUI();
})();
