import assert from "node:assert/strict";
import test from "node:test";

import { getFlightDurationMs } from "./flightDuration";

test("prefers elapsed time when completed flight timestamps are present", () => {
  assert.equal(
    getFlightDurationMs({
      startTime: 1_000,
      endTime: 11_000,
      duration: 5_000,
    }),
    10_000,
  );
});

test("falls back to stored duration when endTime is missing", () => {
  assert.equal(
    getFlightDurationMs({
      startTime: 1_000,
      duration: 5_000,
    }),
    5_000,
  );
});

test("falls back to stored duration when startTime is missing", () => {
  assert.equal(
    getFlightDurationMs({
      duration: 5_000,
    }),
    5_000,
  );
});

test("falls back to stored duration when endTime is not after startTime", () => {
  assert.equal(
    getFlightDurationMs({
      startTime: 10_000,
      endTime: 9_000,
      duration: 5_000,
    }),
    5_000,
  );
});

test("clamps negative stored durations to zero", () => {
  assert.equal(
    getFlightDurationMs({
      startTime: 1_000,
      duration: -5_000,
    }),
    0,
  );
});

test("returns undefined when neither elapsed time nor duration is usable", () => {
  assert.equal(
    getFlightDurationMs({
      startTime: 1_000,
      endTime: 1_000,
    }),
    undefined,
  );
});
