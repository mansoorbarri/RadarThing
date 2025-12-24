(function () {
  "use strict";

  const API_URL = "https://radar-sse-production.up.railway.app/api/atc/position";
  const SEND_INTERVAL_MS = 5000;

  let info = { active: false, dep: "", arr: "", flt: "", sqk: "" };
  let wasOnGround = true;
  let takeoffTimeUTC = "";

  function broadcastStatus() {
    let status = { text: "Flight info required", color: "#e74c3c" };
    if (info.active) {
      status = { text: "Transmitting to API", color: "#27ae60" };
    }
    window.dispatchEvent(
      new CustomEvent("atc-status-update", { detail: status })
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
      id: geofs.userRecord.callsign,
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
      userId: geofs.userRecord.userId || null,
    };

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, SEND_INTERVAL_MS);
})();