(function () {
  "use strict";

  const WS_URL = "wss://geofs-flightradar.duckdns.org/ws";
  const SEND_INTERVAL_MS = 1500;

  let ws;
  let wasOnGround = true;
  let takeoffTimeUTC = "";

  let flightInfo = {
    departure: "",
    arrival: "",
    flightNo: "",
    squawk: "",
    active: false,
  };

  function getAircraftName() {
    return (
      geofs?.aircraft?.instance?.aircraftRecord?.name ||
      "Unknown"
    );
  }

  function getPlayerCallsign() {
    return geofs?.userRecord?.callsign || "Unknown";
  }

  function calculateAGL() {
    try {
      const altMSL = geofs.animation.values.altitude;
      const ground =
        geofs.animation.values.groundElevationFeet;
      const aircraft = geofs.aircraft.instance;

      if (aircraft?.collisionPoints?.length >= 2) {
        const z =
          aircraft.collisionPoints[
            aircraft.collisionPoints.length - 2
          ].worldPosition[2] * 3.2808399;

        return Math.round(altMSL - ground + z);
      }
    } catch {}
    return null;
  }

  function checkTakeoff() {
    const onGround =
      geofs.aircraft.instance.groundContact ?? true;
    if (wasOnGround && !onGround) {
      takeoffTimeUTC = new Date().toISOString();
    }
    wasOnGround = onGround;
  }

  function readSnapshot() {
    const inst = geofs.aircraft.instance;
    const lla = inst.llaLocation;
    if (!lla) return null;

    const altMSL = (lla[2] || 0) * 3.28084;
    const altAGL = calculateAGL();

    return {
      lat: lla[0],
      lon: lla[1],
      altMSL,
      altAGL,
      heading:
        geofs.animation.values.heading360 || 0,
      speed:
        geofs.animation.values.kias || 0,
    };
  }

  function buildPayload(snap) {
    checkTakeoff();

    let flightPlan = [];
    try {
      if (
        geofs.flightPlan &&
        typeof geofs.flightPlan.export ===
          "function"
      ) {
        flightPlan = geofs.flightPlan.export();
      }
    } catch {}

    const userId = geofs?.userRecord?.id || null;

    return {
      id: getPlayerCallsign(),
      callsign: getPlayerCallsign(),
      type: getAircraftName(),
      lat: snap.lat,
      lon: snap.lon,
      alt:
        typeof snap.altAGL === "number"
          ? snap.altAGL
          : Math.round(snap.altMSL || 0),
      altMSL: Math.round(snap.altMSL || 0),
      heading: Math.round(snap.heading || 0),
      speed: Math.round(snap.speed || 0),
      flightNo: flightInfo.flightNo,
      departure: flightInfo.departure,
      arrival: flightInfo.arrival,
      takeoffTime: takeoffTimeUTC,
      squawk: flightInfo.squawk,
      flightPlan: flightPlan,
      nextWaypoint:
        geofs.flightPlan?.trackedWaypoint
          ?.ident || null,
      userId: userId,
    };
  }

  function connectWS() {
    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "hello",
            role: "player",
          })
        );
      };

      ws.onclose = () => {
        setTimeout(connectWS, 2000);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
    } catch {
      setTimeout(connectWS, 2000);
    }
  }

  setInterval(() => {
    if (!ws || ws.readyState !== 1) return;
    if (!flightInfo.active) return;

    const snap = readSnapshot();
    if (!snap) return;

    ws.send(
      JSON.stringify({
        type: "position_update",
        payload: buildPayload(snap),
      })
    );
  }, SEND_INTERVAL_MS);

  window.addEventListener("atc-data-sync", (e) => {
    const d = e.detail || {};

    flightInfo.departure = d.dep || "";
    flightInfo.arrival = d.arr || "";
    flightInfo.flightNo = d.flt || "";
    flightInfo.squawk = d.sqk || "";
    flightInfo.active = !!d.active;

    window.dispatchEvent(
      new CustomEvent("atc-status-update", {
        detail: flightInfo.active
          ? {
              text: "Transmitting",
              color: "#22c55e",
            }
          : {
              text: "Flight info required",
              color: "#f87171",
            },
      })
    );
  });

  const wait = setInterval(() => {
    if (window.geofs?.aircraft?.instance) {
      clearInterval(wait);
      connectWS();
    }
  }, 500);
})();