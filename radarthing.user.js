// ==UserScript==
// @name         RadarThing
// @namespace    http://tampermonkey.net/
// @version      1.4.7
// @description  Always loads the latest GeoFS ATC Radar script from GitHub
// @Author       xyzmani
// @icon         https://cdn.jsdelivr.net/gh/mansoorbarri/radarthing@main/public/favicon.ico
// @match        http://*/geofs.php*
// @match        https://*/geofs.php*
// @require      https://cdn.jsdelivr.net/gh/mansoorbarri/radarthing@main/userscript.js
// @require      https://cdn.jsdelivr.net/gh/mansoorbarri/radarthing@main/seabus.js
// @require      https://cdn.jsdelivr.net/gh/mansoorbarri/radarthing@main/jth.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // ==========================================
  // ATC FLIGHT INFO — Constants & State
  // ==========================================

  const STORAGE_KEY = "geofs-atc-toggle-key";
  const CHARTS_TOGGLE_KEY = "geofs-atc-charts-toggle-key";
  const RADAR_PREFS_KEY = "geofs-atc-radar-prefs";
  let toggleKey = localStorage.getItem(STORAGE_KEY) || "w";
  let chartsToggleKey = localStorage.getItem(CHARTS_TOGGLE_KEY) || "q";

  const UI_CONTAINER_ID = "geofs-atc-radar-flightInfoUI";
  const DEP_INPUT_ID = "atc-depInput";
  const ARR_INPUT_ID = "atc-arrInput";
  const FLT_INPUT_ID = "atc-fltInput";
  const SQK_INPUT_ID = "atc-sqkInput";
  const SAVE_BTN_ID = "atc-saveBtn";
  const CLEAR_BTN_ID = "atc-clearBtn";
  const STATUS_INDICATOR_ID = "atc-statusIndicator";
  const KEYBIND_BTN_ID = "atc-keybind-btn";
  const CHARTS_KEYBIND_BTN_ID = "atc-charts-keybind-btn";
  const RADAR_SETTINGS_HEADER_ID = "atc-radar-settings-header";
  const RADAR_SETTINGS_BODY_ID = "atc-radar-settings-body";
  const RADAR_SETTINGS_ARROW_ID = "atc-radar-settings-arrow";
  const JTH_TOGGLE_ID = "atc-toggle-jth";
  const SEABUS_TOGGLE_ID = "atc-toggle-seabus";
  const CHARTS_BTN_ID = "atc-charts-btn";

  let flightUI;
  let keybindMode = null;
  let lastSyncedPlan = "";

  let radarPrefs = JSON.parse(
    localStorage.getItem(RADAR_PREFS_KEY) || '{"jth":true,"seabus":true}',
  );
  window.__radarPrefs = radarPrefs;

  // ==========================================
  // AIRPORT CHARTS — Constants & State
  // ==========================================

  const CHARTS_API = "https://radarthing.com";
  const CHARTS_PANEL_ID = "gc-panel";
  const CHARTS_POS_KEY = "geofs-charts-pos";
  const CHARTS_SIZE_KEY = "geofs-charts-size";
  const CHARTS_ICAO_KEY = "geofs-charts-icao";
  const CHARTS_CACHE_KEY = "geofs-airport-charts-v1";
  const CHART_TYPES = ["TAXI", "SID", "STAR", "APPROACH"];
  const CHARTS_DEFAULT_TOP = 60;
  const CHARTS_DEFAULT_LEFT = 16;
  const CHARTS_DEFAULT_WIDTH = 370;
  const chartsMemoryCache = new Map();

  const chartsState = {
    currentIcao: "",
    chartsByType: { TAXI: [], SID: [], STAR: [], APPROACH: [] },
    currentType: "TAXI",
    selectedChartId: null,
    invertColors: true,
    zoom: { scale: 1, panX: 0, panY: 0 },
  };

  // ==========================================
  // ATC FLIGHT INFO — Functions
  // ==========================================

  function isICAO(str) {
    return /^[A-Z]{4}$/.test(str);
  }

  function syncFlightPlan() {
    try {
      const g = window.geofs;
      if (!g || !g.flightPlan || typeof g.flightPlan.export !== "function")
        return;

      let waypoints = g.flightPlan.export();
      if (!waypoints) return;
      if (typeof waypoints === "string") waypoints = JSON.parse(waypoints);
      if (!waypoints || waypoints.length < 2) return;

      let depIdent = "";
      let arrIdent = "";

      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        if (wp && wp.type === "DPT" && wp.ident) depIdent = wp.ident;
        if (wp && wp.type === "DST" && wp.ident) arrIdent = wp.ident;
      }

      if (!depIdent) depIdent = (waypoints[0] && waypoints[0].ident) || "";
      if (!arrIdent)
        arrIdent =
          (waypoints[waypoints.length - 1] &&
            waypoints[waypoints.length - 1].ident) ||
          "";

      depIdent = depIdent.toUpperCase();
      arrIdent = arrIdent.toUpperCase();

      const planKey = depIdent + "-" + arrIdent;
      if (planKey === lastSyncedPlan) return;

      const depEl = document.getElementById(DEP_INPUT_ID);
      const arrEl = document.getElementById(ARR_INPUT_ID);
      if (!depEl || !arrEl) return;

      let filled = false;

      if (isICAO(depIdent) && !depEl.value.trim()) {
        depEl.value = depIdent;
        filled = true;
      }

      if (isICAO(arrIdent) && !arrEl.value.trim()) {
        arrEl.value = arrIdent;
        filled = true;
      }

      if (filled) {
        lastSyncedPlan = planKey;
        showToast("Flight plan detected");
      }
    } catch (_) {}
  }

  function validateSquawk(squawk) {
    const rgx = /^[0-7]{4}$/;
    return squawk.length === 0 || rgx.test(squawk);
  }

  function checkFlightNoAvailable(flightNo, myId) {
    return new Promise((resolve) => {
      const es = new EventSource("https://sse.radarthing.com/api/stream");
      const timeout = setTimeout(() => {
        es.close();
        resolve(true);
      }, 5000);

      es.onmessage = (event) => {
        clearTimeout(timeout);
        es.close();
        try {
          const data = JSON.parse(event.data);
          const taken = (data.aircraft || []).some(
            (ac) => ac.flightNo === flightNo && ac.id !== myId,
          );
          resolve(!taken);
        } catch {
          resolve(true);
        }
      };

      es.onerror = () => {
        clearTimeout(timeout);
        es.close();
        resolve(true);
      };
    });
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

  function buildToggleRow(label, id, checked) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:2px 0;">
        <span style="font-size:10px; color:#94a3b8; letter-spacing:0.08em;">${label}</span>
        <div id="${id}" style="
          width:34px; height:18px;
          border-radius:9px;
          background:${checked ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.12)"};
          position:relative;
          cursor:pointer;
          transition:background 0.2s;
        ">
          <div style="
            position:absolute;
            top:2px;
            left:${checked ? "18px" : "2px"};
            width:14px;
            height:14px;
            background:#e5e7eb;
            border-radius:50%;
            transition:left 0.2s;
          "></div>
        </div>
      </div>
    `;
  }

  function updateToggleVisual(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background = on
      ? "rgba(34,211,238,0.4)"
      : "rgba(255,255,255,0.12)";
    el.firstElementChild.style.left = on ? "18px" : "2px";
  }

  function saveRadarPrefs() {
    localStorage.setItem(RADAR_PREFS_KEY, JSON.stringify(radarPrefs));
    window.__radarPrefs = radarPrefs;
  }

  // ==========================================
  // AIRPORT CHARTS — Functions
  // ==========================================

  function createEmptyChartsByType() {
    return { TAXI: [], SID: [], STAR: [], APPROACH: [] };
  }

  function loadChartsCacheStorage() {
    try {
      const raw = localStorage.getItem(CHARTS_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveChartsCacheStorage(data) {
    try {
      localStorage.setItem(CHARTS_CACHE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function sanitizeChartsByType(raw) {
    const byType = createEmptyChartsByType();
    if (!raw || typeof raw !== "object") return byType;

    for (const type of CHART_TYPES) {
      const list = Array.isArray(raw[type]) ? raw[type] : [];
      for (const chart of list) {
        if (!chart || !chart.chartName || !chart.chartUrl) continue;
        byType[type].push({
          id:
            chart.id ||
            `${chart.icao || ""}-${type}-${chart.chartName}-${chart.chartUrl}`,
          icao: (chart.icao || "").toUpperCase(),
          chartType: type,
          chartName: chart.chartName,
          chartUrl: chart.chartUrl,
        });
      }
      byType[type].sort((a, b) => a.chartName.localeCompare(b.chartName));
    }

    return byType;
  }

  function clearChartsCacheForAirport(icao) {
    const key = icao.toUpperCase();
    chartsMemoryCache.delete(key);
    const stored = loadChartsCacheStorage();
    if (stored[key]) {
      delete stored[key];
      saveChartsCacheStorage(stored);
    }
  }

  async function fetchChartsForAirport(icao, opts = {}) {
    const upperIcao = icao.toUpperCase();
    const force = !!opts.force;

    if (!force && chartsMemoryCache.has(upperIcao)) {
      return { byType: chartsMemoryCache.get(upperIcao), fromCache: true };
    }

    if (!force) {
      const stored = loadChartsCacheStorage();
      if (stored[upperIcao]) {
        const cachedByType = sanitizeChartsByType(stored[upperIcao]);
        chartsMemoryCache.set(upperIcao, cachedByType);
        return { byType: cachedByType, fromCache: true };
      }
    }

    const res = await fetch(
      `${CHARTS_API}/api/userscript/charts?icao=${encodeURIComponent(upperIcao)}`,
      { headers: { "X-Requested-With": "GeoFS-Charts" } },
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const charts = Array.isArray(data.charts) ? data.charts : [];
    const byType = createEmptyChartsByType();

    for (const chart of charts) {
      if (!chart || !chart.chartType || !byType[chart.chartType]) continue;
      byType[chart.chartType].push({
        id:
          chart.id ||
          `${chart.icao}-${chart.chartType}-${chart.chartName}-${chart.chartUrl}`,
        icao: chart.icao,
        chartType: chart.chartType,
        chartName: chart.chartName,
        chartUrl: chart.chartUrl,
      });
    }

    for (const type of CHART_TYPES) {
      byType[type].sort((a, b) => a.chartName.localeCompare(b.chartName));
    }

    chartsMemoryCache.set(upperIcao, byType);
    const stored = loadChartsCacheStorage();
    stored[upperIcao] = byType;
    saveChartsCacheStorage(stored);

    return { byType, fromCache: false };
  }

  function getChartCount(byType) {
    return CHART_TYPES.reduce((n, t) => n + byType[t].length, 0);
  }

  function getSelectedChart() {
    const charts = chartsState.chartsByType[chartsState.currentType] || [];
    if (!charts.length) return null;
    if (!chartsState.selectedChartId) return charts[0];
    return (
      charts.find((c) => c.id === chartsState.selectedChartId) || charts[0]
    );
  }

  function selectFirstNonEmptyType() {
    for (const type of CHART_TYPES) {
      if (chartsState.chartsByType[type].length > 0) {
        chartsState.currentType = type;
        chartsState.selectedChartId = chartsState.chartsByType[type][0].id;
        return;
      }
    }
    chartsState.currentType = "TAXI";
    chartsState.selectedChartId = null;
  }

  function saveChartsPos(el) {
    try {
      localStorage.setItem(
        CHARTS_POS_KEY,
        JSON.stringify({
          top: parseInt(el.style.top) || CHARTS_DEFAULT_TOP,
          left: parseInt(el.style.left) || CHARTS_DEFAULT_LEFT,
        }),
      );
    } catch (_) {}
  }

  function loadChartsPos() {
    try {
      const s = localStorage.getItem(CHARTS_POS_KEY);
      if (!s) return null;
      const p = JSON.parse(s);
      return {
        top: Math.max(0, Math.min(p.top, window.innerHeight - 100)),
        left: Math.max(0, Math.min(p.left, window.innerWidth - 100)),
      };
    } catch (_) {
      return null;
    }
  }

  function saveChartsSize(el) {
    try {
      const maxHeight = parseInt(el.style.maxHeight, 10);
      localStorage.setItem(
        CHARTS_SIZE_KEY,
        JSON.stringify({
          width: el.offsetWidth,
          maxHeight: Number.isFinite(maxHeight) ? maxHeight : null,
        }),
      );
    } catch (_) {}
  }

  function loadChartsSize() {
    try {
      const s = localStorage.getItem(CHARTS_SIZE_KEY);
      if (!s) return null;
      const p = JSON.parse(s);
      return {
        width: Math.max(300, Math.min(p.width, window.innerWidth - 20)),
        maxHeight: Number.isFinite(p.maxHeight)
          ? Math.max(120, Math.min(p.maxHeight, window.innerHeight - 16))
          : null,
      };
    } catch (_) {
      return null;
    }
  }

  function clampChartsPanelToViewport(panel) {
    if (!panel) return;
    const margin = 8;
    const minWidth = 300;
    const viewportMaxWidth = Math.max(minWidth, window.innerWidth - margin * 2);
    if (panel.offsetWidth > viewportMaxWidth) {
      panel.style.width = viewportMaxWidth + "px";
    }

    if (panel.offsetHeight > window.innerHeight - margin * 2) {
      panel.style.maxHeight =
        Math.max(120, window.innerHeight - margin * 2) + "px";
      panel.style.height = "auto";
    }

    const currentLeft = parseInt(panel.style.left, 10);
    const currentTop = parseInt(panel.style.top, 10);
    const left = Number.isFinite(currentLeft)
      ? currentLeft
      : CHARTS_DEFAULT_LEFT;
    const top = Number.isFinite(currentTop) ? currentTop : CHARTS_DEFAULT_TOP;

    const maxLeft = Math.max(
      margin,
      window.innerWidth - panel.offsetWidth - margin,
    );
    const maxTop = Math.max(
      margin,
      window.innerHeight - panel.offsetHeight - margin,
    );
    panel.style.left = Math.min(Math.max(left, margin), maxLeft) + "px";
    panel.style.top = Math.min(Math.max(top, margin), maxTop) + "px";
  }

  function syncChartsViewerHeight() {
    const panel = document.getElementById(CHARTS_PANEL_ID);
    const preview = panel?.querySelector(".gc-preview");
    if (!panel || !preview) return;

    const img = preview.querySelector(".gc-image-wrap img");
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) {
      preview.style.height = "0px";
      preview.style.overflowY = "hidden";
      panel.style.height = "auto";
      return;
    }

    const nonPreviewHeight = Array.from(panel.children).reduce((sum, child) => {
      if (
        child.classList.contains("gc-preview") ||
        child.classList.contains("gc-resize-handle")
      ) {
        return sum;
      }
      return sum + child.offsetHeight;
    }, 0);

    const horizontalPadding = 28;
    const imageWidth = Math.max(1, panel.clientWidth - horizontalPadding);
    const naturalHeight = Math.round(
      (img.naturalHeight / img.naturalWidth) * imageWidth,
    );
    let maxPreviewHeight = Math.max(
      0,
      window.innerHeight - panel.offsetTop - 16 - nonPreviewHeight,
    );
    const panelMaxHeight = parseInt(panel.style.maxHeight, 10);
    if (Number.isFinite(panelMaxHeight)) {
      maxPreviewHeight = Math.min(
        maxPreviewHeight,
        Math.max(0, panelMaxHeight - nonPreviewHeight),
      );
    }
    const appliedHeight = Math.min(naturalHeight, maxPreviewHeight);

    preview.style.height = `${appliedHeight}px`;
    preview.style.overflowY =
      naturalHeight > maxPreviewHeight ? "auto" : "hidden";
    panel.style.height = "auto";
  }

  function saveChartsIcao(icao) {
    try {
      localStorage.setItem(CHARTS_ICAO_KEY, icao);
    } catch (_) {}
  }

  function loadChartsIcao() {
    try {
      return localStorage.getItem(CHARTS_ICAO_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function makeChartsDraggable(panel, handle) {
    let dragging = false,
      sx,
      sy,
      sl,
      st;
    handle.style.cursor = "grab";

    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button") || e.target.closest("input")) return;
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      sl = parseInt(panel.style.left) || 0;
      st = parseInt(panel.style.top) || 0;
      handle.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = sl + e.clientX - sx + "px";
      panel.style.top = st + e.clientY - sy + "px";
      clampChartsPanelToViewport(panel);
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      handle.style.cursor = "grab";
      clampChartsPanelToViewport(panel);
      saveChartsPos(panel);
    });
  }

  function makeChartsResizable(panel) {
    const handles = panel.querySelectorAll(".gc-resize-handle");
    let resizing = false,
      startX,
      startY,
      startW,
      startH,
      resizeType;

    handles.forEach((handle) => {
      handle.addEventListener("mousedown", (e) => {
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = panel.offsetWidth;
        startH = panel.offsetHeight;
        if (handle.classList.contains("gc-resize-right")) resizeType = "right";
        else if (handle.classList.contains("gc-resize-bottom"))
          resizeType = "bottom";
        else resizeType = "corner";
        e.preventDefault();
        e.stopPropagation();
      });
    });

    document.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (resizeType === "right" || resizeType === "corner") {
        panel.style.width = Math.max(300, startW + dx) + "px";
      }
      if (resizeType === "bottom" || resizeType === "corner") {
        panel.style.maxHeight = Math.max(120, startH + dy) + "px";
      }
      clampChartsPanelToViewport(panel);
      syncChartsViewerHeight();
    });

    document.addEventListener("mouseup", () => {
      if (!resizing) return;
      resizing = false;
      clampChartsPanelToViewport(panel);
      syncChartsViewerHeight();
      saveChartsSize(panel);
      saveChartsPos(panel);
    });
  }

  function renderChartsContent() {
    const panel = document.getElementById(CHARTS_PANEL_ID);
    if (!panel) return;

    const title = panel.querySelector(".gc-title");
    const typeTabs = panel.querySelector(".gc-type-tabs");
    const chartList = panel.querySelector(".gc-list");
    const preview = panel.querySelector(".gc-preview");
    const invertToggle = panel.querySelector(".gc-invert-toggle");
    if (!title || !typeTabs || !chartList || !preview || !invertToggle) return;

    const total = getChartCount(chartsState.chartsByType);
    title.textContent = chartsState.currentIcao
      ? `${chartsState.currentIcao} Charts (${total})`
      : "Airport Charts";

    typeTabs.innerHTML = "";
    for (const type of CHART_TYPES) {
      const count = chartsState.chartsByType[type].length;
      const tab = document.createElement("button");
      tab.className = `gc-type-tab${chartsState.currentType === type ? " active" : ""}`;
      tab.innerHTML = `${type}<span>${count}</span>`;
      tab.onclick = () => {
        chartsState.currentType = type;
        const charts = chartsState.chartsByType[type];
        chartsState.selectedChartId = charts.length ? charts[0].id : null;
        renderChartsContent();
      };
      typeTabs.appendChild(tab);
    }

    const currentCharts =
      chartsState.chartsByType[chartsState.currentType] || [];
    chartList.innerHTML = "";

    if (currentCharts.length === 0) {
      const empty = document.createElement("div");
      empty.className = "gc-empty";
      empty.textContent = chartsState.currentIcao
        ? `No ${chartsState.currentType.toLowerCase()} charts available.`
        : "Search an airport to view charts.";
      chartList.appendChild(empty);
    } else {
      const select = document.createElement("select");
      select.className = "gc-select";
      for (const chart of currentCharts) {
        const opt = document.createElement("option");
        opt.value = chart.id;
        opt.textContent = chart.chartName;
        if (chartsState.selectedChartId === chart.id) opt.selected = true;
        select.appendChild(opt);
      }
      select.onchange = () => {
        chartsState.selectedChartId = select.value;
        renderChartsContent();
      };
      ["keydown", "keyup", "keypress"].forEach((evt) => {
        select.addEventListener(evt, (e) => e.stopPropagation());
      });
      chartList.appendChild(select);
    }

    const sel = getSelectedChart();
    invertToggle.classList.toggle("active", chartsState.invertColors);

    // Reset zoom when chart changes
    chartsState.zoom = { scale: 1, panX: 0, panY: 0 };

    if (!sel) {
      preview.innerHTML = `<div class="gc-empty">Select a chart from the list above.</div>`;
      syncChartsViewerHeight();
      return;
    }

    const cls = chartsState.invertColors ? "inverted" : "";
    preview.innerHTML = `
      <div class="gc-image-wrap">
        <img src="${sel.chartUrl}" alt="${sel.chartName}" class="${cls}" draggable="false">
      </div>
    `;
    const img = preview.querySelector("img");
    if (img) {
      img.addEventListener("load", syncChartsViewerHeight);
      img.addEventListener("error", syncChartsViewerHeight);
      if (img.complete) syncChartsViewerHeight();
    }
  }

  async function chartsSearch(opts = {}) {
    const input = document.getElementById("gc-icao-input");
    const status = document.getElementById("gc-search-status");
    if (!input || !status) return;

    const icao = input.value.trim().toUpperCase();
    if (!icao) {
      status.textContent = "Enter an ICAO code.";
      return;
    }

    status.textContent = "Loading...";
    try {
      const { byType, fromCache } = await fetchChartsForAirport(icao, opts);
      chartsState.currentIcao = icao;
      chartsState.chartsByType = byType;
      saveChartsIcao(icao);
      selectFirstNonEmptyType();
      const total = getChartCount(byType);
      if (total > 0) {
        status.textContent = fromCache
          ? `${total} chart(s) loaded from cache.`
          : `${total} chart(s) loaded from API.`;
      } else {
        status.textContent = fromCache
          ? "No charts found in cache."
          : "No charts found.";
      }
      renderChartsContent();
    } catch (err) {
      console.error("Charts fetch failed:", err);
      status.textContent = "Failed to load charts.";
    }
  }

  function resetChartsAndRefetch() {
    const input = document.getElementById("gc-icao-input");
    const status = document.getElementById("gc-search-status");
    if (!input || !status) return;

    const icao = input.value.trim().toUpperCase();
    if (!icao) {
      status.textContent = "Enter an ICAO code first.";
      return;
    }

    clearChartsCacheForAirport(icao);
    chartsSearch({ force: true });
  }

  function toggleChartsPanel() {
    const panel = document.getElementById(CHARTS_PANEL_ID);
    if (!panel) return;
    const isOpen = panel.style.display !== "none";
    if (isOpen) {
      panel.style.display = "none";
    } else {
      panel.style.display = "flex";
      const input = document.getElementById("gc-icao-input");
      const lastIcao = chartsState.currentIcao || loadChartsIcao();
      if (input) {
        input.value = lastIcao;
        input.focus();
      }
      if (lastIcao && !chartsState.currentIcao) {
        chartsState.currentIcao = lastIcao;
        chartsSearch();
      } else {
        renderChartsContent();
      }
    }
  }

  function hideChartsPanel() {
    const panel = document.getElementById(CHARTS_PANEL_ID);
    if (panel) panel.style.display = "none";
  }

  // ==========================================
  // AIRPORT CHARTS — Zoom & Pan
  // ==========================================

  function applyZoom(img) {
    const { scale, panX, panY } = chartsState.zoom;
    img.style.transform = `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`;
    img.style.transformOrigin = "center center";
  }

  function setupChartZoomHandlers() {
    const panel = document.getElementById(CHARTS_PANEL_ID);
    const preview = panel?.querySelector(".gc-preview");
    if (!preview) return;

    let panning = false,
      sx,
      sy;

    preview.addEventListener(
      "wheel",
      (e) => {
        const img = preview.querySelector(".gc-image-wrap img");
        if (!img) return;
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.85 : 1.18;
        chartsState.zoom.scale = Math.max(
          1,
          Math.min(10, chartsState.zoom.scale * factor),
        );
        if (chartsState.zoom.scale <= 1.01) {
          chartsState.zoom = { scale: 1, panX: 0, panY: 0 };
        }
        applyZoom(img);
        const wrap = preview.querySelector(".gc-image-wrap");
        if (wrap) wrap.style.cursor = chartsState.zoom.scale > 1 ? "grab" : "";
      },
      { passive: false },
    );

    preview.addEventListener("mousedown", (e) => {
      const wrap = preview.querySelector(".gc-image-wrap");
      if (!wrap || !wrap.contains(e.target) || chartsState.zoom.scale <= 1)
        return;
      panning = true;
      sx = e.clientX - chartsState.zoom.panX;
      sy = e.clientY - chartsState.zoom.panY;
      wrap.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!panning) return;
      chartsState.zoom.panX = e.clientX - sx;
      chartsState.zoom.panY = e.clientY - sy;
      const img = preview.querySelector(".gc-image-wrap img");
      if (img) applyZoom(img);
    });

    document.addEventListener("mouseup", () => {
      if (!panning) return;
      panning = false;
      const wrap = preview.querySelector(".gc-image-wrap");
      if (wrap) wrap.style.cursor = chartsState.zoom.scale > 1 ? "grab" : "";
    });

    preview.addEventListener("dblclick", (e) => {
      const wrap = preview.querySelector(".gc-image-wrap");
      if (!wrap || !wrap.contains(e.target)) return;
      chartsState.zoom = { scale: 1, panX: 0, panY: 0 };
      const img = wrap.querySelector("img");
      if (img) applyZoom(img);
      wrap.style.cursor = "";
    });
  }

  // ==========================================
  // ATC FLIGHT INFO — UI Injection
  // ==========================================

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

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-top:6px;
        font-size:9px;
        color:#94a3b8;
      ">
        <span>Charts key</span>
        <button id="${CHARTS_KEYBIND_BTN_ID}" style="
          padding:4px 8px;
          border-radius:6px;
          border:1px solid rgba(255,255,255,0.15);
          background:rgba(255,255,255,0.08);
          color:#e5e7eb;
          font-size:9px;
          letter-spacing:0.12em;
          cursor:pointer;
        ">${chartsToggleKey.toUpperCase()}</button>
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

      <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
        <div id="${RADAR_SETTINGS_HEADER_ID}" style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          cursor:pointer;
          font-size:9px;
          letter-spacing:0.12em;
          text-transform:uppercase;
          color:#94a3b8;
          user-select:none;
        ">
          <span>Radar Settings</span>
          <span id="${RADAR_SETTINGS_ARROW_ID}" style="
            font-size:8px;
            transition:transform 0.2s;
          ">&#9654;</span>
        </div>
        <div id="${RADAR_SETTINGS_BODY_ID}" style="
          display:none;
          margin-top:8px;
          padding:0 2px;
        ">
          ${buildToggleRow("JTH Radar", JTH_TOGGLE_ID, radarPrefs.jth)}
          ${buildToggleRow("Seabus Radar", SEABUS_TOGGLE_ID, radarPrefs.seabus)}
        </div>
      </div>

      <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.06); padding-top:10px;">
        <button id="${CHARTS_BTN_ID}" style="
          width:100%;
          height:34px;
          border-radius:10px;
          border:1px solid rgba(34,211,238,0.2);
          background:rgba(34,211,238,0.08);
          color:#22d3ee;
          font-size:10px;
          font-weight:600;
          letter-spacing:0.12em;
          text-transform:uppercase;
          cursor:pointer;
          transition:background 0.15s;
        ">Airport Charts</button>
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
      keybindMode = "flight";
      document.getElementById(KEYBIND_BTN_ID).textContent = "...";
    };

    document.getElementById(CHARTS_KEYBIND_BTN_ID).onclick = () => {
      keybindMode = "charts";
      document.getElementById(CHARTS_KEYBIND_BTN_ID).textContent = "...";
    };

    document.getElementById(RADAR_SETTINGS_HEADER_ID).onclick = () => {
      const body = document.getElementById(RADAR_SETTINGS_BODY_ID);
      const arrow = document.getElementById(RADAR_SETTINGS_ARROW_ID);
      const opening = body.style.display === "none";
      body.style.display = opening ? "grid" : "none";
      body.style.gap = "6px";
      arrow.style.transform = opening ? "rotate(90deg)" : "rotate(0deg)";
    };

    function setupToggle(id, key) {
      document.getElementById(id).onclick = () => {
        radarPrefs[key] = !radarPrefs[key];
        saveRadarPrefs();
        updateToggleVisual(id, radarPrefs[key]);
      };
    }

    setupToggle(JTH_TOGGLE_ID, "jth");
    setupToggle(SEABUS_TOGGLE_ID, "seabus");

    document.getElementById(SAVE_BTN_ID).onclick = async () => {
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

      const myId = geofs?.userRecord?.googleid || geofs?.userRecord?.callsign;
      const available = await checkFlightNoAvailable(flt, myId);
      if (!available) {
        showToast("Callsign already in use", true);
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

    document.getElementById(CHARTS_BTN_ID).onclick = toggleChartsPanel;
  }

  // ==========================================
  // AIRPORT CHARTS — UI Injection
  // ==========================================

  function injectChartsCSS() {
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href =
      "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(fontLink);

    const style = document.createElement("style");
    style.textContent = `
      @keyframes gc-slide-in {
        from { opacity: 0; transform: translateX(12px); }
        to { opacity: 1; transform: translateX(0); }
      }

      #${CHARTS_PANEL_ID} {
        position: fixed;
        z-index: 100002;
        display: none;
        flex-direction: column;
        width: ${CHARTS_DEFAULT_WIDTH}px;
        height: auto;
        max-height: calc(100vh - 16px);
        font-family: 'Figtree', system-ui, sans-serif;
        color: #ffffff;
        background: rgba(1, 11, 16, 0.94);
        border: 1px solid rgba(34, 211, 238, 0.15);
        border-radius: 12px;
        box-shadow:
          0 20px 40px rgba(0, 0, 0, 0.45),
          0 0 1px rgba(0, 0, 0, 0.4),
          0 0 20px rgba(0, 255, 255, 0.04);
        backdrop-filter: blur(16px);
        animation: gc-slide-in 0.2s ease-out;
        overflow: hidden;
      }

      .gc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 14px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        user-select: none;
        flex-shrink: 0;
      }

      .gc-header h3 {
        margin: 0;
        font-family: 'Figtree', system-ui, sans-serif;
        font-size: 0.95rem;
        font-weight: 700;
        color: #22d3ee;
        letter-spacing: -0.01em;
      }

      .gc-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .gc-invert-toggle {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: transparent;
        color: rgba(255, 255, 255, 0.4);
        font-family: 'Figtree', system-ui, sans-serif;
        font-size: 0.7rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .gc-invert-toggle:hover {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.7);
      }

      .gc-invert-toggle.active {
        background: rgba(34, 211, 238, 0.1);
        border-color: rgba(34, 211, 238, 0.25);
        color: #22d3ee;
      }

      .gc-close {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: transparent;
        color: rgba(255, 255, 255, 0.35);
        font-size: 1.15rem;
        line-height: 1;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .gc-close:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.15);
      }

      .gc-search {
        display: flex;
        gap: 6px;
        padding: 10px 14px 0;
        flex-shrink: 0;
      }

      .gc-search input {
        flex: 1;
        height: 36px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.4);
        color: #ffffff;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.85rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: 0 12px;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .gc-search input::placeholder {
        color: rgba(255, 255, 255, 0.2);
        font-family: 'Figtree', system-ui, sans-serif;
        font-weight: 400;
        letter-spacing: 0;
        text-transform: none;
      }

      .gc-search input:focus {
        border-color: rgba(34, 211, 238, 0.5);
        box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.08);
      }

      .gc-search-btn {
        width: 64px;
        height: 36px;
        border-radius: 7px;
        border: none;
        background: #22d3ee;
        color: #010b10;
        font-family: 'Figtree', system-ui, sans-serif;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .gc-search-btn:hover {
        background: #06b6d4;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.2);
      }

      .gc-search-btn:active {
        transform: scale(0.96);
      }

      .gc-reset-btn {
        width: 64px;
        height: 36px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.85);
        font-family: 'Figtree', system-ui, sans-serif;
        font-size: 0.74rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .gc-reset-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.22);
      }

      .gc-reset-btn:active {
        transform: scale(0.96);
      }

      .gc-status {
        padding: 0 14px;
        margin-top: 6px;
        min-height: 16px;
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.3);
        flex-shrink: 0;
      }

      .gc-type-tabs {
        display: flex;
        gap: 4px;
        padding: 8px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
      }

      .gc-type-tab {
        flex: 1;
        padding: 6px 2px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.03);
        font-family: 'Figtree', system-ui, sans-serif;
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        color: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
      }

      .gc-type-tab:hover {
        background: rgba(255, 255, 255, 0.07);
        color: rgba(255, 255, 255, 0.7);
      }

      .gc-type-tab span {
        margin-left: 3px;
        opacity: 0.5;
        font-size: 0.6rem;
      }

      .gc-type-tab.active {
        background: rgba(34, 211, 238, 0.15);
        border-color: rgba(34, 211, 238, 0.3);
        color: #22d3ee;
      }

      .gc-type-tab.active span { opacity: 0.7; }

      .gc-list {
        flex-shrink: 0;
        padding: 6px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .gc-select {
        width: 100%;
        height: 32px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.4);
        color: #ffffff;
        font-family: 'Figtree', system-ui, sans-serif;
        font-size: 0.76rem;
        font-weight: 500;
        padding: 0 28px 0 10px;
        outline: none;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        transition: border-color 0.15s ease;
      }

      .gc-select:hover {
        border-color: rgba(255, 255, 255, 0.2);
      }

      .gc-select:focus {
        border-color: rgba(34, 211, 238, 0.5);
      }

      .gc-select option {
        background: #0a0f14;
        color: #ffffff;
      }

      .gc-preview::-webkit-scrollbar { width: 4px; }
      .gc-preview::-webkit-scrollbar-track { background: transparent; }
      .gc-preview::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
      }
      .gc-preview::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .gc-empty {
        color: rgba(255, 255, 255, 0.2);
        font-size: 0.76rem;
        padding: 12px 10px;
      }

      .gc-preview {
        flex: none;
        height: 0;
        overflow: hidden;
        padding: 10px 14px 14px;
      }

      .gc-image-wrap {
        width: 100%;
        overflow: hidden;
        position: relative;
      }

      .gc-image-wrap img {
        width: 100%;
        height: auto;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: #000000;
        transition: transform 0.08s ease-out;
        user-select: none;
      }

      .gc-image-wrap img.inverted {
        filter: invert(1) hue-rotate(180deg) contrast(1.05) saturate(0.95);
      }

      .gc-resize-handle {
        position: absolute;
        z-index: 10;
      }

      .gc-resize-right {
        top: 40px;
        right: -3px;
        width: 6px;
        bottom: 12px;
        cursor: ew-resize;
      }

      .gc-resize-bottom {
        left: 12px;
        right: 12px;
        bottom: -3px;
        height: 6px;
        cursor: ns-resize;
      }

      .gc-resize-corner {
        right: 0;
        bottom: 0;
        width: 16px;
        height: 16px;
        cursor: nwse-resize;
      }

      .gc-resize-corner::after {
        content: '';
        position: absolute;
        right: 4px;
        bottom: 4px;
        width: 8px;
        height: 8px;
        border-right: 2px solid rgba(255, 255, 255, 0.2);
        border-bottom: 2px solid rgba(255, 255, 255, 0.2);
      }

      .gc-resize-corner:hover::after {
        border-color: rgba(34, 211, 238, 0.5);
      }

      @media (max-width: 640px) {
        #${CHARTS_PANEL_ID} {
          width: calc(100vw - 16px);
          height: calc(100vh - 16px);
          max-height: none;
          top: 8px !important;
          left: 8px !important;
        }
        .gc-type-tabs { flex-wrap: wrap; }
        .gc-type-tab {
          flex: 1 1 calc(50% - 2px);
          min-width: calc(50% - 2px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createChartsPanel() {
    if (document.getElementById(CHARTS_PANEL_ID)) return;

    const panel = document.createElement("div");
    panel.id = CHARTS_PANEL_ID;
    panel.innerHTML = `
      <div class="gc-header">
        <h3 class="gc-title">Airport Charts</h3>
        <div class="gc-header-actions">
          <button class="gc-invert-toggle" title="Toggle color inversion">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z"/></svg>
            Invert
          </button>
          <button class="gc-close" title="Close">&times;</button>
        </div>
      </div>
      <div class="gc-search">
        <input id="gc-icao-input" type="text" placeholder="ICAO code..." maxlength="4" spellcheck="false" />
        <button id="gc-search-btn" class="gc-search-btn">Load</button>
        <button id="gc-reset-btn" class="gc-reset-btn">Reset</button>
      </div>
      <div id="gc-search-status" class="gc-status"></div>
      <div class="gc-type-tabs"></div>
      <div class="gc-list"></div>
      <div class="gc-preview"></div>
      <div class="gc-resize-handle gc-resize-right"></div>
      <div class="gc-resize-handle gc-resize-bottom"></div>
      <div class="gc-resize-handle gc-resize-corner"></div>
    `;
    document.body.appendChild(panel);

    // Restore position (default: left side)
    const pos = loadChartsPos();
    panel.style.top = (pos ? pos.top : CHARTS_DEFAULT_TOP) + "px";
    panel.style.left = (pos ? pos.left : CHARTS_DEFAULT_LEFT) + "px";

    // Stop clicks from reaching GeoFS
    panel.addEventListener("click", (e) => e.stopPropagation());

    // Restore saved size
    const size = loadChartsSize();
    if (size) {
      panel.style.width = size.width + "px";
      if (size.maxHeight) panel.style.maxHeight = size.maxHeight + "px";
    }
    clampChartsPanelToViewport(panel);

    // Draggable header
    makeChartsDraggable(panel, panel.querySelector(".gc-header"));

    // Resizable edges and corner
    makeChartsResizable(panel);

    // Events
    const input = document.getElementById("gc-icao-input");
    if (input) {
      ["keydown", "keyup", "keypress"].forEach((evt) => {
        input.addEventListener(evt, (e) => e.stopPropagation());
      });
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") chartsSearch();
      });
    }

    document.getElementById("gc-search-btn").onclick = chartsSearch;
    document.getElementById("gc-reset-btn").onclick = resetChartsAndRefetch;
    panel.querySelector(".gc-close").onclick = hideChartsPanel;
    panel.querySelector(".gc-invert-toggle").onclick = () => {
      chartsState.invertColors = !chartsState.invertColors;
      renderChartsContent();
    };

    window.addEventListener("resize", () => {
      clampChartsPanelToViewport(panel);
      syncChartsViewerHeight();
      saveChartsPos(panel);
      saveChartsSize(panel);
    });
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  window.addEventListener("keydown", (e) => {
    if (keybindMode === "flight") {
      toggleKey = e.key.toLowerCase();
      localStorage.setItem(STORAGE_KEY, toggleKey);
      document.getElementById(KEYBIND_BTN_ID).textContent =
        toggleKey.toUpperCase();
      keybindMode = null;
      showToast("Toggle key updated");
      return;
    }

    if (keybindMode === "charts") {
      chartsToggleKey = e.key.toLowerCase();
      localStorage.setItem(CHARTS_TOGGLE_KEY, chartsToggleKey);
      document.getElementById(CHARTS_KEYBIND_BTN_ID).textContent =
        chartsToggleKey.toUpperCase();
      keybindMode = null;
      showToast("Charts key updated");
      return;
    }

    if (
      e.key.toLowerCase() === toggleKey &&
      e.target.tagName !== "INPUT" &&
      e.target.tagName !== "TEXTAREA"
    ) {
      flightUI.style.display =
        flightUI.style.display === "none" ? "block" : "none";
      return;
    }

    if (
      e.key.toLowerCase() === chartsToggleKey &&
      e.target.tagName !== "INPUT" &&
      e.target.tagName !== "TEXTAREA"
    ) {
      toggleChartsPanel();
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

  window.addEventListener("atc-squawk-update", (e) => {
    const sqkEl = document.getElementById(SQK_INPUT_ID);
    if (sqkEl && e.detail.squawk) {
      sqkEl.value = e.detail.squawk;
    }
  });

  // ==========================================
  // INIT
  // ==========================================

  injectFlightUI();
  injectChartsCSS();
  createChartsPanel();
  setupChartZoomHandlers();
  setInterval(syncFlightPlan, 3000);
})();
