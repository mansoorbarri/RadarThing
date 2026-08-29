import assert from "node:assert/strict";
import test from "node:test";

import { getCompactAircraftType, normalizeAircraftType } from "./utils";

test("normalizes Antonov An-124 names to A124", () => {
  assert.equal(normalizeAircraftType("ANTONOV"), "A124");
  assert.equal(normalizeAircraftType("Antonov AN-124"), "A124");
  assert.equal(normalizeAircraftType("AN124"), "A124");
  assert.equal(getCompactAircraftType("ANTONOV"), "A124");
});

test("normalizes live Antonov An-140 stream names to A140", () => {
  assert.equal(normalizeAircraftType("Antonov An-140"), "A140");
  assert.equal(getCompactAircraftType("Antonov An-140"), "A140");
});

test("normalizes the Airbus A220-300 to its ICAO designator BCS3", () => {
  assert.equal(normalizeAircraftType("A220-300"), "BCS3");
  assert.equal(normalizeAircraftType("Airbus A220-300"), "BCS3");
  assert.equal(getCompactAircraftType("A220-300"), "BCS3");
  assert.equal(getCompactAircraftType("A223"), "BCS3");
});
