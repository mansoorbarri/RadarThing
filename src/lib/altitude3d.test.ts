import assert from "node:assert/strict";
import test from "node:test";
import { altitudeHeight, altitudeSegmentColor } from "./altitude3d";
import {
  ALTITUDE_RENDER_BANDS,
  buildAltitudePathSegments,
} from "./altitudeBands";

test("curtain colours exactly match 2D, including band boundaries and missing telemetry", () => {
  for (const [first, second] of [
    [0, 9999],
    [5000, 15000],
    [15000, 25000],
    [25000, 35000],
    [35000, 45000],
    [50000, 55000],
    [NaN, 5000],
  ]) {
    const segment = buildAltitudePathSegments(
      [
        [0, 0],
        [1, 1],
      ],
      [first!, second!],
    )[0]!;
    assert.equal(
      altitudeSegmentColor(first!, second!),
      ALTITUDE_RENDER_BANDS[segment.bandIndex]!.color,
    );
  }
});
test("projection preserves relative altitude", () => {
  const low = altitudeHeight(10000);
  const high = altitudeHeight(20000);
  assert.equal(high, low * 2);
  assert.ok(high > low);
});
test("unknown and below-ground altitude cannot produce invalid canvas or marker transforms", () => {
  for (const altitude of [NaN, Infinity, -100, 0]) {
    assert.equal(altitudeHeight(altitude), 0);
  }
  assert.ok(altitudeHeight(1e9) < 320);
});
