// @ts-nocheck
(function () {
  "use strict";

  const API_BASE = "https://sse.radarthing.com";
  const AIRBORNE_SEND_INTERVAL_MS = 3000;
  const GROUND_SEND_INTERVAL_MS = 1000;
  const POSITION_REQUEST_TIMEOUT_MS = 10000;

  let info = { active: false, dep: "", arr: "", flt: "", sqk: "", af: "" };
  let wasOnGround = true;
  let takeoffTimeUTC = "";
  let lastPositionSendAt = 0;
  let positionUpdateInFlight = false;
  let positionRequestSequence = 0;

  function sanitizeCallsign(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/\s+/g, "");
  }

  function sanitizeSquawk(value) {
    return String(value || "")
      .replace(/\D+/g, "")
      .slice(0, 4);
  }

  function getUserIdentifier(geofs = window.geofs) {
    return (
      geofs?.userRecord?.googleid ||
      sanitizeCallsign(geofs?.userRecord?.callsign)
    );
  }

  function getErrorDiagnostics(error) {
    return {
      name: error?.name || null,
      message: error?.message || String(error),
      stack: error?.stack || null,
      cause: error?.cause || null,
      online: navigator.onLine,
      visibilityState: document.visibilityState,
      pageHidden: document.hidden,
      origin: window.location.origin,
      href: window.location.href,
    };
  }

  function getPositionPayloadDiagnostics(payload) {
    return {
      id: payload.id || null,
      googleId: payload.googleId || null,
      callsign: payload.callsign || null,
      flightNo: payload.flightNo || null,
      departure: payload.departure || null,
      arrival: payload.arrival || null,
      lat: payload.lat,
      lon: payload.lon,
      altMSL: payload.altMSL,
      speed: payload.speed,
      groundSpeed: payload.groundSpeed,
      ts: new Date().toISOString(),
    };
  }

  // Command execution handlers
  function executeCommand(cmd) {
    const geofs = window.geofs;
    if (!geofs?.autopilot || !geofs?.aircraft?.instance) {
      console.warn("[RadarThing] Cannot execute command - GeoFS not ready");
      window.dispatchEvent(
        new CustomEvent("radarthing-command-executed", {
          detail: {
            type: cmd.type,
            value: cmd.value,
            success: false,
            error: "GeoFS is still loading your aircraft",
          },
        }),
      );
      return;
    }

    console.log("[RadarThing] Executing command:", cmd.type, cmd.value);

    // Only report success when GeoFS actually changed something, so the
    // pilot never sees "Flaps set" for a command that did nothing.
    let applied = false;
    // Why a command couldn't be applied, shown to the pilot.
    let reason = "GeoFS couldn't apply this change";
    try {
      switch (cmd.type) {
        case "setSpeed":
          if (typeof geofs.autopilot.setSpeed === "function") {
            geofs.autopilot.setSpeed(Number(cmd.value));
            applied = true;
          }
          break;

        case "setSpeedMode": {
          const speedMode =
            String(cmd.value || "").toLowerCase() === "mach" ? "mach" : "knots";
          if (typeof geofs.autopilot.setSpeedMode === "function") {
            geofs.autopilot.setSpeedMode(speedMode);
            applied = true;
          }
          break;
        }

        case "setAltitude":
          if (typeof geofs.autopilot.setAltitude === "function") {
            geofs.autopilot.setAltitude(Number(cmd.value));
            applied = true;
          }
          break;

        case "setHeading":
          // Only counts as applied once the course itself is set.
          if (typeof geofs.autopilot.setMode === "function") {
            geofs.autopilot.setMode("HDG");
          }
          if (typeof geofs.autopilot.setCourse === "function") {
            geofs.autopilot.setCourse(Number(cmd.value));
            applied = true;
          }
          break;

        case "setVS":
          if (typeof geofs.autopilot.setVerticalSpeed === "function") {
            geofs.autopilot.setVerticalSpeed(Number(cmd.value));
            applied = true;
          }
          break;

        case "setSquawk":
          // Update the squawk in flight info
          if (info) {
            // Transponder codes are four octal digits; refuse anything else
            // so a bad command can't put a nonsense squawk on the radar.
            if (!/^[0-7]{4}$/.test(String(cmd.value ?? "").trim())) {
              throw new Error(`Invalid squawk ${String(cmd.value ?? "")}`);
            }
            info.sqk = sanitizeSquawk(cmd.value);
            applied = true;
            window.dispatchEvent(
              new CustomEvent("atc-data-sync", {
                detail: { ...info, remote: true },
              }),
            );
            // Also update the squawk input field in the UI
            window.dispatchEvent(
              new CustomEvent("atc-squawk-update", {
                detail: { squawk: info.sqk },
              }),
            );
          }
          break;

        case "setFlaps": {
          // Set flaps by notch number (value is the notch, e.g., 2 out of 3 steps)
          // GeoFS has exposed controls both as a global and on geofs.
          const controls = window.controls ?? geofs.controls;
          if (controls?.flaps) {
            const maxPos = controls.flaps.maxPosition || 6;
            const flapsSteps = geofs.animation?.values?.flapsSteps || maxPos;
            const notch = Math.round(Number(cmd.value));
            if (notch < 0 || notch > flapsSteps) {
              console.warn(
                `[RadarThing] setFlaps - invalid notch ${notch}, must be 0-${flapsSteps}`,
              );
              reason = `This aircraft has flap notches 0 to ${flapsSteps}`;
              break;
            }
            // Convert notch to actual position: notch/steps * maxPosition
            const flapPos = Math.round((notch / flapsSteps) * maxPos);
            controls.flaps.target = flapPos;
            controls.flaps.position = flapPos;
            applied = true;
          }
          break;
        }

        case "enableNav":
          if (typeof geofs.autopilot.setMode === "function") {
            geofs.autopilot.setMode("NAV");
            applied = true;
          }
          break;

        case "disableNav":
          // Switch to heading mode using the proper GeoFS API
          if (typeof geofs.autopilot.setMode === "function") {
            geofs.autopilot.setMode("HDG");
            applied = true;
          }
          break;

        case "setWaypoint": {
          const waypointIdent = String(cmd.value || "")
            .trim()
            .toUpperCase();
          const flightPlan = geofs.flightPlan;
          const route = flightPlan?.waypointArray || [];

          if (!waypointIdent || !Array.isArray(route) || route.length === 0) {
            console.warn("[RadarThing] setWaypoint - no usable flight plan");
            reason = "No flight plan is loaded in GeoFS";
            break;
          }

          const waypointIndex = route.findIndex((waypoint) => {
            const ident =
              waypoint?.ident ||
              waypoint?.name ||
              waypoint?.id ||
              waypoint?.icao;
            return (
              String(ident || "")
                .trim()
                .toUpperCase() === waypointIdent
            );
          });

          if (waypointIndex < 0) {
            console.warn(
              `[RadarThing] setWaypoint - waypoint ${waypointIdent} not found`,
            );
            reason = `${waypointIdent} isn't in your GeoFS flight plan`;
            break;
          }

          const waypoint = route[waypointIndex];

          if (typeof flightPlan.selectWaypoint === "function") {
            flightPlan.selectWaypoint(waypointIndex);
            applied = true;
          } else {
            console.warn(
              "[RadarThing] setWaypoint - selectWaypoint is not available",
            );

            // Fallback: only counts once the waypoint is really tracked.
            if ("trackedWaypoint" in flightPlan) {
              flightPlan.trackedWaypoint = waypoint;
              applied = flightPlan.trackedWaypoint === waypoint;
            }

            if (applied && typeof geofs.autopilot.setMode === "function") {
              geofs.autopilot.setMode("NAV");
            }
          }
          break;
        }

        case "toggleAutopilot":
          if (cmd.value && typeof geofs.autopilot.turnOn === "function") {
            geofs.autopilot.turnOn();
            applied = true;
          } else if (
            !cmd.value &&
            typeof geofs.autopilot.turnOff === "function"
          ) {
            geofs.autopilot.turnOff();
            applied = true;
          }
          break;

        case "disconnectFlight":
          // Ending the flight clears the form and finalizes the session; the
          // runtime UI listens for the disconnect event and shows the toast.
          window.dispatchEvent(
            new CustomEvent("atc-data-sync", {
              detail: { active: false, remote: true },
            }),
          );
          applied = true;
          break;

        default:
          console.warn("[RadarThing] Unknown command type:", cmd.type);
      }

      // Notify UI of command execution
      window.dispatchEvent(
        new CustomEvent("radarthing-command-executed", {
          detail: applied
            ? { type: cmd.type, value: cmd.value, success: true }
            : {
                type: cmd.type,
                value: cmd.value,
                success: false,
                error: reason,
              },
        }),
      );
    } catch (err) {
      console.error("[RadarThing] Command execution error:", err);
      window.dispatchEvent(
        new CustomEvent("radarthing-command-executed", {
          detail: {
            type: cmd.type,
            value: cmd.value,
            success: false,
            error: err.message,
          },
        }),
      );
    }
  }

  // Queued commands come back in the position response, so there is no
  // separate command poll.
  function runReceivedCommands(commands) {
    if (!Array.isArray(commands) || commands.length === 0) return;
    console.log(`[RadarThing] Received ${commands.length} commands`);
    commands.forEach(executeCommand);
  }

  // Connection state shown in the panel. It is driven by real HTTP results
  // rather than by the form being saved.
  const STATUS = {
    idle: { state: "idle", text: "Not tracking", color: "#94a3b8" },
    connecting: { state: "connecting", text: "Connecting…", color: "#7dd3fc" },
    live: { state: "live", text: "Live on radar", color: "#4ade80" },
    retrying: {
      state: "retrying",
      text: "Connection issue · retrying",
      color: "#fbbf24",
    },
    waiting: {
      state: "waiting",
      text: "Waiting for your aircraft…",
      color: "#7dd3fc",
    },
    rejected: {
      state: "rejected",
      text: "Update rejected · check your flight info",
      color: "#f87171",
    },
    busy: {
      state: "busy",
      text: "RadarThing is busy · retrying",
      color: "#fbbf24",
    },
    tooLarge: {
      state: "rejected",
      text: "Route too long · remove waypoints",
      color: "#f87171",
    },
    noNetwork: {
      state: "offline",
      text: "Offline · waiting for network",
      color: "#f87171",
    },
    offline: {
      state: "offline",
      text: "Can't reach RadarThing · retrying",
      color: "#f87171",
    },
  };
  let lastSendSuccessAt = 0;
  let consecutiveSendFailures = 0;
  let nextSendAllowedAt = 0;
  let currentStatus = STATUS.idle;
  let activatedAt = 0;

  function broadcastStatus(next) {
    if (next) currentStatus = next;
    else if (!info.active) currentStatus = STATUS.idle;
    window.dispatchEvent(
      new CustomEvent("atc-status-update", {
        detail: {
          ...currentStatus,
          source: "radarthing",
          lastSuccessAt: lastSendSuccessAt || null,
        },
      }),
    );
  }

  function recordSendSuccess() {
    lastSendSuccessAt = Date.now();
    consecutiveSendFailures = 0;
    nextSendAllowedAt = 0;
    // The full status only goes out when it changes; every success just
    // sends the timestamp so the panel can show "updated Xs ago".
    if (currentStatus !== STATUS.live) broadcastStatus(STATUS.live);
    else
      window.dispatchEvent(
        new CustomEvent("radarthing-last-success", {
          detail: { at: lastSendSuccessAt },
        }),
      );
  }

  function recordSendFailure(status) {
    consecutiveSendFailures += 1;
    // Back off 2s, 4s, 8s … up to 30s so a dead server isn't hammered.
    const delay = Math.min(30000, 1000 * 2 ** consecutiveSendFailures);
    nextSendAllowedAt = Date.now() + delay;
    if (navigator.onLine === false) {
      if (currentStatus !== STATUS.noNetwork) broadcastStatus(STATUS.noNetwork);
      return;
    }
    // Most 4xx responses mean the server is up but refused the data, which is
    // a different problem from being unreachable. 408 and 429 are temporary,
    // so they retry like a server error.
    const isNumber = typeof status === "number";
    const isTemporary =
      isNumber && (status === 408 || status === 429 || status >= 500);
    const next =
      status === 413
        ? STATUS.tooLarge
        : isNumber && status >= 400 && !isTemporary
          ? STATUS.rejected
          : status === 429
            ? STATUS.busy
            : consecutiveSendFailures >= 4
              ? STATUS.offline
              : STATUS.retrying;
    const isImmediate = next === STATUS.rejected || next === STATUS.tooLarge;
    if ((isImmediate || consecutiveSendFailures >= 2) && currentStatus !== next)
      broadcastStatus(next);
  }

  // Let the panel's "Retry now" button skip the remaining backoff.
  // Set when the pilot retries or the network comes back, so the stale check
  // gives the new request time to finish before calling it a problem.
  let reconnectRequestedAt = 0;
  window.addEventListener("radarthing-retry-now", () => {
    if (!info.active) return;
    reconnectRequestedAt = Date.now();
    nextSendAllowedAt = 0;
    lastPositionSendAt = 0;
    broadcastStatus(STATUS.connecting);
  });

  window.addEventListener("offline", () => {
    if (info.active) broadcastStatus(STATUS.noNetwork);
  });
  window.addEventListener("online", () => {
    if (!info.active) return;
    reconnectRequestedAt = Date.now();
    consecutiveSendFailures = 0;
    nextSendAllowedAt = 0;
    lastPositionSendAt = 0;
    broadcastStatus(STATUS.connecting);
  });

  window.addEventListener("radarthing-request-status", () => broadcastStatus());
  window.addEventListener("radarthing-retry-end-flight", () => {
    // Never end a flight the pilot has since started.
    if (info.active) return;
    void endFlight();
  });

  // If nothing has been delivered for a while (aircraft not loaded, position
  // invalid, requests hanging), stop claiming "Live".
  setInterval(() => {
    if (!info.active) return;
    if (positionUpdateInFlight) return;
    if (
      (currentStatus === STATUS.live || currentStatus === STATUS.connecting) &&
      Date.now() -
        Math.max(lastSendSuccessAt, activatedAt, reconnectRequestedAt) >
        30000
    )
      broadcastStatus(STATUS.retrying);
  }, 5000);

  window.addEventListener("atc-data-sync", (e) => {
    const wasActive = info.active;
    if (
      typeof e.detail?.takeoffTime === "string" &&
      e.detail.takeoffTime.trim()
    ) {
      takeoffTimeUTC = e.detail.takeoffTime.trim();
    }
    info = {
      ...e.detail,
      flt: sanitizeCallsign(e.detail?.flt),
      sqk: sanitizeSquawk(e.detail?.sqk),
    };
    if (info.active && !wasActive) {
      activatedAt = Date.now();
      consecutiveSendFailures = 0;
      nextSendAllowedAt = 0;
      broadcastStatus(STATUS.connecting);
    } else if (!info.active) {
      broadcastStatus(STATUS.idle);
    }

    // If flight was active and is now cleared, end the flight immediately
    if (wasActive && !info.active) {
      console.log("[RadarThing] Flight cleared, ending immediately...");
      // The end result says whether the website ended it, so the panel can
      // word its message without tracking that separately.
      endFlight({ remote: e.detail?.remote === true });
    }
  });

  // End flight and save to database immediately
  function reportEndResult(ok, message, remote = false) {
    window.dispatchEvent(
      new CustomEvent("radarthing-flight-end-result", {
        detail: { ok, message, remote },
      }),
    );
  }

  async function endFlight({ remote = false } = {}) {
    const report = (ok, message) => reportEndResult(ok, message, remote);
    const geofs = window.geofs;
    if (!geofs?.userRecord) {
      console.warn("[RadarThing] Cannot end flight - no userRecord");
      report(
        false,
        "Couldn't end the flight because GeoFS hasn't loaded your account. Sign in to GeoFS and try again.",
      );
      return;
    }

    const id = getUserIdentifier(geofs);
    if (!id) {
      console.warn("[RadarThing] Cannot end flight - no id");
      report(
        false,
        "Couldn't end the flight because GeoFS hasn't loaded your account. Sign in to GeoFS and try again.",
      );
      return;
    }

    console.log(`[RadarThing] Ending flight session for id=${id}...`);

    try {
      const res = await fetch(`${API_BASE}/api/end-flight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id,
          googleId: geofs.userRecord.googleid || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.finalized) {
          console.log(`[RadarThing] Flight ended and saved: ${data.flightNo}`);
          report(true, "Flight ended and saved to your history");
        } else {
          report(true, "Flight ended");
          console.log(
            `[RadarThing] No active session to end: ${data.reason || "unknown"}`,
          );
        }
      } else {
        console.error(`[RadarThing] End flight request failed: ${res.status}`);
        report(
          false,
          "Couldn't save this flight to RadarThing. It will be saved when the server times it out.",
        );
      }
    } catch (err) {
      console.error("[RadarThing] Error ending flight:", err);
      report(
        false,
        "Couldn't reach RadarThing to end the flight. It will be saved when the server times it out.",
      );
    }

    // Reset takeoff time for next flight
    wasOnGround = true;
    takeoffTimeUTC = "";
  }

  function calculateAGL() {
    try {
      const geofs = window.geofs;
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
    const geofs = window.geofs;
    if (!info.active) return;
    if (!geofs?.aircraft?.instance) {
      // The sim hasn't spawned an aircraft yet: say so rather than letting
      // the stale check report a connection problem.
      if (currentStatus !== STATUS.waiting) broadcastStatus(STATUS.waiting);
      return;
    }
    if (positionUpdateInFlight) return;

    const onGround =
      geofs.aircraft.instance.groundContact ??
      geofs?.animation?.values?.groundContact ??
      false;
    const interval = onGround
      ? GROUND_SEND_INTERVAL_MS
      : AIRBORNE_SEND_INTERVAL_MS;
    const now = Date.now();
    if (now - lastPositionSendAt < interval) return;
    if (now < nextSendAllowedAt) return;

    lastPositionSendAt = now;
    positionUpdateInFlight = true;
    let requestId = null;
    let requestStartedAt = null;
    let payloadDiagnostics = null;

    try {
      const inst = geofs.aircraft.instance;
      if (wasOnGround && !onGround) takeoffTimeUTC = new Date().toISOString();
      wasOnGround = onGround;

      const lla = inst.llaLocation || [];
      if (!Number.isFinite(lla[0]) || !Number.isFinite(lla[1])) {
        if (currentStatus !== STATUS.waiting) broadcastStatus(STATUS.waiting);
        return;
      }

      const altMSL =
        typeof lla[2] === "number"
          ? lla[2] * 3.28084
          : (geofs?.animation?.values?.altitude ?? 0);
      const altAGL = calculateAGL();
      let flightPlan = [];
      try {
        flightPlan = geofs?.flightPlan?.export ? geofs.flightPlan.export() : [];
      } catch (error) {
        console.warn("[RadarThing] Failed to export flight plan", error);
      }

      const payload = {
        id: getUserIdentifier(geofs),
        googleId: geofs?.userRecord?.googleid || null,
        source: "radarthing",
        callsign: sanitizeCallsign(geofs?.userRecord?.callsign),
        type: inst.aircraftRecord?.name || "Unknown",
        lat: lla[0],
        lon: lla[1],
        alt: typeof altAGL === "number" ? altAGL : Math.round(altMSL),
        altMSL: Math.round(altMSL),
        heading: Math.round(geofs?.animation?.values?.heading360 || 0),
        speed: Math.round(geofs?.animation?.values?.kias || 0),
        groundSpeed: Math.round(
          geofs?.animation?.values?.groundSpeed ||
            geofs?.animation?.values?.kias ||
            0,
        ),
        flightNo: sanitizeCallsign(info.flt),
        departure: info.dep,
        arrival: info.arr,
        takeoffTime: takeoffTimeUTC,
        squawk: sanitizeSquawk(info.sqk),
        af: info.af || "",
        flightPlan,
        nextWaypoint: geofs?.flightPlan?.trackedWaypoint?.ident || null,
        distanceLeft: Number.isFinite(geofs?.flightPlan?.distanceLeft)
          ? Math.round(geofs.flightPlan.distanceLeft)
          : null,
        vspeed: Math.floor(geofs?.animation?.values?.verticalSpeed || 0),
        navMode: geofs?.autopilot?.mode === "NAV",
        speedMode: geofs?.autopilot?.speedMode === "mach" ? "mach" : "knots",
        flapsPosition:
          (window.controls ?? geofs?.controls)?.flaps?.position || 0,
        flapsMaxPosition:
          geofs?.animation?.values?.flapsSteps ||
          (window.controls ?? geofs?.controls)?.flaps?.maxPosition ||
          0,
      };

      requestId = ++positionRequestSequence;
      requestStartedAt = Date.now();
      payloadDiagnostics = getPositionPayloadDiagnostics(payload);
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        POSITION_REQUEST_TIMEOUT_MS,
      );
      let res;
      try {
        res = await fetch(`${API_BASE}/api/atc/position?commands=1`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          recordSendFailure(res.status);
          console.warn(
            `[RadarThing] Position update #${requestId} failed with HTTP ${res.status}`,
            {
              requestId,
              status: res.status,
              statusText: res.statusText,
              elapsedMs: Date.now() - requestStartedAt,
              payload: payloadDiagnostics,
            },
          );
        } else {
          recordSendSuccess();
          let data = null;
          try {
            data = await res.json();
          } catch {
            // A body without commands is fine.
          }
          runReceivedCommands(data?.commands);
        }
      } finally {
        // Keep the abort timeout until the body is read, too.
        clearTimeout(timeoutId);
      }
    } catch (error) {
      recordSendFailure();
      console.warn("[RadarThing] Position update failed before send", {
        requestId,
        elapsedMs:
          typeof requestStartedAt === "number"
            ? Date.now() - requestStartedAt
            : null,
        timeoutMs: POSITION_REQUEST_TIMEOUT_MS,
        payload:
          typeof payloadDiagnostics === "object" ? payloadDiagnostics : null,
        error: getErrorDiagnostics(error),
        rawError: error,
      });
    } finally {
      positionUpdateInFlight = false;
    }
  }, GROUND_SEND_INTERVAL_MS);
})();
