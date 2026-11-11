import assert from "node:assert/strict";
import test from "node:test";
import { getFlightStartAccess } from "./flightAccess";

test("pro can always start a flight", () => {
  assert.equal(getFlightStartAccess(false, true).allowed, true);
  assert.equal(getFlightStartAccess(true, true).reason, "pro");
});

test("free pilots can start a flight only while an event is live", () => {
  assert.deepEqual(getFlightStartAccess(true, false), {
    allowed: true,
    reason: "event_live",
    eventLive: true,
  });
  assert.deepEqual(getFlightStartAccess(false, false), {
    allowed: false,
    reason: "no_event",
    eventLive: false,
  });
});
