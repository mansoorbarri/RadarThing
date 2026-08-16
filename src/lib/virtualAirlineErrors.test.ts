import assert from "node:assert/strict";
import test from "node:test";

import { mapVirtualAirlineMemberAddError } from "./virtualAirlineErrors";

test("mapVirtualAirlineMemberAddError — already assigned (plain)", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError(
        "Pilot is already assigned to another VA"
      ),
      "That pilot is already assigned to another VA"
     );
});

test("mapVirtualAirlineMemberAddError — already assigned (Convex wrapped)", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError(
        "[CONVEX M(virtualAirlineMembers:add)] Uncaught Error: Pilot is already assigned to another VA"
      ),
      "That pilot is already assigned to another VA"
     );
});

test("mapVirtualAirlineMemberAddError — pilot not found (plain)", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError("Pilot not found"),
      "Pilot not found \u2014 the user may have deleted their account"
     );
});

test("mapVirtualAirlineMemberAddError — pilot not found (Convex wrapped)", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError(
        "[CONVEX M(virtualAirlineMembers:add)] Uncaught Error: Pilot not found"
      ),
      "Pilot not found \u2014 the user may have deleted their account"
     );
});

test("mapVirtualAirlineMemberAddError — Discord required (plain)", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError(
        "Pilots must connect Discord to RadarThing before joining a VA"
      ),
      "This pilot must connect their Discord account before joining a VA"
     );
});

test("mapVirtualAirlineMemberAddError — Discord required (Convex wrapped)", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError(
        "Uncaught Error: Pilots must connect Discord to RadarThing before joining a VA"
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

test("mapVirtualAirlineMemberAddError — unmapped Convex wrapped error returns generic fallback", () => {
  assert.equal(
    mapVirtualAirlineMemberAddError(
        "[CONVEX M(virtualAirlineMembers:add)] Uncaught Error: Some random failure"
      ),
      "Failed to add pilot to VA"
     );
});

test("mapVirtualAirlineMemberAddError — empty string returns generic fallback", () => {
  assert.equal(mapVirtualAirlineMemberAddError(""), "Failed to add pilot to VA");
});
