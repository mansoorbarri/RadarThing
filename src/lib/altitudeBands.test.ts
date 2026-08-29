import assert from "node:assert/strict";
import test from "node:test";
import {
  ALTITUDE_BANDS,
  buildAltitudePathSegments,
  getAltitudeBandIndex,
} from "./altitudeBands";

test("assigns exact hundred-flight-level altitude bands", () => {
  const cases = [
    [0, "< FL100"],
    [9_999, "< FL100"],
    [10_000, "FL100–199"],
    [20_000, "FL200–299"],
    [30_000, "FL300–399"],
    [40_000, "FL400+"],
    [52_000, "FL400+"],
  ] as const;

  for (const [altitude, expectedLabel] of cases) {
    assert.equal(
      ALTITUDE_BANDS[getAltitudeBandIndex(altitude)]?.label,
      expectedLabel,
    );
  }
});

test("groups adjacent path legs using the shared altitude legend", () => {
  const points = ["a", "b", "c", "d", "e"];
  const segments = buildAltitudePathSegments(
    points,
    [5_000, 8_000, 12_000, 25_000, 32_000],
  );

  assert.deepEqual(segments, [
    { points: ["a", "b"], bandIndex: 0 },
    { points: ["b", "c", "d"], bandIndex: 1 },
    { points: ["d", "e"], bandIndex: 2 },
  ]);
});

test("uses the no-telemetry band when either endpoint is unknown", () => {
  assert.deepEqual(
    buildAltitudePathSegments(
      ["a", "b", "c"],
      [5_000, 15_000, 25_000],
      [true, false, true],
    ),
    [{ points: ["a", "b", "c"], bandIndex: ALTITUDE_BANDS.length }],
  );
});
