import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAltitudeProfile,
  estimateFlownAltitudeProfile,
  getPeakAltitude,
  interpolateAltitude,
} from "./altitudeProfile";

test("uses recorded route altitudes when every point provides one", () => {
  const profile = buildAltitudeProfile([
    [51, -0.1, 1_250],
    [52, 0.2, 14_000],
    [53, 0.4, 31_000],
  ]);

  assert.deepEqual(profile.altitudes, [1_250, 14_000, 31_000]);
  assert.equal(profile.isEstimated, false);
});

test("creates an estimated climb, cruise, and descent for legacy routes", () => {
  const route = Array.from({ length: 11 }, (_, index) => [index, index]);
  const profile = buildAltitudeProfile(route, 36_000);

  assert.equal(profile.isEstimated, true);
  assert.equal(profile.altitudes[0], 0);
  assert.equal(profile.altitudes[5], 36_000);
  assert.equal(profile.altitudes[10], 0);
  assert.equal(getPeakAltitude(profile.altitudes), 36_000);
});

test("interpolates the aircraft altitude within the active segment", () => {
  assert.equal(interpolateAltitude(10_000, 20_000, 0.25), 12_500);
  assert.equal(interpolateAltitude(10_000, 20_000, 2), 20_000);
});

test("estimates a live flown profile ending at current altitude", () => {
  const flown = estimateFlownAltitudeProfile(6, 32_000);

  assert.equal(flown[0], 0);
  assert.equal(flown[5], 32_000);
});
