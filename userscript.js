// @ts-nocheck
(function () {
  "use strict";

  const API_BASE = "https://sse.radarthing.com";
  const SEND_INTERVAL_MS = 5000;
  const COMMAND_POLL_INTERVAL_MS = 2000;

  let info = { active: false, dep: "", arr: "", flt: "", sqk: "" };
  let wasOnGround = true;
  let takeoffTimeUTC = "";

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
            info.sqk = String(cmd.value);
            window.dispatchEvent(
              new CustomEvent("atc-data-sync", { detail: info }),
            );
            // Also update the squawk input field in the UI
            window.dispatchEvent(
              new CustomEvent("atc-squawk-update", {
                detail: { squawk: String(cmd.value) },
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

        case "disableNav":
          // Switch to heading mode using the proper GeoFS API
          if (typeof geofs.autopilot.setMode === "function") {
            geofs.autopilot.setMode("HDG");
          }
          break;

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

    const id = geofs.userRecord.googleid || geofs.userRecord.callsign;
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
    info = e.detail;
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

    const id = geofs.userRecord.googleid || geofs.userRecord.callsign;
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
      navMode: geofs.autopilot?.mode === "NAV",
      flapsPosition: controls?.flaps?.position || 0,
      flapsMaxPosition:
        geofs.animation?.values?.flapsSteps ||
        controls?.flaps?.maxPosition ||
        0,
    };

    fetch(`${API_BASE}/api/atc/position`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, SEND_INTERVAL_MS);
})();
