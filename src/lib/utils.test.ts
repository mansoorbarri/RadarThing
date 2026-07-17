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
