import assert from "node:assert/strict";
import test from "node:test";
import { activeAircraft, type PositionUpdate } from "./aircraft-store";
import { buildLiveAltitudeProfile } from "./altitudeProfile";

const aircraft: PositionUpdate = {
  id: "test",
  callsign: "TEST",
  type: "A320",
  lat: 10,
  lon: 20,
  alt: 5000,
  altMSL: 5000,
  heading: 90,
  speed: 200,
  flightNo: "TEST1",
  departure: "",
  arrival: "",
  takeoffTime: "",
  squawk: "1200",
  af: "",
  flightPlan: "",
  vspeed: "0",
  nextWaypoint: "",
  ts: 1000,
  lastSeen: 1000,
};

test("telemetry follows appended path points, resets on replacement, and survives path trimming", () => {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => undefined;
  try {
    activeAircraft.clear();
    activeAircraft.set(aircraft.id, aircraft);
    activeAircraft.set(aircraft.id, {
      ...aircraft,
      altMSL: 6000,
      heading: 100,
      ts: 2000,
    });
    assert.equal(activeAircraft.get(aircraft.id)!.flightPath!.length, 1);
    assert.equal(activeAircraft.get(aircraft.id)!.flightTelemetry!.length, 1);
    assert.equal(
      activeAircraft.get(aircraft.id)!.flightTelemetry![0]!.altMSL,
      5000,
    );
    activeAircraft.set(aircraft.id, {
      ...aircraft,
      lat: 11,
      altMSL: 7000,
      ts: 3000,
    });
    assert.equal(activeAircraft.get(aircraft.id)!.flightTelemetry!.length, 2);

    activeAircraft.mergeFlightPath(aircraft.id, [
      [8, 20],
      [9, 20],
      [11, 20],
    ]);
    assert.deepEqual(activeAircraft.get(aircraft.id)!.flightTelemetry, []);
    // A stationary update after replacement cannot resurrect old telemetry.
    activeAircraft.set(aircraft.id, { ...aircraft, lat: 11, ts: 4000 });
    assert.deepEqual(activeAircraft.get(aircraft.id)!.flightTelemetry, []);
    activeAircraft.set(aircraft.id, {
      ...aircraft,
      lat: 12,
      altMSL: 8000,
      ts: 5000,
    });
    assert.deepEqual(
      activeAircraft
        .get(aircraft.id)!
        .flightTelemetry!.map((sample) => [sample.lat, sample.altMSL]),
      [[12, 8000]],
    );
    activeAircraft.mergeFlightPath(aircraft.id, [[0, 0]]);
    assert.equal(activeAircraft.get(aircraft.id)!.flightTelemetry!.length, 1);

    for (let index = 0; index < 350; index++) {
      activeAircraft.set(aircraft.id, {
        ...aircraft,
        lat: 20 + index / 1000,
        altMSL: 10000 + index,
        ts: 6000 + index * 1000,
      });
    }
    const current = activeAircraft.get(aircraft.id)!;
    assert.equal(current.flightPath!.length, 150);
    const profile = buildLiveAltitudeProfile(
      current.flightPath!,
      current.flightTelemetry!,
      current.altMSL,
    );
    assert.equal(profile.isEstimated, false);
    assert.equal(profile.altitudes[0], 10200);
    assert.equal(profile.altitudes.at(-1), 10349);
  } finally {
    activeAircraft.clear();
    activeAircraft.destroy();
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});
