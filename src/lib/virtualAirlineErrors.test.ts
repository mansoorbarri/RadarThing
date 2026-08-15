import assert from "node:assert/strict";
import test from "node:test";

import { mapVirtualAirlineMemberAddError } from "./virtualAirlineErrors";

test("mapVirtualAirlineMemberAddError — already assigned", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError(
       "Pilot is already assigned to another VA"
     ),
     "That pilot is already assigned to another VA"
    );
});

test("mapVirtualAirlineMemberAddError — pilot not found", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError("Pilot not found"),
     "Pilot not found — the user may have deleted their account"
    );
});

test("mapVirtualAirlineMemberAddError — Discord required", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError(
       "Pilots must connect Discord to RadarThing before joining a VA"
     ),
     "This pilot must connect their Discord account before joining a VA"
    );
});

test("mapVirtualAirlineMemberAddError — unmapped error returns generic fallback", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError("Some unexpected backend error"),
     "Failed to add pilot to VA"
    );
});

test("mapVirtualAirlineMemberAddError — empty string returns generic fallback", () => {
  assert.equal(mapVirtualAirlineMemberAddError(""), "Failed to add pilot to VA");
});
