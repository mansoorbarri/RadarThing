// @ts-nocheck
(function () {
  "use strict";

  const API_URL = "https://sse.radarthing.com/api/atc/position";
  const COMMANDS_URL = "https://sse.radarthing.com/api/commands";
  const SEND_INTERVAL_MS = 5000;
  const COMMAND_POLL_INTERVAL_MS = 2000;

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
          if (typeof geofs.autopilot.setVerticalSpeed === "function") {
            geofs.autopilot.setVerticalSpeed(Number(cmd.value));
          }
          break;

        case "setSquawk":
          // Update the squawk in flight info
          if (info) {
            info.sqk = String(cmd.value);
            window.dispatchEvent(
              new CustomEvent("atc-data-sync", { detail: info })
            );
            // Also update the squawk input field in the UI
            window.dispatchEvent(
              new CustomEvent("atc-squawk-update", {
                detail: { squawk: String(cmd.value) },
              })
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
    if (!geofs?.userRecord) return;

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
      navMode: geofs.autopilot?.modes?.nav || false,
    };

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, SEND_INTERVAL_MS);
})();
