import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAltitudeProfile,
  buildLiveAltitudeProfile,
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

const sample = (lat: number, altitude: number) => ({
  lat,
  lon: 0,
  altMSL: altitude,
});

test("telemetry fills matching coordinates without shifting samples across gaps", () => {
  const path: [number, number][] = [
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ];
  const estimates = estimateFlownAltitudeProfile(path.length, 35000);
  const result = buildLiveAltitudeProfile(
    path,
    [sample(1, 1000), sample(99, 90000), sample(3, 30000), sample(4, NaN)],
    35000,
  );
  assert.deepEqual(result.altitudes, [1000, estimates[1], 30000, estimates[3]]);
  assert.equal(result.isEstimated, true);
});

test("retained suffixes use recent samples and repeated positions consume distinct observations", () => {
  assert.deepEqual(
    buildLiveAltitudeProfile(
      [
        [1, 0],
        [2, 0],
      ],
      [sample(1, 1000), sample(2, 2000), sample(1, 10000), sample(2, 20000)],
      35000,
    ),
    { altitudes: [10000, 20000], isEstimated: false },
  );
  const result = buildLiveAltitudeProfile(
    [
      [1, 0],
      [2, 0],
      [1, 0],
    ],
    [sample(2, 2000), sample(1, 10000)],
    35000,
  );
  assert.deepEqual(result.altitudes, [0, 2000, 10000]);
  assert.equal(result.isEstimated, true);
});

test("unrelated telemetry of equal length never suppresses the estimated flag", () => {
  const result = buildLiveAltitudeProfile(
    [
      [1, 0],
      [2, 0],
    ],
    [sample(3, 123), sample(4, 456)],
    35000,
  );
  assert.deepEqual(result.altitudes, estimateFlownAltitudeProfile(2, 35000));
  assert.equal(result.isEstimated, true);
});
