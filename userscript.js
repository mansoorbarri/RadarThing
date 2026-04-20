// @ts-nocheck
(function () {
  "use strict";

  const API_BASE = "https://sse.radarthing.com";
  const SEND_INTERVAL_MS = 5000;
  const COMMAND_POLL_INTERVAL_MS = 2000;
  const DEFAULT_IDENT_DURATION_SECONDS = 15;

  let info = { active: false, dep: "", arr: "", flt: "", sqk: "", af: "" };
  let wasOnGround = true;
  let takeoffTimeUTC = "";
  let identActiveUntil = 0;
  let identExpiryTimer = null;

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

  function getUserIdentifier() {
    return (
      geofs?.userRecord?.googleid ||
      sanitizeCallsign(geofs?.userRecord?.callsign)
    );
  }

  function isIdentActive() {
    return identActiveUntil > Date.now();
  }

  function showIdentToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 1000002;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #fff;
      background: ${isError ? "rgba(239,68,68,0.92)" : "rgba(245,158,11,0.92)"};
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.38);
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
    });
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  function broadcastIdentUpdate(active) {
    window.dispatchEvent(
      new CustomEvent("radarthing-ident-update", {
        detail: {
          active,
          identUntil: active ? identActiveUntil : null,
        },
      }),
    );
  }

  function scheduleIdentExpiry() {
    if (identExpiryTimer) {
      clearTimeout(identExpiryTimer);
      identExpiryTimer = null;
    }

    if (!isIdentActive()) {
      identActiveUntil = 0;
      broadcastIdentUpdate(false);
      return;
    }

    identExpiryTimer = setTimeout(() => {
      identActiveUntil = 0;
      broadcastIdentUpdate(false);
    }, Math.max(250, identActiveUntil - Date.now() + 50));
  }

  function activateIdent(durationSeconds) {
    const durationMs = Math.max(
      5000,
      Number(durationSeconds || DEFAULT_IDENT_DURATION_SECONDS) * 1000,
    );
    identActiveUntil = Date.now() + durationMs;
    showIdentToast("IDENT ACTIVE");
    broadcastIdentUpdate(true);
    scheduleIdentExpiry();
  }

  function requestIdent(durationSeconds) {
    const requestedSeconds = Math.max(
      5,
      Number(durationSeconds || DEFAULT_IDENT_DURATION_SECONDS),
    );
    showIdentToast("ATC requested IDENT");
    window.dispatchEvent(
      new CustomEvent("radarthing-ident-requested", {
        detail: { durationSeconds: requestedSeconds },
      }),
    );
  }

  window.addEventListener("radarthing-ident-confirm", (e) => {
    activateIdent(Number(e.detail?.durationSeconds) || DEFAULT_IDENT_DURATION_SECONDS);
  });

  // ==========================================
  // AUTOPILOT FOLLOW
  // ==========================================

  let followTargetId = null;
  let followES = null;
  let followSnapshot = null;
  let followReconnectTimeout = null;

  function startFollow(targetId) {
    stopFollow();
    followTargetId = targetId;
    followSnapshot = null;
    console.log(`[RadarThing] Starting AP follow: ${targetId}`);
    connectFollowSSE();
  }

  function connectFollowSSE() {
    if (followES) followES.close();

    followES = new EventSource(`${API_BASE}/api/stream`);

    followES.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const list = data.aircraft || [];
        const leader = list.find(
          (ac) => ac.id === followTargetId || ac.callsign === followTargetId,
        );

        if (!leader) return;
        if (!geofs?.autopilot || !geofs?.aircraft?.instance) return;

        const spd = Math.round(leader.speed || 0);
        const alt = Math.round(leader.altMSL || 0);
        const vs = Math.floor(leader.vspeed || 0);

        if (!followSnapshot) {
          // Initial sync — copy everything immediately
          followSnapshot = { speed: spd, altMSL: alt, vspeed: vs };
          applyAP(spd, alt, vs);
          broadcastFollowStatus(true, followTargetId, leader);
          console.log(
            `[RadarThing] Follow initial sync: SPD=${spd} ALT=${alt} VS=${vs}`,
          );
          return;
        }

        let changed = false;
        if (followSnapshot.speed !== spd) {
          if (typeof geofs.autopilot.setSpeed === "function")
            geofs.autopilot.setSpeed(spd);
          changed = true;
        }
        if (followSnapshot.altMSL !== alt) {
          if (typeof geofs.autopilot.setAltitude === "function")
            geofs.autopilot.setAltitude(alt);
          changed = true;
        }
        if (followSnapshot.vspeed !== vs) {
          if (typeof geofs.autopilot.setVerticalSpeed === "function")
            geofs.autopilot.setVerticalSpeed(vs);
          changed = true;
        }

        followSnapshot = { speed: spd, altMSL: alt, vspeed: vs };
        broadcastFollowStatus(true, followTargetId, leader);

        if (changed) {
          console.log(
            `[RadarThing] Follow update: SPD=${spd} ALT=${alt} VS=${vs}`,
          );
        }
      } catch (_) {}
    };

    followES.onerror = () => {
      console.warn("[RadarThing] Follow SSE error, reconnecting...");
      if (followES) followES.close();
      followES = null;
      if (followTargetId) {
        followReconnectTimeout = setTimeout(connectFollowSSE, 3000);
      }
    };
  }

  function stopFollow() {
    if (followReconnectTimeout) {
      clearTimeout(followReconnectTimeout);
      followReconnectTimeout = null;
    }
    if (followES) {
      followES.close();
      followES = null;
    }
    const wasFollowing = followTargetId !== null;
    followTargetId = null;
    followSnapshot = null;
    if (wasFollowing) {
      console.log("[RadarThing] Stopped AP follow");
      broadcastFollowStatus(false, null, null);
    }
  }

  function applyAP(speed, alt, vs) {
    if (typeof geofs.autopilot.setSpeed === "function")
      geofs.autopilot.setSpeed(speed);
    if (typeof geofs.autopilot.setAltitude === "function")
      geofs.autopilot.setAltitude(alt);
    if (typeof geofs.autopilot.setVerticalSpeed === "function")
      geofs.autopilot.setVerticalSpeed(vs);
  }

  function broadcastFollowStatus(following, targetId, leader) {
    window.dispatchEvent(
      new CustomEvent("radarthing-follow-update", {
        detail: {
          following,
          targetId,
          leader: leader
            ? {
                callsign: leader.callsign || "",
                flightNo: leader.flightNo || "",
                type: leader.type || "",
                speed: Math.round(leader.speed || 0),
                altMSL: Math.round(leader.altMSL || 0),
                vspeed: Math.floor(leader.vspeed || 0),
              }
            : null,
        },
      }),
    );
  }

  // Listen for follow commands from the UI
  window.addEventListener("radarthing-follow-start", (e) => {
    if (e.detail?.targetId) startFollow(e.detail.targetId);
  });

  window.addEventListener("radarthing-follow-stop", () => {
    stopFollow();
  });

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

        case "setSpeedMode": {
          const speedMode =
            String(cmd.value || "").toLowerCase() === "mach" ? "mach" : "knots";
          if (typeof geofs.autopilot.setSpeedMode === "function") {
            geofs.autopilot.setSpeedMode(speedMode);
          }
          break;
        }

        case "setAltitude":
          if (typeof geofs.autopilot.setAltitude === "function") {
            geofs.autopilot.setAltitude(Number(cmd.value));
          }
          break;

        case "setHeading":
          // Switch to heading mode using the proper GeoFS API
          if (typeof geofs.autopilot.setMode === "function") {
            geofs.autopilot.setMode("HDG");
          }
          // Set the course value
          if (typeof geofs.autopilot.setCourse === "function") {
            geofs.autopilot.setCourse(Number(cmd.value));
          }
          break;

        case "setVS":
          if (typeof geofs.autopilot.setVerticalSpeed === "function") {
            geofs.autopilot.setVerticalSpeed(Number(cmd.value));
          }
          break;

        case "setSquawk":
          // Update the squawk in flight info
          if (info) {
            info.sqk = sanitizeSquawk(cmd.value);
            window.dispatchEvent(
              new CustomEvent("atc-data-sync", { detail: info }),
            );
            // Also update the squawk input field in the UI
            window.dispatchEvent(
              new CustomEvent("atc-squawk-update", {
                detail: { squawk: info.sqk },
              }),
            );
          }
          break;

        case "setFlaps":
          // Set flaps by notch number (value is the notch, e.g., 2 out of 3 steps)
          if (controls?.flaps) {
            const maxPos = controls.flaps.maxPosition || 6;
            const flapsSteps = geofs.animation?.values?.flapsSteps || maxPos;
            const notch = Math.round(Number(cmd.value));
            if (notch < 0 || notch > flapsSteps) {
              console.warn(
                `[RadarThing] setFlaps - invalid notch ${notch}, must be 0-${flapsSteps}`,
              );
              break;
            }
            // Convert notch to actual position: notch/steps * maxPosition
            const flapPos = Math.round((notch / flapsSteps) * maxPos);
            controls.flaps.target = flapPos;
            controls.flaps.position = flapPos;
          }
          break;

        case "enableNav":
          if (typeof geofs.autopilot.setMode === "function") {
            geofs.autopilot.setMode("NAV");
          }
          break;

        case "disableNav":
          // Switch to heading mode using the proper GeoFS API
          if (typeof geofs.autopilot.setMode === "function") {
            geofs.autopilot.setMode("HDG");
          }
          break;

        case "setWaypoint": {
          const waypointIdent = String(cmd.value || "").trim().toUpperCase();
          const flightPlan = geofs.flightPlan;
          const route = flightPlan?.waypointArray || [];

          if (!waypointIdent || !Array.isArray(route) || route.length === 0) {
            console.warn("[RadarThing] setWaypoint - no usable flight plan");
            break;
          }

          const waypointIndex = route.findIndex((waypoint) => {
            const ident =
              waypoint?.ident || waypoint?.name || waypoint?.id || waypoint?.icao;
            return String(ident || "").trim().toUpperCase() === waypointIdent;
          });

          if (waypointIndex < 0) {
            console.warn(
              `[RadarThing] setWaypoint - waypoint ${waypointIdent} not found`,
            );
            break;
          }

          const waypoint = route[waypointIndex];

          if (typeof flightPlan.selectWaypoint === "function") {
            flightPlan.selectWaypoint(waypointIndex);
          } else {
            console.warn(
              "[RadarThing] setWaypoint - selectWaypoint is not available",
            );

            if ("trackedWaypoint" in flightPlan) {
              flightPlan.trackedWaypoint = waypoint;
            }

            if (typeof geofs.autopilot.setMode === "function") {
              geofs.autopilot.setMode("NAV");
            }
          }
          break;
        }

        case "toggleAutopilot":
          if (cmd.value && typeof geofs.autopilot.turnOn === "function") {
            geofs.autopilot.turnOn();
          } else if (
            !cmd.value &&
            typeof geofs.autopilot.turnOff === "function"
          ) {
            geofs.autopilot.turnOff();
          }
          break;

        case "requestIdent":
          requestIdent(Number(cmd.value) || DEFAULT_IDENT_DURATION_SECONDS);
          break;

        default:
          console.warn("[RadarThing] Unknown command type:", cmd.type);
      }

      // Notify UI of command execution
      window.dispatchEvent(
        new CustomEvent("radarthing-command-executed", {
          detail: { type: cmd.type, value: cmd.value, success: true },
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

  // Poll for commands from RadarThing server
  async function pollCommands() {
    if (!geofs?.userRecord) return;

    const id = getUserIdentifier();
    if (!id) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/commands/${encodeURIComponent(id)}`,
      );
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
    const wasActive = info.active;
    info = {
      ...e.detail,
      flt: sanitizeCallsign(e.detail?.flt),
      sqk: sanitizeSquawk(e.detail?.sqk),
    };
    broadcastStatus();

    // If flight was active and is now cleared, end the flight immediately
    if (wasActive && !info.active) {
      console.log("[RadarThing] Flight cleared, ending immediately...");
      endFlight();
    }
  });

  // End flight and save to database immediately
  async function endFlight() {
    if (!geofs?.userRecord) {
      console.warn("[RadarThing] Cannot end flight - no userRecord");
      return;
    }

    const id = getUserIdentifier();
    if (!id) {
      console.warn("[RadarThing] Cannot end flight - no id");
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
        } else {
          console.log(
            `[RadarThing] No active session to end: ${data.reason || "unknown"}`,
          );
        }
      } else {
        console.error(`[RadarThing] End flight request failed: ${res.status}`);
      }
    } catch (err) {
      console.error("[RadarThing] Error ending flight:", err);
    }

    // Reset takeoff time for next flight
    wasOnGround = true;
    takeoffTimeUTC = "";
  }

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
      id: getUserIdentifier(),
      googleId: geofs.userRecord.googleid || null,
      callsign: sanitizeCallsign(geofs.userRecord.callsign),
      type: inst.aircraftRecord.name || "Unknown",
      lat: lla[0],
      lon: lla[1],
      alt: typeof altAGL === "number" ? altAGL : Math.round(altMSL),
      altMSL: Math.round(altMSL),
      heading: Math.round(geofs.animation.values.heading360 || 0),
      speed: Math.round(geofs.animation.values.kias || 0),
      groundSpeed: Math.round(
        geofs.animation.values.groundSpeed ||
          geofs.animation.values.kias ||
          0,
      ),
      flightNo: sanitizeCallsign(info.flt),
      departure: info.dep,
      arrival: info.arr,
      takeoffTime: takeoffTimeUTC,
      squawk: sanitizeSquawk(info.sqk),
      af: info.af || "",
      flightPlan: geofs.flightPlan?.export ? geofs.flightPlan.export() : [],
      nextWaypoint: geofs.flightPlan?.trackedWaypoint?.ident || null,
      vspeed: Math.floor(geofs.animation?.values?.verticalSpeed || 0),
      navMode: geofs.autopilot?.mode === "NAV",
      speedMode: geofs.autopilot?.speedMode === "mach" ? "mach" : "knots",
      flapsPosition: controls?.flaps?.position || 0,
      flapsMaxPosition:
        geofs.animation?.values?.flapsSteps ||
        controls?.flaps?.maxPosition ||
        0,
      identActive: isIdentActive(),
      identUntil: isIdentActive() ? identActiveUntil : null,
    };

    fetch(`${API_BASE}/api/atc/position`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, SEND_INTERVAL_MS);
})();
