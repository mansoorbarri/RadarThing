import assert from "node:assert/strict";
import test from "node:test";
import { ALTITUDE_BANDS, getAltitudeBandIndex } from "./altitudeBands";

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
