import assert from "node:assert/strict";
import test from "node:test";
import { applyFreeAllowance } from "./freeAllowance";

test("counts distinct keys up to the limit", () => {
  let keys: string[] = [];
  for (const icao of ["KJFK", "KLAX", "KSFO"]) {
    const result = applyFreeAllowance(keys, icao, 3);
    assert.equal(result.allowed, true);
    keys = result.keys;
  }
  assert.deepEqual(keys, ["KJFK", "KLAX", "KSFO"]);

  const blocked = applyFreeAllowance(keys, "KSEA", 3);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.used, 3);
  assert.deepEqual(blocked.keys, keys);
});

test("re-opening an already counted key is free", () => {
  const result = applyFreeAllowance(["KJFK", "KLAX", "KSFO"], "KLAX", 3);
  assert.equal(result.allowed, true);
  assert.equal(result.used, 3);
});
