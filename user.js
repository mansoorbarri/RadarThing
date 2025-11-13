// ==UserScript==
// @name         GeoFS ATC Radar
// @namespace    http://tampermonkey.net/
// @version      0.0.2
// @description  A ATC Radar for GeoFS which works like FlightRadar24.
// @match        http://*/geofs.php*
// @match        https://*/geofs.php*
// @updateURL    https://raw.githubusercontent.com/mansoorbarri/geofs-radar/main/user.js
// @downloadURL  https://raw.githubusercontent.com/mansoorbarri/geofs-radar/main/user.js
// @grant        none
// ==/UserScript==


(function () {
  'use strict';

  const API_URL = 'https://geofs-radar.vercel.app/api/atc/position';
  const SEND_INTERVAL_MS = 5000;

  function log(...args) {
    console.log('[ATC-Reporter]', ...args);
  }

  let flightInfo = { departure: '', arrival: '', flightNo: '', squawk: '' };
  let flightUI;
  let wasOnGround = true;
  let takeoffTimeUTC = '';
  let isConnected = false;

  async function sendToAPI(payload) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn('[ATC-Reporter] API error:', response.status);
        isConnected = false;
        return false;
      }

      if (!isConnected) {
        log('API connected');
        isConnected = true;
      }

      return true;
    } catch (error) {
      if (isConnected) {
        console.warn('[ATC-Reporter] API connection error:', error);
        isConnected = false;
      }
      return false;
    }
  }

  function getAircraftName() {
    return geofs?.aircraft?.instance?.aircraftRecord?.name || 'Unknown';
  }
  function getPlayerCallsign() {
    return geofs?.userRecord?.callsign || 'Unknown';
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  function calculateAGL() {
    try {
      const altitudeMSL = geofs?.animation?.values?.altitude;
      const groundElevationFeet = geofs?.animation?.values?.groundElevationFeet;
      const aircraft = geofs?.aircraft?.instance;

      if (
        typeof altitudeMSL === 'number' &&
        typeof groundElevationFeet === 'number' &&
        aircraft?.collisionPoints?.length >= 2 &&
        typeof aircraft.collisionPoints[aircraft.collisionPoints.length - 2]?.worldPosition?.[2] === 'number'
      ) {
        const collisionZFeet = aircraft.collisionPoints[aircraft.collisionPoints.length - 2].worldPosition[2] * 3.2808399;
        return Math.round((altitudeMSL - groundElevationFeet) + collisionZFeet);
      }
    } catch (err) {
      console.warn('[ATC-Reporter] AGL calculation error:', err);
    }
    return null;
  }

  function checkTakeoff() {
    const onGround = geofs?.aircraft?.instance?.groundContact ?? true;
    if (wasOnGround && !onGround) {
      takeoffTimeUTC = new Date().toISOString();
      console.log('[ATC-Reporter] Takeoff at', takeoffTimeUTC);
    }
    wasOnGround = onGround;
  }

  function readSnapshot() {
    try {
      const inst = geofs?.aircraft?.instance;
      if (!inst) return null;

      const lla = inst.llaLocation || [];
      const lat = lla[0];
      const lon = lla[1];
      const altMeters = lla[2];

      if (typeof lat !== 'number' || typeof lon !== 'number') return null;

      const altMSL = (typeof altMeters === 'number') ? altMeters * 3.28084 : geofs?.animation?.values?.altitude ?? 0;
      const altAGL = calculateAGL();
      const heading = geofs?.animation?.values?.heading360 ?? 0;
      const speed = geofs.animation.values.kias ? geofs.animation.values.kias.toFixed(1) : 'N/A';

      return { lat, lon, altMSL, altAGL, heading, speed };
    } catch (e) {
      console.warn('[ATC-Reporter] readSnapshot error:', e);
      return null;
    }
  }



  function buildPayload(snap) {
    checkTakeoff();
    let flightPlan = [];
    let nextWpIdent = '';

    try {
      if (geofs.flightPlan && typeof geofs.flightPlan.export === "function") {
        flightPlan = geofs.flightPlan.export();
      }
    } catch (e) {
        console.error('[ATC-Reporter] Error in buildPayload/FlightPlan:', e);
    }

    return {
      id: getPlayerCallsign(),
      callsign: getPlayerCallsign(),
      type: getAircraftName(),
      lat: snap.lat,
      lon: snap.lon,
      alt: (typeof snap.altAGL === 'number') ? snap.altAGL : Math.round(snap.altMSL || 0),
      altMSL: Math.round(snap.altMSL || 0),
      heading: Math.round(snap.heading || 0),
      speed: Math.round(snap.speed || 0),
      flightNo: flightInfo.flightNo,
      departure: flightInfo.departure,
      arrival: flightInfo.arrival,
      takeoffTime: takeoffTimeUTC,
      squawk: flightInfo.squawk,
      flightPlan: flightPlan,
      nextWaypoint: geofs.flightPlan.trackedWaypoint.ident || NULL,
      vspeed: geofs.autopilot.values.verticalSpeed || 0
    };
  }

  setInterval(async () => {
    const snap = readSnapshot();
    if (!snap) return;
    const payload = buildPayload(snap);
    await sendToAPI(payload);
  }, SEND_INTERVAL_MS);

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = '#fff';
    toast.style.padding = '8px 12px';
    toast.style.borderRadius = '6px';
    toast.style.fontSize = '13px';
    toast.style.zIndex = 1000000;
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function injectFlightUI() {
    flightUI = document.createElement('div');
    flightUI.id = 'flightInfoUI';
    flightUI.style.position = 'fixed';
    flightUI.style.bottom = '280px';
    flightUI.style.right = '6px';
    flightUI.style.background = 'rgba(0,0,0,0.6)';
    flightUI.style.padding = '8px';
    flightUI.style.borderRadius = '6px';
    flightUI.style.color = 'white';
    flightUI.style.fontSize = '12px';
    flightUI.style.zIndex = 999999;

    flightUI.innerHTML = `
      <div>Dep: <input id="depInput" style="width:60px"></div>
      <div>Arr: <input id="arrInput" style="width:60px"></div>
      <div>Flt#: <input id="fltInput" style="width:60px"></div>
      <div>SQK: <input id="sqkInput" style="width:60px" maxlength="4"></div>
      <button id="saveBtn">Save</button>
    `;

    document.body.appendChild(flightUI);

    ['depInput','arrInput','fltInput','sqkInput'].forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', () => {
        el.value = el.value.toUpperCase();
      });
    });

    document.getElementById('saveBtn').onclick = () => {
      flightInfo.departure = document.getElementById('depInput').value.trim();
      flightInfo.arrival = document.getElementById('arrInput').value.trim();
      flightInfo.flightNo = document.getElementById('fltInput').value.trim();
      flightInfo.squawk = document.getElementById('sqkInput').value.trim();
      showToast('Flight info saved!');
    };
  }
  injectFlightUI();

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'w') {
      if (flightUI.style.display === 'none') {
        flightUI.style.display = 'block';
        showToast('Flight Info UI Shown');
      } else {
        flightUI.style.display = 'none';
        showToast('Flight Info UI Hidden');
      }
    }
  });

  document.querySelectorAll("input").forEach(el => {
    el.setAttribute("autocomplete", "off");
  });

  document.addEventListener("keydown", (e) => {
    const target = e.target;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      e.stopPropagation();
    }
  }, true);

})();