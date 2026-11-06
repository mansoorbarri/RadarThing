(function () {
  "use strict";

  // If a previous boot got far enough to build the panel (e.g. a retry after
  // a partial failure), don't inject a second copy of the UI and listeners.
  if (document.getElementById("geofs-atc-radar-flightInfoUI")) {
    console.info("[RadarThing] Panel already present; skipping re-init.");
    return;
  }

  // ==========================================
  // ATC FLIGHT INFO — Constants & State
  // ==========================================

  const STORAGE_KEY = "geofs-atc-toggle-key";
  const CHARTS_TOGGLE_KEY = "geofs-atc-charts-toggle-key";
  const RADAR_PREFS_KEY = "geofs-atc-radar-prefs";
  let toggleKey = localStorage.getItem(STORAGE_KEY) || "w";
  let chartsToggleKey = localStorage.getItem(CHARTS_TOGGLE_KEY) || "q";

  const UI_CONTAINER_ID = "geofs-atc-radar-flightInfoUI";
  const MOBILE_UI_CLOSE_ID = "geofs-atc-mobile-close";
  const MOBILE_UI_OPEN_ID = "geofs-atc-mobile-open";
  const DEP_INPUT_ID = "atc-depInput";
  const ARR_INPUT_ID = "atc-arrInput";
  const FLT_INPUT_ID = "atc-fltInput";
  const SQK_INPUT_ID = "atc-sqkInput";
  const SAVE_BTN_ID = "atc-saveBtn";
  const CLEAR_BTN_ID = "atc-clearBtn";
  const STATUS_INDICATOR_ID = "atc-statusIndicator";
  const MOST_TRACKED_BADGE_ID = "radarthing-most-tracked-badge";
  const SIGN_IN_NOTICE_ID = "atc-sign-in-notice";
  const KEYBIND_BTN_ID = "atc-keybind-btn";
  const CHARTS_KEYBIND_BTN_ID = "atc-charts-keybind-btn";
  const FLIGHT_UI_MOVE_BTN_ID = "atc-flight-ui-move-btn";
  const FLIGHT_UI_RESET_BTN_ID = "atc-flight-ui-reset-btn";
  const FLIGHT_UI_HEADER_ID = "atc-flight-ui-header";
  const FLIGHT_UI_POS_KEY = "geofs-atc-flight-ui-position";
  const RADAR_SETTINGS_HEADER_ID = "atc-radar-settings-header";
  const RADAR_SETTINGS_BODY_ID = "atc-radar-settings-body";
  const RADAR_SETTINGS_ARROW_ID = "atc-radar-settings-arrow";
  const SEABUS_TOGGLE_ID = "atc-toggle-seabus";
  const CHARTS_BTN_ID = "atc-charts-btn";
  const AF_INPUT_ID = "atc-afInput";
  const AF_FIELD_WRAP_ID = "atc-afFieldWrap";
  const MILITARY_CHECKBOX_ID = "atc-militaryCheckbox";
  const RESUME_FLIGHT_API = "https://sse.radarthing.com/api/resume-flight";
  const RESUME_MODAL_ID = "radarthing-resume-flight-modal";
  const TRACKING_STATUS_API =
    "https://radarthing.com/api/userscript/tracking-status";
  const TRACKING_STATUS_POLL_INTERVAL_MS = 15000;
  const ACARS_API = "https://radarthing.com/api/userscript/acars";
  const ACARS_DEVICE_API = `${ACARS_API}/device`;
  const ACARS_FLIGHT_API = `${ACARS_API}/flight`;
  const ACARS_PANEL_ID = "radarthing-acars-panel";
  const ACARS_DRAFT_ID = "radarthing-acars-draft";
  const ACARS_PUBLISH_ID = "radarthing-acars-publish";
  const ACARS_LIST_ID = "radarthing-acars-list";
  const ACARS_TOGGLE_ID = "radarthing-acars-toggle";
  const ACARS_BODY_ID = "radarthing-acars-body";

  // One z-index scale for everything RadarThing injects into GeoFS, so panels,
  // dialogs and toasts always stack predictably above the sim UI.
  const Z = {
    flightPanel: 999990,
    chartsPanel: 999992,
    reopenTab: 999994,
    dialog: 999996,
    toast: 999998,
  };
  const WELCOME_SEEN_KEY = "radarthing-welcome-seen-v1";
  const WELCOME_CARD_ID = "radarthing-welcome-card";
  const SEABUS_HINT_ID = "atc-seabus-hint";
  const HOTKEY_HINT_ID = "atc-hotkey-hint";
  const FLIGHT_UI_HIDE_BTN_ID = "atc-flight-ui-hide-btn";

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  }

  let flightUI;
  let mobileFlightUIOpenButton;
  let keybindMode = null;
  let lastSyncedPlan = "";
  let resumePromptCheckStarted = false;
  let resumePromptResolved = false;
  let resumeModalResolver = null;
  let resumeModalReturnFocus = null;
  let isTracking = false;
  // Set when the pilot chose "decide later" on the resume dialog. Starting a
  // new flight first closes that old leg so the two don't get merged.
  let resumeDeferredGoogleId = "";

  async function closeDeferredResumeSession() {
    const googleId = resumeDeferredGoogleId;
    if (!googleId) return;
    resumeDeferredGoogleId = "";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      await fetch(RESUME_FLIGHT_API, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decline",
          googleId,
          currentId: geofs?.userRecord?.googleid || geofs?.userRecord?.callsign,
        }),
      });
    } catch (_) {
      // The server times old legs out on its own; don't block the new flight.
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // While a flight is tracked the form folds into a one-line summary so the
  // panel covers less of the simulator; "Edit flight" opens it again.
  let editingFlight = false;
  let lastTrackedFlight = null;
  function applyCompactMode() {
    const summary = document.getElementById("atc-flight-summary");
    const fields = document.getElementById("atc-flight-fields");
    const editBtn = document.getElementById("atc-edit-flight-btn");
    const startBtn = document.getElementById(SAVE_BTN_ID);
    if (!summary || !fields || !startBtn) return;
    const compact = isTracking && !editingFlight;
    // If the button about to be hidden has focus, keep focus in the panel.
    const startHadFocus = document.activeElement === startBtn;
    summary.hidden = !isTracking;
    // While tracking the pill shows "· 4s ago" instead of the key hint.
    const hint = document.getElementById(HOTKEY_HINT_ID);
    if (hint) hint.hidden = isTracking;
    fields.hidden = compact;
    startBtn.hidden = compact;
    if (compact && startHadFocus) editBtn?.focus();
    startBtn.parentElement.style.gridTemplateColumns = compact
      ? "1fr"
      : "1.4fr 1fr";
    if (editBtn) {
      editBtn.textContent = editingFlight ? "Cancel" : "Edit flight";
      editBtn.setAttribute("aria-expanded", String(!compact));
    }
    const text = summary.querySelector("[data-summary-text]");
    if (text) {
      const value = (id) =>
        String(document.getElementById(id)?.value || "").trim();
      const sqk = value(SQK_INPUT_ID);
      text.textContent = `${value(DEP_INPUT_ID)} → ${value(ARR_INPUT_ID)}${sqk ? ` · Squawk ${sqk}` : ""}`;
      const callsign = summary.querySelector("[data-summary-callsign]");
      if (callsign) callsign.textContent = value(FLT_INPUT_ID);
    }
  }

  function setFlightEditing(next) {
    const panel = document.getElementById(UI_CONTAINER_ID);
    const hadFocus = Boolean(panel && panel.contains(document.activeElement));
    editingFlight = next;
    applyCompactMode();
    if (!hadFocus) return;
    if (next) document.getElementById(DEP_INPUT_ID)?.focus();
    else document.getElementById("atc-edit-flight-btn")?.focus();
  }

  function setTrackingUi(active) {
    if (active !== isTracking) editingFlight = false;
    isTracking = active;
    const startBtn = document.getElementById(SAVE_BTN_ID);
    const endBtn = document.getElementById(CLEAR_BTN_ID);
    if (startBtn && !startBtn.disabled)
      startBtn.textContent = active ? "Update flight" : "Start tracking";
    if (endBtn) {
      endBtn.disabled = !active;
      endBtn.style.opacity = active ? "1" : "0.5";
      endBtn.style.cursor = active ? "pointer" : "not-allowed";
    }
    applyCompactMode();
  }
  let flightActiveForTrackingBadge = false;
  let trackingStatusRequestId = 0;
  let acarsBusy = false;
  let acarsRequestId = 0;
  let acarsSessionId = "";
  let acarsSessionGoogleId = "";
  let acarsFlightSignature = "";
  let acarsFlightQueue = Promise.resolve();
  let acarsRetryAfter = 0;

  function acarsPilotId() {
    const id = String(window.geofs?.userRecord?.googleid || "");
    return /^\d{8,32}$/.test(id) ? id : "";
  }

  function acarsDeviceToken(googleId) {
    const key = `radarthing-acars-device-${googleId}`;
    let token = localStorage.getItem(key);
    if (token && /^[a-f0-9]{64}$/.test(token)) return token;
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    token = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    localStorage.setItem(key, token);
    return token;
  }

  function acarsSessionKey(googleId) {
    return `radarthing-acars-flight-${googleId}`;
  }

  async function ensureAcarsDevice(googleId, token) {
    const response = await fetch(ACARS_DEVICE_API, {
      method: "POST",
      headers: acarsHeaders(token),
      body: JSON.stringify({ googleId }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "ACARS registration failed");
  }

  function queueAcarsFlight(googleId, sessionId, active) {
    acarsFlightQueue = acarsFlightQueue
      .catch(() => {})
      .then(async () => {
        const token = active
          ? acarsDeviceToken(googleId)
          : localStorage.getItem(`radarthing-acars-device-${googleId}`);
        if (!token) return;
        if (active) await ensureAcarsDevice(googleId, token);
        const response = await fetch(ACARS_FLIGHT_API, {
          method: "POST",
          headers: acarsHeaders(token),
          body: JSON.stringify({ googleId, sessionId, active }),
        });
        if (!response.ok)
          throw new Error("Could not update ACARS flight session");
      });
    return acarsFlightQueue;
  }

  function startAcarsFlight(googleId, resumed = false) {
    if (
      acarsSessionGoogleId &&
      acarsSessionGoogleId !== googleId &&
      acarsSessionId
    )
      void queueAcarsFlight(acarsSessionGoogleId, acarsSessionId, false).catch(
        () => {},
      );
    const list = document.getElementById(ACARS_LIST_ID);
    if (list) list.replaceChildren();
    const saved = resumed && localStorage.getItem(acarsSessionKey(googleId));
    acarsSessionId = saved || crypto.randomUUID();
    acarsSessionGoogleId = googleId;
    localStorage.setItem(acarsSessionKey(googleId), acarsSessionId);
    const startedSessionId = acarsSessionId;
    void queueAcarsFlight(googleId, startedSessionId, true)
      .then(() => {
        if (acarsSessionId === startedSessionId) acarsRetryAfter = 0;
      })
      .catch((error) => {
        if (
          acarsSessionId !== startedSessionId ||
          acarsSessionGoogleId !== googleId
        )
          return;
        acarsSessionId = "";
        acarsSessionGoogleId = "";
        acarsRetryAfter = Date.now() + 30_000;
        if (list)
          list.textContent =
            error?.message || "ACARS is unavailable right now.";
        updateAcarsAvailability();
      });
  }

  function acarsHeaders(token) {
    return {
      "Content-Type": "application/json",
      "X-Requested-With": "GeoFS-RadarThing",
      ...(token ? { "X-ACARS-Token": token } : {}),
    };
  }

  function updateAcarsAvailability() {
    const panel = document.getElementById(ACARS_PANEL_ID);
    const button = document.getElementById(ACARS_PUBLISH_ID);
    const draft = document.getElementById(ACARS_DRAFT_ID);
    const active =
      flightActiveForTrackingBadge && Boolean(acarsPilotId() && acarsSessionId);
    if (panel) panel.style.display = active ? "block" : "none";
    if (button) button.disabled = !active || acarsBusy;
    if (draft) draft.disabled = !active || acarsBusy;
  }

  async function refreshAcars() {
    const list = document.getElementById(ACARS_LIST_ID);
    const googleId = acarsPilotId();
    const requestId = ++acarsRequestId;
    const sessionId = acarsSessionId;
    if (!list || !flightActiveForTrackingBadge || !googleId || !sessionId)
      return;
    try {
      await acarsFlightQueue;
      if (requestId !== acarsRequestId || acarsSessionId !== sessionId) return;
      const token = localStorage.getItem(`radarthing-acars-device-${googleId}`);
      const response = await fetch(
        `${ACARS_API}?googleId=${encodeURIComponent(googleId)}`,
        {
          cache: "no-store",
          headers: acarsHeaders(token),
        },
      );
      if (!response.ok) throw new Error("Could not load ACARS entries");
      const data = await response.json();
      if (
        requestId !== acarsRequestId ||
        acarsPilotId() !== googleId ||
        acarsSessionId !== sessionId
      )
        return;
      list.replaceChildren();
      for (const message of data.messages || []) {
        const row = document.createElement("div");
        row.style.cssText =
          "border-top:1px solid rgba(255,255,255,.08);padding:8px 0;font-size:11px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere";
        const time = document.createElement("div");
        time.style.cssText = "font-size:11px;color:#67e8f9;margin-bottom:3px";
        time.textContent = new Date(message.createdAt).toLocaleString();
        const content = document.createElement("div");
        content.textContent = message.body;
        row.append(time, content);
        if (message.canRemove) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "Remove";
          remove.setAttribute("aria-label", "Remove this ACARS entry");
          remove.style.cssText =
            "margin-top:4px;padding:2px 0;border:0;background:none;color:#fca5a5;font-size:11px;cursor:pointer";
          // Two-step, like End flight: viewers can't get a removed entry back.
          let confirmTimer = 0;
          const resetRemove = () => {
            clearTimeout(confirmTimer);
            remove.dataset.confirming = "";
            remove.textContent = "Remove";
            remove.style.fontWeight = "400";
          };
          remove.addEventListener("click", () => {
            if (remove.dataset.confirming !== "1") {
              remove.dataset.confirming = "1";
              remove.textContent = isMobileBrowser()
                ? "Tap again to remove"
                : "Click again to remove";
              remove.style.fontWeight = "700";
              confirmTimer = setTimeout(resetRemove, 4000);
              return;
            }
            resetRemove();
            void removeAcars(message._id);
          });
          remove.addEventListener("blur", () => {
            if (remove.dataset.confirming === "1") resetRemove();
          });
          row.appendChild(remove);
        }
        list.appendChild(row);
      }
      if (!data.messages?.length) list.textContent = "No ACARS entries yet.";
    } catch (_) {
      if (requestId === acarsRequestId)
        list.textContent = "Could not load ACARS entries.";
    }
  }

  async function removeAcars(messageId) {
    const googleId = acarsPilotId();
    const token =
      googleId && localStorage.getItem(`radarthing-acars-device-${googleId}`);
    if (!googleId || !token || !flightActiveForTrackingBadge) return;
    try {
      const response = await fetch(ACARS_API, {
        method: "DELETE",
        headers: acarsHeaders(token),
        body: JSON.stringify({ googleId, messageId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not remove ACARS entry");
      showToast("ACARS entry removed");
      await refreshAcars();
    } catch (error) {
      showToast(error?.message || "Could not remove ACARS entry", true);
    }
  }

  async function publishAcars() {
    const draft = document.getElementById(ACARS_DRAFT_ID);
    const googleId = acarsPilotId();
    const body = draft?.value.trim() || "";
    const sessionId = acarsSessionId;
    if (!flightActiveForTrackingBadge || !googleId || !sessionId)
      return showToast("Save an active flight while signed in to GeoFS", true);
    if (!body || body.length > 500)
      return showToast("Enter 1–500 ACARS characters", true);
    if (acarsBusy) return;
    acarsBusy = true;
    updateAcarsAvailability();
    try {
      await acarsFlightQueue;
      if (!flightActiveForTrackingBadge || acarsSessionId !== sessionId)
        throw new Error("This flight has ended");
      const token = acarsDeviceToken(googleId);
      await ensureAcarsDevice(googleId, token);
      const response = await fetch(ACARS_API, {
        method: "POST",
        headers: acarsHeaders(token),
        body: JSON.stringify({ googleId, sessionId, body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ACARS publish failed");
      draft.value = "";
      showToast("ACARS published");
      await refreshAcars();
    } catch (error) {
      showToast(error?.message || "ACARS publish failed", true);
    } finally {
      acarsBusy = false;
      updateAcarsAvailability();
    }
  }
  function loadRadarPrefs() {
    try {
      const raw = localStorage.getItem(RADAR_PREFS_KEY);
      if (!raw) return { seabus: false };

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return { seabus: false };
      }

      return {
        seabus: parsed.seabus === true,
      };
    } catch (_) {
      return { seabus: false };
    }
  }

  let radarPrefs = loadRadarPrefs();
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
  const CHARTS_ROTATIONS_KEY = "radarthing-chart-rotations-v1";
  const CHART_TYPES = ["TAXI", "SID", "STAR", "APPROACH"];
  const CHARTS_DEFAULT_TOP = 60;
  const CHARTS_DEFAULT_LEFT = 16;
  const CHARTS_DEFAULT_WIDTH = 370;
  const chartsMemoryCache = new Map();
  let storedChartRotations = null;

  const chartsState = {
    currentIcao: "",
    chartsByType: { TAXI: [], SID: [], STAR: [], APPROACH: [] },
    currentType: "TAXI",
    selectedChartId: null,
    invertColors: true,
    rotation: 0,
    zoom: { scale: 1, panX: 0, panY: 0 },
  };
  const chartsUi = {
    panel: null,
    title: null,
    typeTabs: null,
    chartList: null,
    preview: null,
    invertToggle: null,
    rotateToggle: null,
    previewWrap: null,
    previewImg: null,
    previewChartId: null,
    heightFrame: 0,
  };

  // ==========================================
  // ATC FLIGHT INFO — Functions
  // ==========================================

  function isICAO(str) {
    return /^[A-Z]{4}$/.test(str);
  }

  // Airport idents in GeoFS flight plans are usually 4-letter ICAO codes, but
  // small fields use 3–4 character idents with digits (e.g. K1G4, 00AA).
  function isAirportCode(str) {
    if (!/[A-Z]/.test(str)) return false;
    // 4-letter ICAO codes, or 3–4 character local idents that include a
    // digit (e.g. K1G4, 0A9). Rejects 3-letter IATA codes like LHR.
    return (
      /^[A-Z]{4}$/.test(str) || (/\d/.test(str) && /^[A-Z0-9]{3,4}$/.test(str))
    );
  }

  function isMobileBrowser() {
    const uaMobile = navigator.userAgentData?.mobile;
    if (typeof uaMobile === "boolean") return uaMobile;

    const isIPad =
      navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const hasMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(
      navigator.userAgent,
    );

    return (
      isIPad ||
      hasMobileUserAgent ||
      (window.matchMedia("(pointer: coarse)").matches &&
        window.innerWidth < 1024)
    );
  }

  function setFlightUIVisible(visible) {
    if (!flightUI) return;
    if (!visible && keybindMode) finishKeybindCapture(null);
    flightUI.style.display = visible ? "block" : "none";
    if (mobileFlightUIOpenButton) {
      mobileFlightUIOpenButton.style.display = visible ? "none" : "flex";
    }
  }

  function hotkeyHintText() {
    return `${toggleKey.toUpperCase()} show/hide · ${chartsToggleKey.toUpperCase()} charts`;
  }

  function refreshHotkeyHints() {
    const hint = document.getElementById(HOTKEY_HINT_ID);
    if (hint) hint.textContent = hotkeyHintText();
    const summary = document.querySelector("[data-shortcut-summary]");
    if (summary)
      summary.textContent = `(${toggleKey.toUpperCase()} / ${chartsToggleKey.toUpperCase()})`;
    const hideBtn = document.getElementById(FLIGHT_UI_HIDE_BTN_ID);
    if (hideBtn) {
      hideBtn.title = `Hide panel (${toggleKey.toUpperCase()})`;
      hideBtn.setAttribute(
        "aria-label",
        `Hide RadarThing panel (${toggleKey.toUpperCase()})`,
      );
    }
    if (mobileFlightUIOpenButton) {
      mobileFlightUIOpenButton.title = `Show RadarThing panel (${toggleKey.toUpperCase()})`;
    }
  }

  function loadFlightUiPosition() {
    try {
      const position = JSON.parse(localStorage.getItem(FLIGHT_UI_POS_KEY));
      if (
        !position ||
        !Number.isFinite(position.left) ||
        !Number.isFinite(position.top)
      ) {
        return null;
      }
      return position;
    } catch (_) {
      return null;
    }
  }

  function clampFlightUiToViewport() {
    if (!flightUI || !flightUI.style.left) return;

    const margin = 12;
    const maxLeft = Math.max(
      margin,
      window.innerWidth - flightUI.offsetWidth - margin,
    );
    const maxTop = Math.max(
      margin,
      window.innerHeight - flightUI.offsetHeight - margin,
    );
    const left = parseFloat(flightUI.style.left) || margin;
    const top = parseFloat(flightUI.style.top) || margin;

    flightUI.style.left = `${Math.min(Math.max(left, margin), maxLeft)}px`;
    flightUI.style.top = `${Math.min(Math.max(top, margin), maxTop)}px`;
  }

  function saveFlightUiPosition() {
    if (!flightUI || !flightUI.style.left) return;
    localStorage.setItem(
      FLIGHT_UI_POS_KEY,
      JSON.stringify({
        left: parseFloat(flightUI.style.left),
        top: parseFloat(flightUI.style.top),
      }),
    );
    // Reset only means something once the panel has been moved.
    const resetButton = document.getElementById(FLIGHT_UI_RESET_BTN_ID);
    if (resetButton) resetButton.hidden = false;
  }

  function makeFlightUiMovable() {
    const moveButton = document.getElementById(FLIGHT_UI_MOVE_BTN_ID);
    const resetButton = document.getElementById(FLIGHT_UI_RESET_BTN_ID);
    const header = document.getElementById(FLIGHT_UI_HEADER_ID);
    if (!moveButton || !resetButton || !header || !flightUI) return;

    let moveMode = false;
    let dragging = false;
    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;

    const updateMoveMode = () => {
      moveButton.textContent = moveMode ? "Done" : "Move";
      moveButton.setAttribute("aria-pressed", String(moveMode));
      moveButton.title = moveMode
        ? "Drag the header or use the arrow keys, then press Done"
        : "Move the panel";
      moveButton.style.background = moveMode
        ? "rgba(34,211,238,0.22)"
        : "transparent";
      moveButton.style.borderColor = moveMode
        ? "rgba(34,211,238,0.55)"
        : "rgba(255,255,255,0.12)";
      moveButton.style.color = moveMode ? "#a5f3fc" : "#94a3b8";
      header.style.cursor = moveMode ? "grab" : "default";
      header.title = moveMode ? "Drag this header to move the panel" : "";
    };

    moveButton.addEventListener("click", (event) => {
      event.stopPropagation();
      moveMode = !moveMode;
      updateMoveMode();
    });

    // Keyboard moving: while Move is on, arrow keys nudge the panel (hold
    // Shift for bigger steps) and Escape or Enter finishes.
    moveButton.addEventListener("keydown", (event) => {
      if (!moveMode) return;
      const step = event.shiftKey ? 40 : 10;
      const delta = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[event.key];
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        moveMode = false;
        updateMoveMode();
        return;
      }
      if (!delta) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = flightUI.getBoundingClientRect();
      flightUI.style.left = `${rect.left + delta[0]}px`;
      flightUI.style.top = `${rect.top + delta[1]}px`;
      flightUI.style.right = "auto";
      clampFlightUiToViewport();
      saveFlightUiPosition();
    });

    resetButton.addEventListener("click", (event) => {
      event.stopPropagation();
      moveMode = false;
      flightUI.style.left = "";
      flightUI.style.top = "72px";
      flightUI.style.right = "16px";
      localStorage.removeItem(FLIGHT_UI_POS_KEY);
      updateMoveMode();
      resetButton.hidden = true;
      moveButton.focus();
    });

    header.addEventListener("pointerdown", (event) => {
      if (!moveMode || event.target.closest("button")) return;

      const rect = flightUI.getBoundingClientRect();
      flightUI.style.left = `${rect.left}px`;
      flightUI.style.top = `${rect.top}px`;
      flightUI.style.right = "auto";
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      dragging = true;
      pointerId = event.pointerId;
      header.setPointerCapture(pointerId);
      header.style.cursor = "grabbing";
      event.preventDefault();
    });

    header.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      flightUI.style.left = `${event.clientX - offsetX}px`;
      flightUI.style.top = `${event.clientY - offsetY}px`;
      clampFlightUiToViewport();
    });

    const stopDragging = (event) => {
      if (!dragging || (event && event.pointerId !== pointerId)) return;
      dragging = false;
      pointerId = null;
      if (header.hasPointerCapture(event?.pointerId)) {
        header.releasePointerCapture(event.pointerId);
      }
      saveFlightUiPosition();
      updateMoveMode();
    };

    header.addEventListener("pointerup", stopDragging);
    header.addEventListener("pointercancel", stopDragging);
    window.addEventListener("resize", () => {
      if (!flightUI.style.left) return;
      clampFlightUiToViewport();
      saveFlightUiPosition();
    });

    updateMoveMode();
  }

  function sanitizeFlightCallsign(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/\s+/g, "");
  }

  function hideMostTrackedBadge() {
    const badge = document.getElementById(MOST_TRACKED_BADGE_ID);
    if (badge) badge.style.display = "none";
  }

  async function refreshMostTrackedBadge() {
    const badge = document.getElementById(MOST_TRACKED_BADGE_ID);
    const callsign = sanitizeFlightCallsign(window.geofs?.userRecord?.callsign);
    const requestId = ++trackingStatusRequestId;

    if (!badge || !flightActiveForTrackingBadge || !callsign) {
      hideMostTrackedBadge();
      return;
    }

    try {
      const response = await fetch(
        `${TRACKING_STATUS_API}?callsign=${encodeURIComponent(callsign)}`,
        {
          cache: "no-store",
          headers: { "X-Requested-With": "GeoFS-RadarThing" },
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const status = await response.json();
      const currentCallsign = sanitizeFlightCallsign(
        window.geofs?.userRecord?.callsign,
      );
      if (
        requestId !== trackingStatusRequestId ||
        !flightActiveForTrackingBadge ||
        currentCallsign !== callsign
      ) {
        return;
      }

      if (!status.isMostTracked) {
        hideMostTrackedBadge();
        return;
      }

      const count = Math.max(0, Number(status.count) || 0);
      const countEl = badge.querySelector("[data-tracker-count]");
      if (countEl) {
        countEl.textContent = `${count} viewer${count === 1 ? "" : "s"}`;
      }
      badge.title = `${count} people are viewing your flight on RadarThing`;
      badge.style.display = "flex";
    } catch (_) {
      if (requestId === trackingStatusRequestId) hideMostTrackedBadge();
    }
  }

  function normalizeFlightInfoValue(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  }

  function sanitizeSquawk(value) {
    return String(value || "")
      .replace(/\D+/g, "")
      .slice(0, 4);
  }

  function doesSessionMatchCurrentForm(session) {
    const currentFlightNo = normalizeFlightInfoValue(
      document.getElementById(FLT_INPUT_ID)?.value,
    );
    const currentDeparture = normalizeFlightInfoValue(
      document.getElementById(DEP_INPUT_ID)?.value,
    );
    const currentArrival = normalizeFlightInfoValue(
      document.getElementById(ARR_INPUT_ID)?.value,
    );
    const sessionFlightNo = normalizeFlightInfoValue(
      session?.flightNo || session?.callsign,
    );
    const sessionDeparture = normalizeFlightInfoValue(
      session?.departure || session?.dep,
    );
    const sessionArrival = normalizeFlightInfoValue(
      session?.arrival || session?.arr,
    );

    if (
      !currentFlightNo ||
      !sessionFlightNo ||
      currentFlightNo !== sessionFlightNo
    ) {
      return false;
    }

    if (
      currentDeparture &&
      sessionDeparture &&
      currentDeparture !== sessionDeparture
    ) {
      return false;
    }

    if (currentArrival && sessionArrival && currentArrival !== sessionArrival) {
      return false;
    }

    return Boolean(
      currentDeparture || sessionDeparture || currentArrival || sessionArrival,
    );
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

  // One fixed stack holds both live regions, so error and info toasts sit
  // one above the other instead of drawing on top of each other.
  function getToastStack() {
    let stack = document.getElementById("radarthing-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "radarthing-toast-stack";
      stack.style.cssText = `
        position:fixed;
        bottom:max(20px, env(safe-area-inset-bottom));
        right:max(20px, env(safe-area-inset-right));
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        gap:8px;
        max-width:min(360px, calc(100vw - 40px));
        z-index:${Z.toast};
        pointer-events:none;
      `;
      document.body.appendChild(stack);
    }
    return stack;
  }

  function getToastRegion(isError) {
    // Persistent live regions are announced reliably; freshly inserted ones
    // often aren't. Errors use an assertive region, the rest polite.
    const id = isError ? "radarthing-toasts-alert" : "radarthing-toasts";
    let region = document.getElementById(id);
    if (!region) {
      region = document.createElement("div");
      region.id = id;
      region.setAttribute("role", isError ? "alert" : "status");
      region.setAttribute("aria-live", isError ? "assertive" : "polite");
      region.style.cssText = `
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        gap:8px;
        pointer-events:none;
      `;
      const stack = getToastStack();
      // Errors go on top so they're the first thing the pilot sees.
      if (isError) stack.prepend(region);
      else stack.appendChild(region);
    }
    return region;
  }

  function showToast(msg, isError = false, action = null) {
    const toast = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = msg;
    label.style.flex = "1";
    toast.appendChild(label);
    if (action && action.label && typeof action.onClick === "function") {
      toast.dataset.hasAction = "1";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.style.cssText =
        "margin-left:12px;padding:4px 10px;border:1px solid rgba(255,255,255,0.5);border-radius:8px;background:transparent;color:#fff;font:700 12px system-ui,sans-serif;cursor:pointer;";
      btn.onclick = () => {
        toast.remove();
        action.onClick();
      };
      toast.appendChild(btn);
    }
    toast.style.cssText = `
      background:${isError ? "rgba(185,28,28,0.95)" : "rgba(4,120,87,0.95)"};
      color:#fff;
      padding:12px 16px;
      border-radius:12px;
      font-size:12px;
      font-weight:600;
      line-height:1.4;
      letter-spacing:0.02em;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
      opacity:0;
      transition:opacity 0.3s ease;
      box-shadow:0 10px 30px rgba(0,0,0,0.4);
    `;
    // Every toast can be dismissed, so it must be clickable inside the
    // click-through region.
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss notification");
    close.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
    close.style.cssText =
      "margin-left:8px;width:32px;height:32px;display:grid;place-items:center;flex:none;padding:0;border:0;border-radius:6px;background:transparent;color:rgba(255,255,255,0.8);font:400 18px/1 system-ui,sans-serif;cursor:pointer;";
    toast.appendChild(close);
    toast.style.pointerEvents = "auto";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "4px";

    const region = getToastRegion(isError);
    // The same message twice in a row (e.g. a repeated remote command) just
    // refreshes the existing toast instead of stacking a copy.
    const duplicate = Array.from(region.children).find(
      (existing) =>
        !existing.dataset.hasAction && existing.dataset.message === msg,
    );
    if (duplicate && !action) duplicate.remove();
    toast.dataset.message = msg;
    // Keep the stack short so it never covers the instruments, but never
    // drop one the pilot still has to act on (e.g. "Retry ending").
    while (region.children.length >= 3) {
      const oldest =
        Array.from(region.children).find((child) => !child.dataset.hasAction) ||
        region.firstElementChild;
      oldest.remove();
    }
    region.appendChild(toast);
    // Focus is deliberately not moved to the toast: pilots may be flying with
    // keyboard controls, and Space/Enter would trigger it by accident.
    requestAnimationFrame(() => (toast.style.opacity = "1"));

    const dismiss = () => {
      clearTimeout(timer);
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    };
    // Errors and actions stay long enough to read and act on.
    const duration = action ? 15000 : isError ? 10000 : 4000;
    let timer = setTimeout(dismiss, duration);
    close.onclick = dismiss;
    // Hovering or focusing a toast pauses it.
    const pause = () => clearTimeout(timer);
    const resume = () => {
      clearTimeout(timer);
      timer = setTimeout(dismiss, 3000);
    };
    toast.addEventListener("pointerenter", pause);
    toast.addEventListener("pointerleave", resume);
    toast.addEventListener("focusin", pause);
    toast.addEventListener("focusout", resume);
  }

  // Changes made from the RadarThing website show up in the sim, so say so.
  const COMMAND_LABELS = {
    setAltitude: (v) => `Altitude ${Number(v).toLocaleString()} ft`,
    setSpeed: (v) => `Speed ${v} kt`,
    setHeading: (v) => `Heading ${String(v).padStart(3, "0")}°`,
    setVS: (v) => `Vertical speed ${Number(v).toLocaleString()} ft/min`,
    setSquawk: (v) => `Squawk ${v}`,
    setSpeedMode: (v) =>
      `Speed in ${String(v).toLowerCase() === "mach" ? "Mach" : "knots"}`,
    setFlaps: (v) => `Flaps notch ${v}`,
    enableNav: () => "NAV mode on",
    disableNav: () => "Heading mode on",
    setWaypoint: (v) => `Direct to ${String(v).toUpperCase()}`,
    toggleAutopilot: (v) => (v ? "Autopilot on" : "Autopilot off"),
  };
  window.addEventListener("radarthing-command-executed", (e) => {
    const detail = e.detail || {};
    // disconnectFlight already gets its own end-of-flight toast.
    if (detail.type === "disconnectFlight") return;
    const describe = COMMAND_LABELS[detail.type];
    if (detail.success === false) {
      showToast(
        `Couldn't apply from the website${describe ? `: ${describe(detail.value)}` : ""}.${detail.error ? ` ${detail.error}.` : ""}`,
        true,
      );
      return;
    }
    if (describe) showToast(`${describe(detail.value)} (from the website)`);
  });

  function updateSignInNotice() {
    const notice = document.getElementById(SIGN_IN_NOTICE_ID);
    if (!notice) return;

    notice.style.display = geofs?.userRecord?.googleid ? "none" : "block";
  }

  function fillFlightForm(detail) {
    const depEl = document.getElementById(DEP_INPUT_ID);
    const arrEl = document.getElementById(ARR_INPUT_ID);
    const fltEl = document.getElementById(FLT_INPUT_ID);
    const sqkEl = document.getElementById(SQK_INPUT_ID);
    const afEl = document.getElementById(AF_INPUT_ID);

    if (depEl)
      depEl.value = String(
        detail?.departure || detail?.dep || "",
      ).toUpperCase();
    if (arrEl)
      arrEl.value = String(detail?.arrival || detail?.arr || "").toUpperCase();
    if (fltEl)
      fltEl.value = sanitizeFlightCallsign(
        detail?.flightNo || detail?.flt || "",
      );
    if (sqkEl)
      sqkEl.value = sanitizeSquawk(detail?.squawk || detail?.sqk || "");
    if (afEl) afEl.value = String(detail?.af || "").toUpperCase();
    setMilitaryMode(Boolean(afEl?.value));
  }

  function ensureResumeFlightModal() {
    let modal = document.getElementById(RESUME_MODAL_ID);
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = RESUME_MODAL_ID;
    modal.style.cssText = `
      position:fixed;
      top:18px;
      left:50%;
      width:min(560px, calc(100vw - 24px));
      display:none;
      transform:translate(-50%, -18px);
      opacity:0;
      transition:
        opacity 0.22s ease,
        transform 0.22s ease;
      z-index:${Z.dialog};
    `;
    modal.setAttribute("role", "dialog");
    modal.tabIndex = -1;
    modal.style.outline = "none";
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "radarthing-resume-title");
    modal.setAttribute("aria-describedby", "radarthing-resume-desc");

    modal.innerHTML = `
      <div style="
        position:relative;
        overflow:hidden;
        border-radius:20px;
        border:1px solid rgba(103,232,249,0.18);
        background:
          radial-gradient(circle at top right, rgba(34,211,238,0.16), transparent 36%),
          linear-gradient(180deg, rgba(15,23,42,0.97), rgba(2,6,23,0.95));
        box-shadow:0 22px 56px rgba(0,0,0,0.44);
      ">
        <div style="
          position:absolute;
          inset:0;
          pointer-events:none;
          background:
            linear-gradient(135deg, rgba(34,211,238,0.12), transparent 32%),
            linear-gradient(180deg, transparent, rgba(8,47,73,0.16));
        "></div>
        <div style="position:relative; padding:16px 16px 14px;">
          <div style="
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:12px;
            margin-bottom:12px;
          ">
            <div>
              <div style="
                display:inline-flex;
                align-items:center;
                gap:8px;
                margin-bottom:7px;
                border-radius:999px;
                border:1px solid rgba(34,211,238,0.22);
                background:rgba(8,47,73,0.42);
                padding:5px 9px;
                color:#67e8f9;
                font-size:11px;
                font-weight:700;
                letter-spacing:0.18em;
                text-transform:uppercase;
              ">
                Resume flight
              </div>
              <div id="radarthing-resume-title" style="
                margin-bottom:4px;
                color:#f8fafc;
                font-size:18px;
                font-weight:700;
                letter-spacing:-0.03em;
              ">Continue your disconnected leg</div>
              <div id="radarthing-resume-desc" style="
                color:rgba(226,232,240,0.72);
                font-size:11px;
                line-height:1.45;
              ">
                RadarThing found an interrupted session waiting for you.
              </div>
            </div>
            <button id="radarthing-resume-dismiss" type="button" aria-label="Decide later" title="Decide later" style="
              width:32px;
              height:32px;
              border-radius:999px;
              border:1px solid rgba(148,163,184,0.18);
              background:rgba(15,23,42,0.72);
              color:#94a3b8;
              font-size:16px;
              cursor:pointer;
            ">×</button>
          </div>

          <div style="
            display:grid;
            gap:10px;
            margin-bottom:14px;
          ">
            <div style="
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:10px;
              border-radius:16px;
              border:1px solid rgba(148,163,184,0.16);
              background:rgba(15,23,42,0.78);
              padding:12px 14px;
            ">
              <div>
                <div style="margin-bottom:4px; color:#94a3b8; font-size:11px; letter-spacing:0.08em; text-transform:uppercase;">Callsign</div>
                <div id="radarthing-resume-callsign" style="color:#f8fafc; font-size:15px; font-weight:700;">Unknown</div>
              </div>
              <div style="
                color:#67e8f9;
                font-size:14px;
                font-weight:700;
                letter-spacing:0.16em;
                text-transform:uppercase;
              ">
                <span id="radarthing-resume-departure">---</span>
                <span style="opacity:0.5;"> → </span>
                <span id="radarthing-resume-arrival">---</span>
              </div>
            </div>

            <div style="
              display:grid;
              grid-template-columns:1fr 1fr;
              gap:10px;
            ">
              <div style="
                border-radius:14px;
                border:1px solid rgba(148,163,184,0.16);
                background:rgba(15,23,42,0.68);
                padding:10px 12px;
              ">
                <div style="margin-bottom:4px; color:#94a3b8; font-size:11px; letter-spacing:0.08em; text-transform:uppercase;">Aircraft</div>
                <div id="radarthing-resume-aircraft" style="color:#f8fafc; font-size:13px; font-weight:700;">Unknown</div>
              </div>
              <div style="
                border-radius:14px;
                border:1px solid rgba(251,191,36,0.16);
                background:linear-gradient(180deg, rgba(120,53,15,0.18), rgba(15,23,42,0.72));
                padding:10px 12px;
              ">
                <div style="margin-bottom:4px; color:#fbbf24; font-size:11px; letter-spacing:0.16em; text-transform:uppercase;">Next waypoint</div>
                <div id="radarthing-resume-waypoint" style="color:#fef3c7; font-size:13px; font-weight:700;">Unknown</div>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:10px;">
            <button id="radarthing-resume-decline" type="button" style="
              flex:1;
              height:38px;
              border-radius:12px;
              border:1px solid rgba(248,113,113,0.24);
              background:rgba(127,29,29,0.22);
              color:#fecaca;
              font-size:11px;
              font-weight:700;
              letter-spacing:0.14em;
              text-transform:uppercase;
              cursor:pointer;
            ">Start fresh</button>
            <button id="radarthing-resume-accept" type="button" style="
              flex:1.35;
              height:38px;
              border-radius:12px;
              border:1px solid rgba(34,211,238,0.26);
              background:linear-gradient(135deg, rgba(8,145,178,0.82), rgba(14,116,144,0.92));
              color:#ecfeff;
              font-size:11px;
              font-weight:700;
              letter-spacing:0.14em;
              text-transform:uppercase;
              box-shadow:0 12px 26px rgba(8,145,178,0.24);
              cursor:pointer;
            ">Continue flight</button>
          </div>
        </div>
      </div>
    `;

    const dismissBtn = modal.querySelector("#radarthing-resume-dismiss");
    const declineBtn = modal.querySelector("#radarthing-resume-decline");
    const acceptBtn = modal.querySelector("#radarthing-resume-accept");

    // Closing with × or Esc means "not now": nothing is finalized and the
    // offer comes back on the next GeoFS reload.
    dismissBtn.onclick = () => closeResumeFlightModal("later");
    declineBtn.onclick = () => closeResumeFlightModal(false);
    acceptBtn.onclick = () => closeResumeFlightModal(true);

    document.addEventListener(
      "keydown",
      (e) => {
        if (modal.style.display === "none") return;
        if (e.key === "Escape") {
          e.stopPropagation();
          closeResumeFlightModal("later");
          return;
        }
        // Keep keyboard focus inside the dialog while it is open.
        if (e.key === "Tab") {
          const focusables = [dismissBtn, declineBtn, acceptBtn];
          const index = focusables.indexOf(document.activeElement);
          e.preventDefault();
          e.stopPropagation();
          const nextIndex = e.shiftKey
            ? (index <= 0 ? focusables.length : index) - 1
            : (index + 1) % focusables.length;
          focusables[nextIndex].focus();
        }
      },
      true,
    );

    document.body.appendChild(modal);
    return modal;
  }

  function closeResumeFlightModal(shouldResume) {
    const modal = document.getElementById(RESUME_MODAL_ID);
    const resolver = resumeModalResolver;
    resumeModalResolver = null;
    const returnFocus = resumeModalReturnFocus;
    resumeModalReturnFocus = null;
    if (returnFocus && typeof returnFocus.focus === "function")
      returnFocus.focus();

    if (!modal) {
      if (resolver) resolver(shouldResume);
      return;
    }

    modal.style.opacity = "0";
    modal.style.transform = "translate(-50%, -18px)";

    setTimeout(() => {
      modal.style.display = "none";
      if (resolver) resolver(shouldResume);
    }, 220);
  }

  function showResumeFlightModal(detail) {
    const modal = ensureResumeFlightModal();

    modal.querySelector("#radarthing-resume-departure").textContent = String(
      detail?.departure || "???",
    ).toUpperCase();
    modal.querySelector("#radarthing-resume-arrival").textContent = String(
      detail?.arrival || "???",
    ).toUpperCase();
    modal.querySelector("#radarthing-resume-callsign").textContent =
      detail?.flightNo || detail?.callsign || "Unknown";
    modal.querySelector("#radarthing-resume-aircraft").textContent =
      detail?.aircraftType || "Unknown";
    modal.querySelector("#radarthing-resume-waypoint").textContent =
      detail?.nextWaypoint || "Unknown";

    resumeModalReturnFocus = document.activeElement;
    modal.style.display = "flex";
    requestAnimationFrame(() => {
      modal.style.opacity = "1";
      modal.style.transform = "translate(-50%, 0)";
      // Focus the dialog itself rather than a button, so a stray Enter or
      // Space while flying can't accidentally resume or decline.
      modal.focus({ preventScroll: true });
    });

    return new Promise((resolve) => {
      resumeModalResolver = resolve;
    });
  }

  async function maybePromptToResumeFlight() {
    if (resumePromptResolved || !geofs?.userRecord?.googleid) return;

    const hasFilledFlightInfo = Boolean(
      document.getElementById(DEP_INPUT_ID)?.value.trim() ||
      document.getElementById(ARR_INPUT_ID)?.value.trim() ||
      document.getElementById(FLT_INPUT_ID)?.value.trim(),
    );

    try {
      const googleId = String(geofs.userRecord.googleid);
      const res = await fetch(
        `${RESUME_FLIGHT_API}?googleId=${encodeURIComponent(googleId)}`,
      );
      if (!res.ok) return;

      const data = await res.json();
      if (!data?.available || !data.session) {
        resumePromptResolved = true;
        return;
      }

      let shouldResume;
      if (hasFilledFlightInfo) {
        if (!doesSessionMatchCurrentForm(data.session)) {
          resumePromptResolved = true;
          return;
        }
        shouldResume = true;
      } else {
        shouldResume = await showResumeFlightModal(data.session);
      }

      // The pilot has decided (or deferred); never re-prompt in this session,
      // even if the request below fails.
      resumePromptResolved = true;
      if (shouldResume === "later") {
        resumeDeferredGoogleId = googleId;
        showToast("No problem. We'll ask again next time you load GeoFS.");
        return;
      }

      const actionRes = await fetch(RESUME_FLIGHT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: shouldResume ? "claim" : "decline",
          googleId,
          currentId: geofs.userRecord.googleid || geofs.userRecord.callsign,
        }),
      });

      if (!actionRes.ok) {
        showToast(
          "Couldn't reach RadarThing about your interrupted flight. We'll ask again next time you load GeoFS.",
          true,
        );
        return;
      }

      const actionData = await actionRes.json().catch(() => null);

      if (!shouldResume) {
        if (!actionData?.finalized) {
          showToast(
            "Couldn't save your interrupted flight yet. It will be saved automatically when it times out.",
            true,
          );
          return;
        }
        showToast("Your interrupted flight was saved to your history");
        resumePromptResolved = true;
        return;
      }

      const resumedSession = actionData?.session || data.session;
      fillFlightForm(resumedSession);
      window.dispatchEvent(
        new CustomEvent("atc-data-sync", {
          detail: {
            dep: resumedSession.departure || "",
            arr: resumedSession.arrival || "",
            flt: resumedSession.flightNo || "",
            sqk: resumedSession.squawk || "",
            af: resumedSession.af || "",
            takeoffTime: resumedSession.takeoffTime || "",
            resumed: true,
            active: true,
          },
        }),
      );
      showToast("Previous flight resumed");
      resumePromptResolved = true;
    } catch (_) {}
  }

  function startResumePromptPolling() {
    if (resumePromptCheckStarted) return;
    resumePromptCheckStarted = true;

    // Wait for GeoFS sign-in, then check a bounded number of times with
    // backoff instead of polling forever when the resume API is unreachable.
    let attempts = 0;
    const maxAttempts = 6;
    const tick = () => {
      if (resumePromptResolved) return;
      if (!geofs?.userRecord?.googleid) {
        setTimeout(tick, 3000);
        return;
      }
      attempts += 1;
      maybePromptToResumeFlight().finally(() => {
        if (resumePromptResolved || attempts >= maxAttempts) return;
        setTimeout(tick, Math.min(30000, 1500 * 2 ** attempts));
      });
    };
    setTimeout(tick, 1500);
  }

  function buildInputRow(label, id, placeholder, extraAttrs = "") {
    return `
      <label style="display:block; min-width:0;">
        <div style="
          margin-bottom:5px;
          font-size:12px;
          font-weight:600;
          letter-spacing:0.01em;
          color:#cbd5e1;
        ">${label}</div>
        <input id="${id}"
          placeholder="${placeholder}"
          maxlength="8"
          autocomplete="off"
          spellcheck="false"
          autocapitalize="characters"
          ${extraAttrs}
          style="
            box-sizing:border-box;
            width:100%;
            height:32px;
            border-radius:8px;
            background:rgba(255,255,255,0.04);
            border:1px solid rgba(255,255,255,0.12);
            color:#e5e7eb;
            padding:0 10px;
            font-size:13px;
          "
        />
      </label>
    `;
  }

  function setMilitaryMode(on) {
    const checkbox = document.getElementById(MILITARY_CHECKBOX_ID);
    const wrap = document.getElementById(AF_FIELD_WRAP_ID);
    const afEl = document.getElementById(AF_INPUT_ID);
    if (checkbox) checkbox.checked = on;
    if (wrap) wrap.style.display = on ? "grid" : "none";
    if (!on && afEl) afEl.value = "";
  }

  function buildToggleRow(label, id, checked, describedBy = "") {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:2px 0;">
        <span id="${id}-label" style="font-size:11px; color:#cbd5e1; letter-spacing:0.04em;">${label}</span>
        <button id="${id}" type="button" role="switch" aria-checked="${checked ? "true" : "false"}" aria-labelledby="${id}-label" ${describedBy ? `aria-describedby="${describedBy}"` : ""} style="
          flex:none;
          width:34px; height:18px;
          padding:0;
          border:0;
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
        </button>
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
    el.setAttribute("aria-checked", on ? "true" : "false");
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

  function normalizeChartRotation(value) {
    const normalized =
      (((Math.round(Number(value || 0) / 90) * 90) % 360) + 360) % 360;
    if (
      normalized === 0 ||
      normalized === 90 ||
      normalized === 180 ||
      normalized === 270
    ) {
      return normalized;
    }
    return 0;
  }

  function loadStoredChartRotations() {
    if (storedChartRotations) return storedChartRotations;

    try {
      const raw = localStorage.getItem(CHARTS_ROTATIONS_KEY);
      if (!raw) {
        storedChartRotations = {};
        return storedChartRotations;
      }

      const parsed = JSON.parse(raw);
      storedChartRotations = Object.fromEntries(
        Object.entries(parsed || {}).map(([chartUrl, rotation]) => [
          chartUrl,
          normalizeChartRotation(rotation),
        ]),
      );
    } catch (_) {
      storedChartRotations = {};
    }

    return storedChartRotations;
  }

  function persistStoredChartRotations(rotations) {
    try {
      localStorage.setItem(CHARTS_ROTATIONS_KEY, JSON.stringify(rotations));
    } catch (_) {}
  }

  function getStoredChartRotation(chartUrl) {
    if (!chartUrl) return 0;
    const rotations = loadStoredChartRotations();
    return rotations[chartUrl] || 0;
  }

  function setStoredChartRotation(chartUrl, rotation) {
    if (!chartUrl) return;

    const normalized = normalizeChartRotation(rotation);
    const rotations = loadStoredChartRotations();

    if (normalized === 0) {
      delete rotations[chartUrl];
    } else {
      rotations[chartUrl] = normalized;
    }

    persistStoredChartRotations(rotations);
  }

  function getNextStoredChartRotation(rotation) {
    return normalizeChartRotation(rotation + 90);
  }

  function syncSelectedChartRotation() {
    const selectedChart = getSelectedChart();
    chartsState.rotation = selectedChart
      ? getStoredChartRotation(selectedChart.chartUrl)
      : 0;
  }

  function getChartRotationScale(width, height, rotation) {
    if (normalizeChartRotation(rotation) % 180 === 0) return 1;
    if (!width || !height) return 1;
    return Math.min(width / height, height / width);
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

  function cacheChartsUi(panel) {
    if (!panel) return null;
    chartsUi.panel = panel;
    chartsUi.title = panel.querySelector(".gc-title");
    chartsUi.typeTabs = panel.querySelector(".gc-type-tabs");
    chartsUi.chartList = panel.querySelector(".gc-list");
    chartsUi.preview = panel.querySelector(".gc-preview");
    chartsUi.invertToggle = panel.querySelector(".gc-invert-toggle");
    chartsUi.rotateToggle = panel.querySelector(".gc-rotate-toggle");
    return chartsUi;
  }

  function requestChartsViewerHeightSync() {
    if (chartsUi.heightFrame) return;
    chartsUi.heightFrame = requestAnimationFrame(() => {
      chartsUi.heightFrame = 0;
      syncChartsViewerHeight();
    });
  }

  function resetChartsPreviewRefs() {
    chartsUi.previewWrap = null;
    chartsUi.previewImg = null;
    chartsUi.previewChartId = null;
  }

  function syncChartsViewerHeight() {
    const panel = chartsUi.panel || document.getElementById(CHARTS_PANEL_ID);
    const preview = chartsUi.preview || panel?.querySelector(".gc-preview");
    if (!panel || !preview) return;

    const img =
      chartsUi.previewImg || preview.querySelector(".gc-image-wrap img");
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) {
      preview.style.height = "0px";
      preview.style.overflow = "hidden";
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
    const renderedHeight = Math.round(
      (img.naturalHeight / img.naturalWidth) * imageWidth,
    );
    const rotationScale = getChartRotationScale(
      imageWidth,
      renderedHeight,
      chartsState.rotation,
    );
    const visualHeight =
      chartsState.rotation % 180 === 0
        ? renderedHeight
        : Math.round(imageWidth * rotationScale);
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
    const appliedHeight = Math.min(visualHeight, maxPreviewHeight);

    preview.style.height = `${appliedHeight}px`;
    preview.style.overflow = "hidden";
    panel.style.height = "auto";
    if (chartsUi.previewImg) {
      requestAnimationFrame(() => {
        if (chartsUi.previewImg) applyZoom(chartsUi.previewImg);
      });
    }
  }

  function resetChartsZoom() {
    chartsState.zoom = { scale: 1, panX: 0, panY: 0 };
  }

  function getPreviewCursor() {
    return chartsState.zoom.scale > 1 ? "grab" : "";
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
      st,
      nextLeft,
      nextTop,
      frame = 0;
    handle.style.cursor = "grab";

    const flushPosition = () => {
      frame = 0;
      panel.style.left = nextLeft + "px";
      panel.style.top = nextTop + "px";
      clampChartsPanelToViewport(panel);
    };

    // Track the pointer that started the drag so a second finger or a
    // cancelled gesture (e.g. the browser taking over) can't leave it stuck.
    let dragPointerId = null;
    handle.style.touchAction = "none";
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button") || e.target.closest("input")) return;
      if (dragging) return;
      dragging = true;
      dragPointerId = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      sl = parseInt(panel.style.left) || 0;
      st = parseInt(panel.style.top) || 0;
      nextLeft = sl;
      nextTop = st;
      handle.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== dragPointerId) return;
      nextLeft = sl + e.clientX - sx;
      nextTop = st + e.clientY - sy;
      if (!frame) frame = requestAnimationFrame(flushPosition);
    });

    const endDrag = (e) => {
      if (!dragging || e.pointerId !== dragPointerId) return;
      dragging = false;
      dragPointerId = null;
      if (frame) {
        cancelAnimationFrame(frame);
        flushPosition();
      }
      handle.style.cursor = "grab";
      clampChartsPanelToViewport(panel);
      saveChartsPos(panel);
    };
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
  }

  function makeChartsResizable(panel) {
    const handles = panel.querySelectorAll(".gc-resize-handle");
    let resizing = false,
      startX,
      startY,
      startW,
      startH,
      resizeType,
      nextWidth,
      nextMaxHeight,
      frame = 0,
      resizePointerId = null;

    const flushResize = () => {
      frame = 0;
      if (typeof nextWidth === "number") {
        panel.style.width = nextWidth + "px";
      }
      if (typeof nextMaxHeight === "number") {
        panel.style.maxHeight = nextMaxHeight + "px";
      }
      clampChartsPanelToViewport(panel);
      requestChartsViewerHeightSync();
    };

    handles.forEach((handle) => {
      handle.style.touchAction = "none";
      handle.addEventListener("pointerdown", (e) => {
        if (resizing) return;
        resizing = true;
        resizePointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startW = panel.offsetWidth;
        startH = panel.offsetHeight;
        nextWidth = startW;
        nextMaxHeight = startH;
        if (handle.classList.contains("gc-resize-right")) resizeType = "right";
        else if (handle.classList.contains("gc-resize-bottom"))
          resizeType = "bottom";
        else resizeType = "corner";
        e.preventDefault();
        e.stopPropagation();
      });
    });

    document.addEventListener("pointermove", (e) => {
      if (!resizing || e.pointerId !== resizePointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (resizeType === "right" || resizeType === "corner") {
        nextWidth = Math.max(300, startW + dx);
      }
      if (resizeType === "bottom" || resizeType === "corner") {
        nextMaxHeight = Math.max(120, startH + dy);
      }
      if (!frame) frame = requestAnimationFrame(flushResize);
    });

    const endResize = (e) => {
      if (!resizing || e.pointerId !== resizePointerId) return;
      resizing = false;
      resizePointerId = null;
      if (frame) {
        cancelAnimationFrame(frame);
        flushResize();
      }
      clampChartsPanelToViewport(panel);
      requestChartsViewerHeightSync();
      saveChartsSize(panel);
      saveChartsPos(panel);
    };
    document.addEventListener("pointerup", endResize);
    document.addEventListener("pointercancel", endResize);
  }

  function ensureChartsPreview(sel) {
    const preview = chartsUi.preview;
    if (!preview) return;

    if (!sel) {
      if (chartsUi.previewChartId !== null) {
        preview.innerHTML = `<div class="gc-empty">Select a chart from the list above.</div>`;
        resetChartsPreviewRefs();
      }
      requestChartsViewerHeightSync();
      return;
    }

    if (chartsUi.previewChartId !== sel.id || !chartsUi.previewImg) {
      resetChartsZoom();
      preview.innerHTML = `
        <div class="gc-image-wrap">
          <img
            src="${escapeHtml(sel.chartUrl)}"
            alt="${escapeHtml(sel.chartName)}"
            draggable="false"
            loading="eager"
            decoding="async"
            fetchpriority="low"
          >
        </div>
      `;
      chartsUi.previewWrap = preview.querySelector(".gc-image-wrap");
      chartsUi.previewImg = preview.querySelector("img");
      chartsUi.previewChartId = sel.id;

      if (chartsUi.previewWrap) {
        chartsUi.previewWrap.style.cursor = getPreviewCursor();
      }

      if (chartsUi.previewImg) {
        chartsUi.previewImg.addEventListener(
          "load",
          requestChartsViewerHeightSync,
        );
        chartsUi.previewImg.addEventListener(
          "error",
          requestChartsViewerHeightSync,
        );
        if (typeof chartsUi.previewImg.decode === "function") {
          chartsUi.previewImg
            .decode()
            .catch(() => {})
            .finally(() => {
              requestChartsViewerHeightSync();
            });
        } else if (chartsUi.previewImg.complete) {
          requestChartsViewerHeightSync();
        }
      }
    }

    if (chartsUi.previewImg) {
      chartsUi.previewImg.classList.toggle(
        "inverted",
        chartsState.invertColors,
      );
      applyZoom(chartsUi.previewImg);
    }
    if (chartsUi.previewWrap) {
      chartsUi.previewWrap.style.cursor = getPreviewCursor();
    }
    requestChartsViewerHeightSync();
  }

  function renderChartsContent() {
    const panel = chartsUi.panel || document.getElementById(CHARTS_PANEL_ID);
    if (!panel) return;

    cacheChartsUi(panel);
    const { title, typeTabs, chartList, preview, invertToggle, rotateToggle } =
      chartsUi;
    if (
      !title ||
      !typeTabs ||
      !chartList ||
      !preview ||
      !invertToggle ||
      !rotateToggle
    ) {
      return;
    }

    const total = getChartCount(chartsState.chartsByType);
    title.textContent = chartsState.currentIcao
      ? `${chartsState.currentIcao} charts (${total})`
      : "Airport charts";

    typeTabs.innerHTML = "";
    // Tabs only mean something once an airport is loaded.
    typeTabs.hidden = !chartsState.currentIcao;
    for (const type of CHART_TYPES) {
      const count = chartsState.chartsByType[type].length;
      const tab = document.createElement("button");
      tab.className = `gc-type-tab${chartsState.currentType === type ? " active" : ""}`;
      tab.type = "button";
      tab.setAttribute(
        "aria-pressed",
        chartsState.currentType === type ? "true" : "false",
      );
      tab.append(document.createTextNode(type));
      const countEl = document.createElement("span");
      countEl.textContent = String(count);
      tab.appendChild(countEl);
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
    syncSelectedChartRotation();
    invertToggle.classList.toggle("active", chartsState.invertColors);
    invertToggle.setAttribute("aria-pressed", String(chartsState.invertColors));
    // aria-disabled keeps it focusable, so its tooltip can say why.
    rotateToggle.setAttribute("aria-disabled", String(!sel));
    rotateToggle.classList.toggle("disabled", !sel);
    rotateToggle.title = sel
      ? `Rotate chart (${chartsState.rotation}\u00b0)`
      : "Load a chart to rotate it";
    ensureChartsPreview(sel);
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

    status.textContent = `Loading charts for ${icao}…`;
    // Busy button and placeholder rows while the charts are fetched.
    const loadBtn = document.getElementById("gc-search-btn");
    const list = chartsUi.chartList;
    if (loadBtn) {
      loadBtn.disabled = true;
      loadBtn.setAttribute("aria-busy", "true");
      loadBtn.textContent = "Loading…";
    }
    if (list) {
      list.innerHTML = Array.from(
        { length: 4 },
        () =>
          '<div aria-hidden="true" style="height:34px;margin:6px 14px;border-radius:8px;background:rgba(255,255,255,0.06);"></div>',
      ).join("");
    }
    try {
      const { byType, fromCache } = await fetchChartsForAirport(icao, opts);
      chartsState.currentIcao = icao;
      chartsState.chartsByType = byType;
      saveChartsIcao(icao);
      selectFirstNonEmptyType();
      const total = getChartCount(byType);
      if (total > 0) {
        status.textContent = fromCache
          ? `${total} ${total === 1 ? "chart" : "charts"} for ${icao} (saved on this device).`
          : `${total} ${total === 1 ? "chart" : "charts"} for ${icao}.`;
      } else {
        status.textContent = fromCache
          ? `No saved charts for ${icao}. Press Refresh to check again.`
          : `No charts found for ${icao}. Not every airport has charts yet.`;
      }
      renderChartsContent();
    } catch (err) {
      console.error("Charts fetch failed:", err);
      status.textContent = `Couldn't load charts for ${icao}. Check your connection and press Load again.`;
      renderChartsContent();
    } finally {
      if (loadBtn) {
        loadBtn.disabled = false;
        loadBtn.removeAttribute("aria-busy");
        loadBtn.textContent = "Load";
      }
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

  function toggleChartsPanel(options = {}) {
    const panel = document.getElementById(CHARTS_PANEL_ID);
    if (!panel) return;
    // The stylesheet hides the panel at first, so the inline style starts empty.
    const isOpen = panel.style.display === "flex";
    if (isOpen) {
      hideChartsPanel();
    } else {
      panel.style.display = "flex";
      const input = document.getElementById("gc-icao-input");
      const lastIcao = chartsState.currentIcao || loadChartsIcao();
      if (input) {
        input.value = lastIcao;
        if (options.focusInput) input.focus();
      }
      if (lastIcao && !chartsState.currentIcao) {
        chartsState.currentIcao = lastIcao;
        chartsSearch();
      } else {
        renderChartsContent();
      }
    }
  }

  function hideChartsPanel({ returnFocus = false } = {}) {
    const panel = document.getElementById(CHARTS_PANEL_ID);
    if (!panel) return;
    // Don't leave keyboard focus inside a hidden panel: it would keep
    // swallowing the flight keys. Only the close button hands focus back to
    // the opener; after Escape or the hotkey the pilot is flying, and a
    // focused button would turn the next Space/Enter into "open charts".
    const hadFocus = panel.contains(document.activeElement);
    panel.style.display = "none";
    if (!hadFocus) return;
    document.activeElement?.blur?.();
    const opener = document.getElementById(CHARTS_BTN_ID);
    if (returnFocus && opener && flightUI && flightUI.style.display !== "none")
      opener.focus();
  }

  // ==========================================
  // AIRPORT CHARTS — Zoom & Pan
  // ==========================================

  function applyZoom(img) {
    const { scale, panX, panY } = chartsState.zoom;
    const width = img.clientWidth || img.naturalWidth || 0;
    const height = img.clientHeight || img.naturalHeight || 0;
    const rotationScale = getChartRotationScale(
      width,
      height,
      chartsState.rotation,
    );
    img.style.transform = `translate3d(${panX}px, ${panY}px, 0) rotate(${chartsState.rotation}deg) scale(${scale * rotationScale})`;
    img.style.transformOrigin = "center center";
  }

  function setupChartZoomHandlers() {
    const panel = chartsUi.panel || document.getElementById(CHARTS_PANEL_ID);
    const preview = chartsUi.preview || panel?.querySelector(".gc-preview");
    if (!preview) return;

    let panning = false,
      sx,
      sy,
      frame = 0;

    const flushPan = () => {
      frame = 0;
      if (chartsUi.previewImg) applyZoom(chartsUi.previewImg);
    };

    preview.addEventListener(
      "wheel",
      (e) => {
        const img = chartsUi.previewImg;
        const wrap = chartsUi.previewWrap;
        if (!img || !wrap) return;
        e.preventDefault();

        const previousScale = chartsState.zoom.scale;
        const factor = e.deltaY > 0 ? 0.85 : 1.18;
        const nextScale = Math.max(1, Math.min(10, previousScale * factor));
        if (nextScale <= 1.01) {
          resetChartsZoom();
        } else {
          const rect = wrap.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const localX =
            (e.clientX - centerX - chartsState.zoom.panX) / previousScale;
          const localY =
            (e.clientY - centerY - chartsState.zoom.panY) / previousScale;
          chartsState.zoom.scale = nextScale;
          chartsState.zoom.panX = e.clientX - centerX - localX * nextScale;
          chartsState.zoom.panY = e.clientY - centerY - localY * nextScale;
        }
        applyZoom(img);
        wrap.style.cursor = getPreviewCursor();
      },
      { passive: false },
    );

    preview.addEventListener("mousedown", (e) => {
      const wrap = chartsUi.previewWrap;
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
      if (!frame) frame = requestAnimationFrame(flushPan);
    });

    document.addEventListener("mouseup", () => {
      if (!panning) return;
      panning = false;
      if (frame) {
        cancelAnimationFrame(frame);
        flushPan();
      }
      const wrap = chartsUi.previewWrap;
      if (wrap) wrap.style.cursor = getPreviewCursor();
    });

    preview.addEventListener("dblclick", (e) => {
      const wrap = chartsUi.previewWrap;
      if (!wrap || !wrap.contains(e.target)) return;
      resetChartsZoom();
      const img = wrap.querySelector("img");
      if (img) applyZoom(img);
      wrap.style.cursor = "";
    });
  }

  // ==========================================
  // ATC FLIGHT INFO — UI Injection
  // ==========================================

  function injectFlightUI() {
    const isMobile = isMobileBrowser();
    flightUI = document.createElement("div");
    flightUI.id = UI_CONTAINER_ID;
    flightUI.style.cssText = `
      position:fixed;
      top:72px;
      right:16px;
      width:min(260px, calc(100vw - 24px));
      box-sizing:border-box;
      max-height:calc(100dvh - 88px);
      overflow-y:auto;
      padding:16px;
      /* Solid, not blurred: a backdrop blur over the WebGL canvas costs GPU
         time on every simulator frame. */
      background:rgba(23,28,42,0.97);
      border:1px solid rgba(255,255,255,0.1);
      border-radius:16px;
      color:#e5e7eb;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;
      box-shadow:0 20px 40px rgba(0,0,0,0.55);
      z-index:${Z.flightPanel};
    `;
    flightUI.setAttribute("role", "region");
    flightUI.setAttribute("aria-label", "RadarThing flight tracking");

    const savedFlightUiPosition = loadFlightUiPosition();
    if (savedFlightUiPosition) {
      flightUI.style.left = `${savedFlightUiPosition.left}px`;
      flightUI.style.top = `${savedFlightUiPosition.top}px`;
      flightUI.style.right = "auto";
    }

    const headerButtonStyle = `
      min-height:28px;
      padding:5px 8px;
      border:1px solid rgba(255,255,255,0.1);
      border-radius:6px;
      background:transparent;
      color:#cbd5e1;
      font-size:12px;
      font-weight:600;
      line-height:1;
      cursor:pointer;
    `;
    const actionButtonStyle = `
      height:36px;
      border-radius:10px;
      font-size:13px;
      font-weight:700;
      white-space:nowrap;
      cursor:pointer;
    `;
    const sectionHeaderStyle = `
      display:flex;
      width:100%;
      justify-content:space-between;
      align-items:center;
      padding:0;
      border:0;
      background:none;
      cursor:pointer;
      font-size:12px;
      font-weight:700;
      letter-spacing:0.01em;
            color:#cbd5e1;
      user-select:none;
    `;
    const keybindButtonStyle = `
      padding:4px 8px;
      border-radius:6px;
      border:1px solid rgba(255,255,255,0.15);
      background:rgba(255,255,255,0.08);
      color:#e5e7eb;
      font-size:11px;
      min-width:28px;
      letter-spacing:0.12em;
      cursor:pointer;
    `;

    flightUI.innerHTML = `
      <style>
        #${UI_CONTAINER_ID} input::placeholder,
        #${UI_CONTAINER_ID} textarea::placeholder { color:#7b8798; }
        #${UI_CONTAINER_ID} input[type="text"]:focus,
        #${UI_CONTAINER_ID} input:not([type]):focus,
        #${UI_CONTAINER_ID} textarea:focus {
          border-color:rgba(125,211,252,0.7);
          outline:none;
        }
        #${SAVE_BTN_ID}:focus-visible { outline-color:#ffffff !important; }
        #${UI_CONTAINER_ID} button:focus-visible,
        #${UI_CONTAINER_ID} input:focus-visible,
        #${UI_CONTAINER_ID} textarea:focus-visible,
        #${UI_CONTAINER_ID} [role="switch"]:focus-visible {
          outline:2px solid #7dd3fc;
          outline-offset:2px;
        }
        #${UI_CONTAINER_ID} input[aria-invalid="true"] {
          border-color:rgba(248,113,113,0.8) !important;
        }
        #${UI_CONTAINER_ID} button[disabled] { opacity:0.6; cursor:progress; }
        /* Inline display styles would otherwise beat the hidden attribute. */
        #${UI_CONTAINER_ID} [hidden] { display:none !important; }
        @media (prefers-reduced-motion: reduce) {
          #${UI_CONTAINER_ID} *, #${UI_CONTAINER_ID} *::before { transition:none !important; animation:none !important; }
        }
        @keyframes atc-status-pulse { 0%,100% { opacity:1 } 50% { opacity:.35 } }
        ${(() => {
          // Touch sizing. Phones always get it; elsewhere a media query
          // applies it when the window is resized small or the pointer is
          // coarse (e.g. a touchscreen laptop in tablet mode).
          const touchCss = `#${UI_CONTAINER_ID} { font-size:13px; }
        #${UI_CONTAINER_ID} input { height:44px !important; font-size:16px !important; }
        #${UI_CONTAINER_ID} button { min-height:44px; }
        #${UI_CONTAINER_ID} [role="switch"] { min-height:0; position:relative; overflow:visible; }
        #${UI_CONTAINER_ID} [role="switch"]::after { content:""; position:absolute; inset:-11px -8px; }
        #${UI_CONTAINER_ID} label > div, #${UI_CONTAINER_ID} p, #${UI_CONTAINER_ID} [role="status"] { font-size:12px !important; }
        #atc-status-help { display:inline-flex; align-items:center; min-height:44px; }
        #${STATUS_INDICATOR_ID} [data-status-text] { white-space:normal !important; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
        #${CHARTS_PANEL_ID} .gc-close, #${CHARTS_PANEL_ID} .gc-invert-toggle, #${CHARTS_PANEL_ID} .gc-rotate-toggle, #${CHARTS_PANEL_ID} .gc-type-tab, #${CHARTS_PANEL_ID} .gc-search-btn, #${CHARTS_PANEL_ID} .gc-reset-btn { min-height:44px; }
        #${CHARTS_PANEL_ID} .gc-close { min-width:44px; }
        #radarthing-toast-stack button { min-width:44px; min-height:44px; }`;
          return isMobile
            ? touchCss
            : `@media (pointer: coarse), (max-width: 640px) { ${touchCss} }`;
        })()}
      </style>

      <div id="${FLIGHT_UI_HEADER_ID}" style="
        position:relative;
        display:flex;
        align-items:center;
        gap:8px;
        margin-bottom:14px;
      ">
        <span style="
          flex:1;
          min-width:0;
          font-size:17px;
          font-weight:800;
          letter-spacing:-0.03em;
          white-space:nowrap;
          color:#fff;
        ">Radar<span style="
          background:linear-gradient(180deg,#bae6fd,#60a5fa);
          -webkit-background-clip:text;
          background-clip:text;
          color:transparent;
        ">Thing</span></span>
        <div style="
          display:flex;
          gap:6px;
          flex-shrink:0;
        ">
          <button id="${FLIGHT_UI_MOVE_BTN_ID}" type="button" aria-pressed="false" title="Drag the panel to move it" style="${headerButtonStyle}">Move</button>
          <button id="${FLIGHT_UI_RESET_BTN_ID}" type="button" title="Put the panel back in the top-right corner" ${savedFlightUiPosition ? "" : "hidden"} style="${headerButtonStyle}">Reset</button>
          ${
            isMobile
              ? ""
              : `<button id="${FLIGHT_UI_HIDE_BTN_ID}" type="button" title="Hide panel (${escapeHtml(toggleKey.toUpperCase())})" aria-label="Hide RadarThing panel (${escapeHtml(toggleKey.toUpperCase())})" style="${headerButtonStyle}">Hide</button>`
          }
        </div>
        ${
          isMobile
            ? `<button id="${MOBILE_UI_CLOSE_ID}" type="button" aria-label="Hide RadarThing panel" title="Hide panel" style="
                width:28px;
                height:28px;
                display:grid;
                place-items:center;
                padding:0;
                border:0;
                border-radius:8px;
                background:transparent;
                color:#94a3b8;
                font-size:20px;
                font-weight:400;
                line-height:1;
                cursor:pointer;
              "><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>`
            : ""
        }
      </div>

      <div id="${STATUS_INDICATOR_ID}" role="status" aria-live="polite" data-state="idle" style="
        display:flex;
        align-items:center;
        gap:8px;
        margin:-4px 0 12px;
        padding:7px 10px;
        border:1px solid rgba(148,163,184,0.22);
        border-radius:999px;
        background:rgba(148,163,184,0.08);
        color:#cbd5e1;
        font-size:11px;
        font-weight:700;
        letter-spacing:0.06em;
      ">
        <span data-status-dot aria-hidden="true" style="flex:none;width:8px;height:8px;border-radius:50%;background:#94a3b8;"></span>
        <span data-status-text style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0.02em;">Not tracking</span>
        <span data-status-age aria-hidden="true" style="flex:none;white-space:nowrap;font-weight:500;letter-spacing:0.02em;color:#94a3b8;"></span>
        ${
          isMobile
            ? ""
            : `<span id="${HOTKEY_HINT_ID}" style="margin-left:auto;font-size:11px;font-weight:500;letter-spacing:0.02em;color:#94a3b8;text-align:right;">${escapeHtml(hotkeyHintText())}</span>`
        }
      </div>

      <div id="atc-status-actions" hidden style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin:-6px 0 12px;
      ">
        <a id="atc-status-help" hidden href="${escapeHtml(window.__radarThingSiteUrl || "https://radarthing.com")}/guides/aircraft-not-appearing#check-that-your-flight-is-live" target="_blank" rel="noopener noreferrer" style="
          color:#7dd3fc;
          font-size:12px;
          text-decoration:underline;
          text-underline-offset:3px;
        ">What does this mean?</a>
        <button id="atc-retry-now-btn" type="button" hidden style="
          margin-left:auto;
          padding:5px 10px;
          border:1px solid rgba(251,191,36,0.45);
          border-radius:10px;
          background:rgba(251,191,36,0.1);
          color:#fde68a;
          font-size:12px;
          font-weight:700;
          cursor:pointer;
        ">Retry now</button>
      </div>

      <div id="${MOST_TRACKED_BADGE_ID}" role="status" aria-live="polite" style="
        display:none;
        align-items:center;
        gap:9px;
        margin:-2px 0 12px;
        padding:8px 10px;
        border:1px solid rgba(251,191,36,0.32);
        border-radius:10px;
        background:linear-gradient(110deg,rgba(245,158,11,0.16),rgba(251,191,36,0.06));
        box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);
        color:#fde68a;
      ">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex:none;">
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="12" cy="12" r="2.6" fill="currentColor"/>
        </svg>
        <span style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">#1 Most tracked</span>
        <span data-tracker-count style="margin-left:auto;font-size:11px;color:#fbbf24;white-space:nowrap;"></span>
      </div>

      <div id="atc-flight-summary" hidden style="
        display:flex;
        align-items:center;
        gap:8px;
        margin-bottom:12px;
        padding:8px 10px;
        border:1px solid rgba(255,255,255,0.1);
        border-radius:10px;
        background:rgba(255,255,255,0.04);
      ">
        <span style="flex:1;min-width:0;display:grid;gap:2px;">
          <span data-summary-callsign style="font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
          <span data-summary-text style="font-size:11px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
        </span>
        <button id="atc-edit-flight-btn" type="button" aria-expanded="false" aria-controls="atc-flight-fields" style="
          padding:5px 8px;
          border:1px solid rgba(125,211,252,0.35);
          border-radius:6px;
          background:transparent;
          color:#7dd3fc;
          font-size:11px;
          font-weight:700;
          cursor:pointer;
          white-space:nowrap;
        ">Edit flight</button>
      </div>

      <div id="atc-flight-fields">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 8px;">
        ${buildInputRow("Departure", DEP_INPUT_ID, "e.g. EGLL", 'aria-describedby="atc-form-error"')}
        ${buildInputRow("Arrival", ARR_INPUT_ID, "e.g. KJFK", 'aria-describedby="atc-form-error"')}
        ${buildInputRow("Callsign", FLT_INPUT_ID, "e.g. BAW117", 'aria-describedby="atc-form-error"')}
        ${buildInputRow("Squawk", SQK_INPUT_ID, "Optional", 'inputmode="numeric" aria-describedby="atc-form-error"')}
      </div>

      <label style="
        display:flex;
        align-items:center;
        gap:8px;
        margin-top:12px;
        font-size:11px;
        color:#cbd5e1;
        cursor:pointer;
        user-select:none;
      ">
        <input id="${MILITARY_CHECKBOX_ID}" type="checkbox" style="
          width:14px;
          height:14px;
          margin:0;
          accent-color:#7dd3fc;
          cursor:pointer;
        " />
        Military
      </label>
      <div id="${AF_FIELD_WRAP_ID}" style="display:none; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">
        ${buildInputRow("Air force", AF_INPUT_ID, "USAF")}
      </div>
      </div>

      <div style="display:grid; grid-template-columns:1.4fr 1fr; gap:8px; margin-top:14px;">
        <button id="${SAVE_BTN_ID}" type="button" style="
          ${actionButtonStyle}
          border:1px solid #22d3ee;
          background:#22d3ee;
          color:#04121a;
        ">Start tracking</button>

        <button id="${CLEAR_BTN_ID}" type="button" style="
          ${actionButtonStyle}
          border:1px solid rgba(255,255,255,0.14);
          background:rgba(255,255,255,0.04);
          color:#e2e8f0;
        ">End flight</button>
      </div>

      <p id="atc-form-error" role="alert" style="
        display:none;
        margin:8px 0 0;
        font-size:11px;
        line-height:1.4;
        color:#fca5a5;
      "></p>

      <p id="${SIGN_IN_NOTICE_ID}" style="
        margin:8px 0 0;
        text-align:center;
        font-size:11px;
        line-height:1.45;
        color:#fcd34d;
      ">
        Sign in to GeoFS to appear on the radar. Signed-out flights are not shown.
      </p>

      <section id="${ACARS_PANEL_ID}" style="display:none; margin-top:10px; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
        <button id="${ACARS_TOGGLE_ID}" type="button" aria-expanded="false" aria-controls="${ACARS_BODY_ID}" style="${sectionHeaderStyle}">
          <span>ACARS updates</span>
          <span aria-hidden="true" data-acars-chevron style="display:inline-block;transition:transform .2s"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </button>
        <div id="${ACARS_BODY_ID}" hidden style="margin-top:10px">
        <textarea id="${ACARS_DRAFT_ID}" maxlength="500" rows="3" placeholder="Write a flight update for viewers…" aria-label="New ACARS entry" style="box-sizing:border-box;width:100%;resize:vertical;padding:8px 10px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.04);color:#e5e7eb;font:12px system-ui;outline:none"></textarea>
        <div style="margin-top:4px;color:#94a3b8;font-size:11px">Shown on your radar flight card until you remove it.</div>
        <button id="${ACARS_PUBLISH_ID}" type="button" style="width:100%;margin-top:8px;height:34px;border:1px solid rgba(125,211,252,.35);border-radius:10px;background:rgba(56,189,248,.14);color:#7dd3fc;font-size:12px;font-weight:700;cursor:pointer">Publish ACARS update</button>
        <div id="${ACARS_LIST_ID}" aria-live="polite" style="margin-top:8px;max-height:160px;overflow-y:auto;color:#cbd5e1;font-size:11px">No ACARS entries yet.</div>
        </div>
      </section>

      <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
        <button id="${RADAR_SETTINGS_HEADER_ID}" type="button" aria-expanded="false" aria-controls="${RADAR_SETTINGS_BODY_ID}" style="${sectionHeaderStyle}">
          <span>Settings &amp; shortcuts <span data-shortcut-summary style="font-weight:500;color:#94a3b8;">(${escapeHtml(toggleKey.toUpperCase())} / ${escapeHtml(chartsToggleKey.toUpperCase())})</span></span>
          <span id="${RADAR_SETTINGS_ARROW_ID}" aria-hidden="true" style="
            display:inline-block;
            transition:transform 0.2s;
          "><svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </button>
        <div id="${RADAR_SETTINGS_BODY_ID}" style="
          display:none;
          margin-top:8px;
          padding:0 2px;
        ">
          ${buildToggleRow("Also share with Seabus Radar", SEABUS_TOGGLE_ID, radarPrefs.seabus, SEABUS_HINT_ID)}
          <p id="${SEABUS_HINT_ID}" style="margin:-4px 0 2px;font-size:11px;line-height:1.4;color:#94a3b8;">Sends your position to the separate community Seabus radar too. RadarThing works without it.</p>
          <p id="atc-seabus-status" role="status" aria-live="polite" style="display:none;margin:-2px 0 2px;font-size:11px;line-height:1.4;"></p>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#cbd5e1; letter-spacing:0.04em;">
            <span id="${KEYBIND_BTN_ID}-label">Show/hide panel key</span>
            <button id="${KEYBIND_BTN_ID}" type="button" aria-labelledby="${KEYBIND_BTN_ID}-label ${KEYBIND_BTN_ID}" title="Click, then press a new key (Esc cancels)" style="${keybindButtonStyle}">${escapeHtml(toggleKey.toUpperCase())}</button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#cbd5e1; letter-spacing:0.04em;">
            <span id="${CHARTS_KEYBIND_BTN_ID}-label">Airport charts key</span>
            <button id="${CHARTS_KEYBIND_BTN_ID}" type="button" aria-labelledby="${CHARTS_KEYBIND_BTN_ID}-label ${CHARTS_KEYBIND_BTN_ID}" title="Click, then press a new key (Esc cancels)" style="${keybindButtonStyle}">${escapeHtml(chartsToggleKey.toUpperCase())}</button>
          </div>
        </div>
      </div>

      <div style="
        margin-top:10px;
        border-top:1px solid rgba(255,255,255,0.08);
        padding-top:10px;
      ">
        <button id="${CHARTS_BTN_ID}" type="button" style="
          display:flex;
          align-items:center;
          gap:8px;
          padding:0;
          border:0;
          background:none;
          color:#7dd3fc;
          font-size:12px;
          font-weight:700;
          cursor:pointer;
        ">Open airport charts
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(flightUI);
    clampFlightUiToViewport();
    makeFlightUiMovable();
    updateSignInNotice();
    updateAcarsAvailability();
    document
      .getElementById(ACARS_PUBLISH_ID)
      .addEventListener("click", () => void publishAcars());
    document
      .getElementById(ACARS_TOGGLE_ID)
      .addEventListener("click", (event) => {
        const toggle = event.currentTarget;
        const body = document.getElementById(ACARS_BODY_ID);
        const expanded = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(expanded));
        body.hidden = !expanded;
        toggle.querySelector("[data-acars-chevron]").style.transform = expanded
          ? "rotate(90deg)"
          : "";
      });

    // A small tab that brings the panel back. It exists on every device so a
    // hidden panel is never lost to people who don't know the hotkey.
    {
      mobileFlightUIOpenButton = document.createElement("button");
      mobileFlightUIOpenButton.id = MOBILE_UI_OPEN_ID;
      mobileFlightUIOpenButton.type = "button";
      mobileFlightUIOpenButton.setAttribute(
        "aria-label",
        "Show RadarThing panel",
      );
      mobileFlightUIOpenButton.title = `Show RadarThing panel (${toggleKey.toUpperCase()})`;
      mobileFlightUIOpenButton.textContent = "‹";
      mobileFlightUIOpenButton.style.cssText = `
        position:fixed;
        top:72px;
        right:12px;
        width:36px;
        height:42px;
        display:none;
        align-items:center;
        justify-content:center;
        padding:0;
        border:1px solid rgba(255,255,255,0.12);
        border-radius:12px;
        background:rgba(23,28,42,0.97);
        color:#67e8f9;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
        font-size:28px;
        line-height:1;
        box-shadow:0 12px 28px rgba(0,0,0,0.5);
        cursor:pointer;
        z-index:${Z.reopenTab};
      `;
      mobileFlightUIOpenButton.onclick = () => {
        setFlightUIVisible(true);
        document.getElementById(DEP_INPUT_ID)?.focus();
      };
      document.body.appendChild(mobileFlightUIOpenButton);

      const closeBtn =
        document.getElementById(MOBILE_UI_CLOSE_ID) ||
        document.getElementById(FLIGHT_UI_HIDE_BTN_ID);
      if (closeBtn)
        closeBtn.onclick = () => {
          setFlightUIVisible(false);
          mobileFlightUIOpenButton.focus();
        };
    }

    [DEP_INPUT_ID, ARR_INPUT_ID, FLT_INPUT_ID, SQK_INPUT_ID].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        if (id === FLT_INPUT_ID) {
          el.value = sanitizeFlightCallsign(el.value);
          return;
        }

        if (id === SQK_INPUT_ID) {
          el.value = sanitizeSquawk(el.value);
          return;
        }

        el.value = el.value.toUpperCase();
      });
      el.addEventListener("input", () => {
        el.removeAttribute("aria-invalid");
        setFormError("");
      });
    });

    function setFormError(message, fieldId) {
      const errorEl = document.getElementById("atc-form-error");
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = message ? "block" : "none";
      }
      if (fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
          field.setAttribute("aria-invalid", "true");
          field.focus();
        }
      }
    }

    document.getElementById(SQK_INPUT_ID).maxLength = 4;

    document.getElementById(KEYBIND_BTN_ID).onclick = () => {
      startKeybindCapture("flight");
    };

    document.getElementById(CHARTS_KEYBIND_BTN_ID).onclick = () => {
      startKeybindCapture("charts");
    };

    document.getElementById(RADAR_SETTINGS_HEADER_ID).onclick = (event) => {
      const body = document.getElementById(RADAR_SETTINGS_BODY_ID);
      const arrow = document.getElementById(RADAR_SETTINGS_ARROW_ID);
      const opening = body.style.display === "none";
      body.style.display = opening ? "grid" : "none";
      body.style.gap = "10px";
      arrow.style.transform = opening ? "rotate(90deg)" : "rotate(0deg)";
      event.currentTarget.setAttribute("aria-expanded", String(opening));
    };

    function setupToggle(id, key) {
      document.getElementById(id).onclick = () => {
        radarPrefs[key] = !radarPrefs[key];
        saveRadarPrefs();
        updateToggleVisual(id, radarPrefs[key]);
      };
    }

    setupToggle(SEABUS_TOGGLE_ID, "seabus");

    document
      .getElementById(MILITARY_CHECKBOX_ID)
      .addEventListener("change", (event) => {
        setMilitaryMode(event.currentTarget.checked);
        if (event.currentTarget.checked)
          document.getElementById(AF_INPUT_ID).focus();
      });

    document.getElementById("atc-edit-flight-btn").onclick = () => {
      if (editingFlight && lastTrackedFlight) {
        // Cancel puts back the values that are being tracked.
        fillFlightForm(lastTrackedFlight);
        setFormError("");
      }
      setFlightEditing(!editingFlight);
    };

    document.getElementById("atc-retry-now-btn").onclick = (event) => {
      // Show that something is happening until the next status arrives.
      event.currentTarget.textContent = "Retrying…";
      event.currentTarget.disabled = true;
      window.dispatchEvent(new CustomEvent("radarthing-retry-now"));
    };

    let sameAirportConfirmedFor = "";
    document.getElementById(SAVE_BTN_ID).onclick = async () => {
      const dep = document.getElementById(DEP_INPUT_ID).value.trim();
      const arr = document.getElementById(ARR_INPUT_ID).value.trim();
      const flt = sanitizeFlightCallsign(
        document.getElementById(FLT_INPUT_ID).value,
      );
      const sqk = sanitizeSquawk(document.getElementById(SQK_INPUT_ID).value);
      const af = document
        .getElementById(AF_INPUT_ID)
        .value.trim()
        .toUpperCase();

      document.getElementById(FLT_INPUT_ID).value = flt;
      document.getElementById(SQK_INPUT_ID).value = sqk;
      document.getElementById(AF_INPUT_ID).value = af;

      const saveBtn = document.getElementById(SAVE_BTN_ID);
      if (saveBtn.disabled) return;

      if (!dep) return setFormError("Enter a departure airport.", DEP_INPUT_ID);
      if (!isAirportCode(dep))
        return setFormError(
          dep.length === 3
            ? `Use the 4-letter ICAO code for departure, like EGLL (not ${dep}).`
            : "Use the 4-letter ICAO code for departure, like EGLL.",
          DEP_INPUT_ID,
        );
      if (!arr) return setFormError("Enter an arrival airport.", ARR_INPUT_ID);
      if (!isAirportCode(arr))
        return setFormError(
          arr.length === 3
            ? `Use the 4-letter ICAO code for arrival, like KJFK (not ${arr}).`
            : "Use the 4-letter ICAO code for arrival, like KJFK.",
          ARR_INPUT_ID,
        );
      // Same airport twice is usually a typo, but circuits are real: warn
      // once, and a second press with the same airports goes ahead.
      const routeKey = `${dep}>${arr}`;
      if (arr === dep && sameAirportConfirmedFor !== routeKey) {
        sameAirportConfirmedFor = routeKey;
        return setFormError(
          "Arrival is the same as departure. Flying a circuit? Press the button again to confirm.",
          ARR_INPUT_ID,
        );
      }
      if (!flt) return setFormError("Enter a callsign.", FLT_INPUT_ID);
      if (sqk && !validateSquawk(sqk))
        return setFormError("Squawk must be 4 digits, each 0–7.", SQK_INPUT_ID);
      setFormError("");

      // The button stays busy until tracking has actually started, so a
      // second click can't submit twice while the checks run.
      saveBtn.disabled = true;
      saveBtn.setAttribute("aria-busy", "true");
      saveBtn.textContent = "Checking…";
      const wasTracking = isTracking;
      let closedDeferredLeg = false;
      try {
        const myId = geofs?.userRecord?.googleid || geofs?.userRecord?.callsign;
        const available = await checkFlightNoAvailable(flt, myId);
        if (!available) {
          setFormError(
            `${flt} is already in use by another pilot. Pick a different callsign.`,
            FLT_INPUT_ID,
          );
          return;
        }
        if (!wasTracking && resumeDeferredGoogleId) {
          saveBtn.textContent = "Starting…";
          await closeDeferredResumeSession();
          closedDeferredLeg = true;
        }
        window.dispatchEvent(
          new CustomEvent("atc-data-sync", {
            detail: { dep, arr, flt, sqk, af, active: true },
          }),
        );
      } finally {
        saveBtn.disabled = false;
        saveBtn.removeAttribute("aria-busy");
        saveBtn.textContent = isTracking ? "Update flight" : "Start tracking";
      }
      if (!isTracking) return;
      if (editingFlight) setFlightEditing(false);
      else applyCompactMode();
      showToast(
        wasTracking
          ? `Flight updated · ${flt} ${dep} → ${arr}`
          : closedDeferredLeg
            ? `Tracking ${flt} · ${dep} → ${arr}. Your interrupted flight was saved.`
            : `Tracking ${flt} · ${dep} → ${arr}`,
      );
    };

    // Ending a flight is a two-step action so a stray click mid-flight
    // doesn't finalize it. The form keeps its values so the pilot can start
    // again quickly; the toast comes from the server's real response.
    let endConfirmTimer = 0;
    const endBtn = document.getElementById(CLEAR_BTN_ID);
    const resetEndButton = () => {
      clearTimeout(endConfirmTimer);
      endBtn.dataset.confirming = "";
      endBtn.textContent = "End flight";
      endBtn.style.borderColor = "rgba(255,255,255,0.14)";
      endBtn.style.color = "#e2e8f0";
    };
    endBtn.onclick = () => {
      if (!isTracking) {
        setFormError("You're not tracking a flight yet.");
        return;
      }
      if (endBtn.dataset.confirming !== "1") {
        endBtn.dataset.confirming = "1";
        endBtn.textContent = isMobileBrowser()
          ? "Tap again to end"
          : "Click again to end";
        endBtn.style.borderColor = "rgba(248,113,113,0.6)";
        endBtn.style.color = "#fca5a5";
        endConfirmTimer = setTimeout(resetEndButton, 4000);
        return;
      }
      resetEndButton();
      setFormError("");
      window.dispatchEvent(
        new CustomEvent("atc-data-sync", { detail: { active: false } }),
      );
      // End is now disabled; keep keyboard focus somewhere useful.
      document.getElementById(SAVE_BTN_ID)?.focus();
      showToast("Ending flight…");
    };
    endBtn.addEventListener("blur", () => {
      if (endBtn.dataset.confirming === "1") resetEndButton();
    });

    window.addEventListener("radarthing-flight-end-result", (event) => {
      const detail = event.detail || {};
      // The result says whether the website ended this flight, so the
      // prefix always belongs to the right end request.
      const prefix = detail.remote ? "Ended from the RadarThing website. " : "";
      if (!detail.message) return;
      showToast(
        prefix + detail.message,
        detail.ok === false,
        detail.ok === false
          ? {
              label: "Retry",
              onClick: () =>
                window.dispatchEvent(
                  new CustomEvent("radarthing-retry-end-flight"),
                ),
            }
          : null,
      );
    });

    document.getElementById(CHARTS_BTN_ID).onclick = () =>
      toggleChartsPanel({ focusInput: true });
  }

  // ==========================================
  // AIRPORT CHARTS — UI Injection
  // ==========================================

  function injectChartsCSS() {
    // Both panels use the system font stack: nothing extra to download
    // inside GeoFS, and the charts panel matches the flight panel.

    const style = document.createElement("style");
    style.textContent = `
      @keyframes gc-slide-in {
        from { opacity: 0; transform: translateX(12px); }
        to { opacity: 1; transform: translateX(0); }
      }

      #${CHARTS_PANEL_ID} {
        position: fixed;
        z-index: ${Z.chartsPanel};
        display: none;
        flex-direction: column;
        width: ${CHARTS_DEFAULT_WIDTH}px;
        height: auto;
        max-height: calc(100vh - 16px);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #ffffff;
        background: rgba(23, 28, 42, 0.97);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        box-shadow:
          0 20px 40px rgba(0, 0, 0, 0.45),
          0 0 1px rgba(0, 0, 0, 0.4),
          0 0 20px rgba(0, 255, 255, 0.04);
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
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 15px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: -0.01em;
      }

      .gc-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .gc-invert-toggle,
      .gc-rotate-toggle {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: transparent;
        color: rgba(255, 255, 255, 0.65);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .gc-invert-toggle:hover,
      .gc-rotate-toggle:hover {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.7);
      }

      .gc-invert-toggle.active {
        background: rgba(34, 211, 238, 0.1);
        border-color: rgba(34, 211, 238, 0.25);
        color: #22d3ee;
      }

      /* Disabled, but still readable (about 4.5:1). */
      .gc-rotate-toggle.disabled {
        color: rgba(255, 255, 255, 0.55);
        border-style: dashed;
        cursor: not-allowed;
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
        color: rgba(255, 255, 255, 0.65);
        font-size: 18px;
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
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 14px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: 0 12px;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .gc-search input::placeholder {
        color: rgba(255, 255, 255, 0.65);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-weight: 400;
        letter-spacing: 0;
        text-transform: none;
      }

      .gc-search input:focus {
        border-color: rgba(34, 211, 238, 0.5);
        box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.08);
      }

      .gc-search-btn {
        min-width: 64px;
        padding: 0 12px;
        height: 36px;
        border-radius: 7px;
        border: none;
        background: #22d3ee;
        color: #010b10;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
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
        min-width: 64px;
        padding: 0 12px;
        height: 36px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.85);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
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
        font-size: 12px;
        color: rgba(255, 255, 255, 0.65);
        flex-shrink: 0;
      }

      #${CHARTS_PANEL_ID} [hidden] { display: none !important; }

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
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.03em;
        color: rgba(255, 255, 255, 0.65);
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
        font-size: 11px;
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
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
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
        color: rgba(255, 255, 255, 0.65);
        font-size: 12px;
        padding: 12px 10px;
      }

      .gc-preview {
        flex: none;
        height: 0;
        overflow: hidden;
        padding: 10px 14px 14px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .gc-image-wrap {
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .gc-image-wrap img {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        display: block;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: #000000;
        transition: transform 0.08s ease-out;
        user-select: none;
        will-change: transform;
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
    // Non-modal: the pilot keeps flying while charts are open.
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "gc-title");
    panel.innerHTML = `
      <div class="gc-header">
        <h3 class="gc-title" id="gc-title">Airport charts</h3>
        <div class="gc-header-actions">
          <button type="button" class="gc-invert-toggle" aria-pressed="false" title="Invert chart colours">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z"/></svg>
            Invert
          </button>
          <button type="button" class="gc-rotate-toggle" title="Rotate chart 90°">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15A9 9 0 1 1 23 10"/></svg>
            Rotate
          </button>
          <button type="button" class="gc-close" title="Close charts" aria-label="Close airport charts"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
        </div>
      </div>
      <div class="gc-search">
        <input id="gc-icao-input" type="text" placeholder="e.g. KSFO" maxlength="4" spellcheck="false" aria-label="Airport ICAO code" autocomplete="off" />
        <button id="gc-search-btn" type="button" class="gc-search-btn">Load</button>
        <button id="gc-reset-btn" type="button" class="gc-reset-btn" title="Clear saved charts and download them again">Refresh</button>
      </div>
      <div id="gc-search-status" class="gc-status" role="status" aria-live="polite"></div>
      <div class="gc-type-tabs"></div>
      <div class="gc-list"></div>
      <div class="gc-preview"></div>
      <div class="gc-resize-handle gc-resize-right"></div>
      <div class="gc-resize-handle gc-resize-bottom"></div>
      <div class="gc-resize-handle gc-resize-corner"></div>
    `;
    document.body.appendChild(panel);
    cacheChartsUi(panel);

    // Restore position (default: left side)
    const pos = loadChartsPos();
    panel.style.top = (pos ? pos.top : CHARTS_DEFAULT_TOP) + "px";
    panel.style.left = (pos ? pos.left : CHARTS_DEFAULT_LEFT) + "px";

    // Stop clicks from reaching GeoFS
    panel.addEventListener("click", (e) => e.stopPropagation());
    // Escape on any control in the panel closes it.
    panel.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      hideChartsPanel();
    });

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
    }

    document.getElementById("gc-search-btn").onclick = chartsSearch;
    document.getElementById("gc-reset-btn").onclick = resetChartsAndRefetch;
    panel.querySelector(".gc-close").onclick = () =>
      hideChartsPanel({ returnFocus: true });
    panel.querySelector(".gc-invert-toggle").onclick = () => {
      chartsState.invertColors = !chartsState.invertColors;
      renderChartsContent();
    };
    panel.querySelector(".gc-rotate-toggle").onclick = () => {
      const selectedChart = getSelectedChart();
      if (!selectedChart) return;

      const nextRotation = getNextStoredChartRotation(chartsState.rotation);
      chartsState.rotation = nextRotation;
      setStoredChartRotation(selectedChart.chartUrl, nextRotation);
      renderChartsContent();
    };

    window.addEventListener("resize", () => {
      clampChartsPanelToViewport(panel);
      requestChartsViewerHeightSync();
      saveChartsPos(panel);
      saveChartsSize(panel);
    });
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  function keybindButtonFor(mode) {
    return document.getElementById(
      mode === "charts" ? CHARTS_KEYBIND_BTN_ID : KEYBIND_BTN_ID,
    );
  }

  let keybindCaptureTimer = 0;

  function startKeybindCapture(mode) {
    if (keybindMode) finishKeybindCapture(null);
    keybindMode = mode;
    const btn = keybindButtonFor(mode);
    if (btn) {
      btn.textContent = "Press a key…";
      btn.setAttribute("aria-pressed", "true");
      // Leaving the button (clicking into the sim, tabbing away) cancels, so
      // a later keystroke while flying never silently becomes the hotkey.
      btn.addEventListener("blur", () => finishKeybindCapture(null), {
        once: true,
      });
    }
    clearTimeout(keybindCaptureTimer);
    keybindCaptureTimer = setTimeout(() => finishKeybindCapture(null), 8000);
  }

  function finishKeybindCapture(newKey) {
    const mode = keybindMode;
    keybindMode = null;
    clearTimeout(keybindCaptureTimer);
    if (!mode) return;
    if (newKey) {
      if (mode === "charts") {
        chartsToggleKey = newKey;
        localStorage.setItem(CHARTS_TOGGLE_KEY, chartsToggleKey);
      } else {
        toggleKey = newKey;
        localStorage.setItem(STORAGE_KEY, toggleKey);
      }
      showToast(
        `${mode === "charts" ? "Charts" : "Show/hide"} key set to ${newKey.toUpperCase()}`,
      );
    }
    const btn = keybindButtonFor(mode);
    if (btn) {
      btn.textContent = (
        mode === "charts" ? chartsToggleKey : toggleKey
      ).toUpperCase();
      btn.removeAttribute("aria-pressed");
    }
    refreshHotkeyHints();
  }

  // Capture-phase so the key used for rebinding never reaches GeoFS controls.
  document.addEventListener(
    "keydown",
    (e) => {
      if (!keybindMode) return;
      // Let Tab move focus normally (which also cancels via blur).
      if (e.key === "Tab") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        finishKeybindCapture(null);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      // Only single printable characters make sensible toggle keys.
      if (key.length !== 1 || key === " ") return;
      const other = keybindMode === "charts" ? toggleKey : chartsToggleKey;
      if (key === other) {
        showToast(
          `${key.toUpperCase()} is already used by the other shortcut`,
          true,
        );
        return;
      }
      finishKeybindCapture(key);
    },
    true,
  );

  window.addEventListener("keydown", (e) => {
    if (keybindMode) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Holding the key down must not flicker the panel open and shut.
    if (e.repeat) return;
    const target = e.target;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    )
      return;
    const key = typeof e.key === "string" ? e.key.toLowerCase() : "";

    if (key === toggleKey) {
      setFlightUIVisible(flightUI.style.display === "none");
      return;
    }

    if (key === chartsToggleKey) {
      // Opened from the keyboard the pilot is flying, so the search box is
      // not focused: that would capture the flight keys.
      toggleChartsPanel({ focusInput: false });
    }
  });

  // Commands from the Tampermonkey menu (see the installer).
  document.addEventListener("radarthing-menu-toggle-panel", () =>
    setFlightUIVisible(flightUI.style.display === "none"),
  );
  document.addEventListener("radarthing-menu-open-charts", () => {
    const panel = document.getElementById(CHARTS_PANEL_ID);
    if (panel && panel.style.display !== "flex")
      toggleChartsPanel({ focusInput: true });
  });
  document.addEventListener("radarthing-menu-reset-position", () => {
    setFlightUIVisible(true);
    document.getElementById(FLIGHT_UI_RESET_BTN_ID)?.click();
  });

  // Typing in any RadarThing field must never fly the aircraft, so stop every
  // key event from text fields inside our panels from reaching GeoFS.
  function isRadarThingTextField(target) {
    if (!target || !target.closest) return false;
    const tag = target.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return false;
    return Boolean(
      target.closest(
        `#${UI_CONTAINER_ID}, #${CHARTS_PANEL_ID}, #${RESUME_MODAL_ID}`,
      ),
    );
  }

  ["keydown", "keyup", "keypress"].forEach((type) => {
    document.addEventListener(
      type,
      (e) => {
        if (!isRadarThingTextField(e.target)) return;
        e.stopPropagation();
        // Escape hands the keyboard back to GeoFS (and closes charts).
        if (type === "keydown" && e.key === "Escape") {
          e.preventDefault();
          if (e.target.closest(`#${CHARTS_PANEL_ID}`)) hideChartsPanel();
          else e.target.blur();
          return;
        }
        // Enter in a flight-form field submits it like a normal web form.
        // (Handled here because propagation stops before the field itself.)
        if (
          type === "keydown" &&
          e.key === "Enter" &&
          e.target.tagName === "INPUT" &&
          e.target.type !== "checkbox" &&
          e.target.closest(`#${UI_CONTAINER_ID}`)
        ) {
          e.preventDefault();
          document.getElementById(SAVE_BTN_ID)?.click();
        } else if (
          type === "keydown" &&
          e.key === "Enter" &&
          e.target.id === "gc-icao-input"
        ) {
          e.preventDefault();
          chartsSearch();
        }
      },
      true,
    );
  });

  window.addEventListener("atc-status-update", (e) => {
    const statusEl = document.getElementById(STATUS_INDICATOR_ID);
    if (!statusEl || !e.detail) return;
    // Only the main tracker owns this indicator.
    if (e.detail.source && e.detail.source !== "radarthing") return;
    const color = e.detail.color || "#94a3b8";
    const text = statusEl.querySelector("[data-status-text]");
    const dot = statusEl.querySelector("[data-status-dot]");
    if (text && text.textContent !== (e.detail.text || "")) {
      text.textContent = e.detail.text || "";
      // The pill can cut long statuses short; hovering shows all of it.
      statusEl.title = e.detail.text || "";
    }
    if (dot) {
      dot.style.background = color;
      dot.style.animation =
        e.detail.state === "connecting" ||
        e.detail.state === "retrying" ||
        e.detail.state === "busy" ||
        e.detail.state === "waiting"
          ? "atc-status-pulse 1.2s ease-in-out infinite"
          : "none";
    }
    statusEl.dataset.state = e.detail.state || "";
    statusEl.style.color = color;
    statusEl.style.borderColor = `${color}55`;
    statusEl.style.background = `${color}14`;
    lastStatusSuccessAt =
      e.detail.state === "live" ? e.detail.lastSuccessAt || 0 : 0;
    updateStatusAge();
    // Retry now helps when the connection dropped, not when the server asked
    // us to slow down (busy).
    const retryBtn = document.getElementById("atc-retry-now-btn");
    if (retryBtn) {
      // Retrying can't help while the browser itself has no network.
      const showRetry =
        e.detail.state === "retrying" ||
        (e.detail.state === "offline" && navigator.onLine !== false);
      retryBtn.textContent = "Retry now";
      retryBtn.disabled = false;
      if (!showRetry && document.activeElement === retryBtn)
        (
          document.getElementById("atc-edit-flight-btn") ||
          document.getElementById(SAVE_BTN_ID)
        )?.focus();
      retryBtn.hidden = !showRetry;
    }
    // Any problem state links to the guide that explains it.
    const help = document.getElementById("atc-status-help");
    if (help)
      help.hidden = ![
        "retrying",
        "offline",
        "rejected",
        "busy",
        "waiting",
      ].includes(e.detail.state);
    const actions = document.getElementById("atc-status-actions");
    if (actions)
      actions.hidden = Boolean(
        (!help || help.hidden) && (!retryBtn || retryBtn.hidden),
      );
  });

  // Each successful send only moves the "Ns ago" clock.
  window.addEventListener("radarthing-last-success", (e) => {
    if (typeof e.detail?.at !== "number") return;
    lastStatusSuccessAt = e.detail.at;
    updateStatusAge();
  });

  // "Live · 4s ago" tells the pilot updates are really flowing. The age sits
  // outside the announced text so screen readers aren't told every tick.
  let lastStatusSuccessAt = 0;
  function updateStatusAge() {
    const age = document.querySelector(
      `#${STATUS_INDICATOR_ID} [data-status-age]`,
    );
    if (!age) return;
    if (!lastStatusSuccessAt) {
      if (age.textContent) age.textContent = "";
      return;
    }
    const seconds = Math.max(
      0,
      Math.round((Date.now() - lastStatusSuccessAt) / 1000),
    );
    const next = seconds < 2 ? "· just now" : `· ${seconds}s ago`;
    if (age.textContent !== next) age.textContent = next;
  }
  setInterval(updateStatusAge, 1000);

  window.addEventListener("seabus-status-update", (e) => {
    const el = document.getElementById("atc-seabus-status");
    if (!el || !e.detail) return;
    if (!e.detail.enabled) {
      el.style.display = "none";
      return;
    }
    el.textContent = `Seabus: ${e.detail.text}`;
    el.style.color = e.detail.color || "#94a3b8";
    el.style.display = "block";
  });

  window.addEventListener("atc-squawk-update", (e) => {
    const sqkEl = document.getElementById(SQK_INPUT_ID);
    if (sqkEl && e.detail.squawk) {
      sqkEl.value = sanitizeSquawk(e.detail.squawk);
      // Keep the one-line summary in step with the new squawk.
      applyCompactMode();
    }
  });

  window.addEventListener("atc-data-sync", (e) => {
    const detail = e.detail || {};
    setTrackingUi(detail.active === true);
    // A new flight makes any "Retry ending" offer for the old one stale.
    if (detail.active === true)
      document
        .querySelectorAll("#radarthing-toasts-alert [data-has-action]")
        .forEach((toast) => toast.remove());
    if (detail.active === false) {
      const googleId = acarsSessionGoogleId;
      const endedSessionId = acarsSessionId;
      flightActiveForTrackingBadge = false;
      acarsSessionId = "";
      acarsSessionGoogleId = "";
      acarsFlightSignature = "";
      acarsRetryAfter = 0;
      if (googleId) localStorage.removeItem(acarsSessionKey(googleId));
      if (googleId && endedSessionId)
        void queueAcarsFlight(googleId, endedSessionId, false).catch(() => {});
      trackingStatusRequestId += 1;
      hideMostTrackedBadge();
      acarsRequestId += 1;
      const list = document.getElementById(ACARS_LIST_ID);
      if (list) list.replaceChildren();
      updateAcarsAvailability();
      return;
    }
    // The pilot's own save already matches the form; only refill it when the
    // values came from elsewhere, so unsaved edits are never overwritten.
    // While the pilot is editing, a remote squawk change only updates the
    // squawk field (via atc-squawk-update) and leaves their other edits.
    if (detail.resumed || (detail.remote && !editingFlight)) {
      fillFlightForm(detail);
      applyCompactMode();
    }
    if (detail.active === true) {
      lastTrackedFlight = detail;
      const signature = `${String(detail.dep || detail.departure || "")
        .trim()
        .toUpperCase()}|${String(detail.flt || detail.flightNo || "")
        .trim()
        .toUpperCase()}`;
      if (
        Date.now() >= acarsRetryAfter &&
        (!flightActiveForTrackingBadge ||
          !acarsSessionId ||
          acarsSessionGoogleId !== acarsPilotId() ||
          (acarsFlightSignature && signature !== acarsFlightSignature))
      ) {
        const googleId = acarsPilotId();
        if (googleId) startAcarsFlight(googleId, detail.resumed);
      }
      acarsFlightSignature = signature;
      flightActiveForTrackingBadge = true;
      void refreshMostTrackedBadge();
      updateAcarsAvailability();
      void refreshAcars();
    }
  });

  // ==========================================
  // INIT
  // ==========================================

  function showWelcomeCardOnce() {
    try {
      if (localStorage.getItem(WELCOME_SEEN_KEY)) return;
    } catch (_) {
      return;
    }
    if (!flightUI || document.getElementById(WELCOME_CARD_ID)) return;
    const card = document.createElement("section");
    card.id = WELCOME_CARD_ID;
    card.setAttribute("aria-labelledby", `${WELCOME_CARD_ID}-title`);
    card.style.cssText = `
      margin:0 0 12px;
      padding:12px;
      border:1px solid rgba(125,211,252,0.3);
      border-radius:12px;
      background:rgba(56,189,248,0.08);
      color:#e2e8f0;
      font-size:12px;
      line-height:1.5;
    `;
    card.innerHTML = `
      <h2 id="${WELCOME_CARD_ID}-title" style="margin:0 0 6px;font-size:13px;font-weight:800;color:#fff;">Welcome to RadarThing</h2>
      <ol style="margin:0 0 8px;padding-left:18px;">
        <li>Enter your departure, arrival and callsign.</li>
        <li>Press <strong>Start tracking</strong>. Your position, speed, altitude and flight plan are shared on radarthing.com.</li>
        <li>Press <strong>End flight</strong> when you land to save it to your history.</li>
      </ol>
      ${
        isMobileBrowser()
          ? `<p style="margin:0 0 10px;color:#94a3b8;font-size:12px;">Use the arrow tab on the right to show this panel again after closing it.</p>`
          : `<p style="margin:0 0 10px;color:#94a3b8;font-size:11px;">Press <strong>${escapeHtml(toggleKey.toUpperCase())}</strong> to show or hide this panel and <strong>${escapeHtml(chartsToggleKey.toUpperCase())}</strong> for airport charts.</p>`
      }
      <button type="button" data-welcome-dismiss style="width:100%;height:32px;border:1px solid rgba(125,211,252,0.35);border-radius:10px;background:rgba(56,189,248,0.14);color:#7dd3fc;font-size:12px;font-weight:700;cursor:pointer;">Got it</button>
    `;
    card.querySelector("[data-welcome-dismiss]").onclick = () => {
      try {
        localStorage.setItem(WELCOME_SEEN_KEY, "1");
      } catch (_) {}
      card.remove();
      document.getElementById(DEP_INPUT_ID)?.focus();
    };
    const statusEl = document.getElementById(STATUS_INDICATOR_ID);
    if (statusEl) statusEl.after(card);
    else flightUI.prepend(card);
  }

  // If the loader showed "couldn't load" (e.g. a slow network finished after
  // its timeout), the runtime did start after all, so drop that message.
  document.getElementById("radarthing-load-failed")?.remove();

  // Live regions must exist before their first message to be announced.
  getToastRegion(false);
  getToastRegion(true);
  injectFlightUI();
  showWelcomeCardOnce();
  window.dispatchEvent(new CustomEvent("radarthing-request-status"));
  const versionLabel = window.__radarThingVersion
    ? ` v${window.__radarThingVersion}`
    : "";
  showToast(
    isMobileBrowser()
      ? `RadarThing${versionLabel} ready`
      : `RadarThing${versionLabel} ready · ${toggleKey.toUpperCase()} to show/hide`,
  );
  setTrackingUi(false);
  setInterval(refreshMostTrackedBadge, TRACKING_STATUS_POLL_INTERVAL_MS);
  injectChartsCSS();
  createChartsPanel();
  setupChartZoomHandlers();
  startResumePromptPolling();
  setInterval(syncFlightPlan, 3000);
  setInterval(() => {
    updateSignInNotice();
    const googleId = acarsPilotId();
    if (
      flightActiveForTrackingBadge &&
      Date.now() >= acarsRetryAfter &&
      googleId &&
      acarsSessionGoogleId !== googleId
    ) {
      startAcarsFlight(googleId);
      updateAcarsAvailability();
      void refreshAcars();
    }
  }, 1000);
})();
