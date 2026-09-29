import assert from "node:assert/strict";
import test from "node:test";
import {
  validRtDayAircraft,
  RT_DAY_RECORD,
  RT_DAY_TARGET,
} from "./rtDayTelemetry";
import type { PositionUpdate } from "./aircraft-store";

const now = Date.UTC(2026, 10, 14, 12);
const position = (overrides: Partial<PositionUpdate> = {}) =>
  ({ lat: 51, lon: -1, ts: now, ...overrides }) as PositionUpdate;

test("stale, invalid and future-dated positions cannot inflate the record count", () => {
  assert.equal(validRtDayAircraft(position(), now), true);
  assert.equal(validRtDayAircraft(position({ ts: now - 30_001 }), now), false);
  assert.equal(validRtDayAircraft(position({ ts: now + 5001 }), now), false);
  for (const overrides of [
    { lat: NaN },
    { lon: Infinity },
    { lat: 91 },
    { lon: -181 },
    { ts: NaN },
  ]) {
    assert.equal(validRtDayAircraft(position(overrides), now), false);
  }
  assert.equal(validRtDayAircraft(position({ lat: 0, lon: 0 }), now), true);
});

test("matching 50 flights does not break the record", () => {
  assert.equal(RT_DAY_RECORD, 50);
  assert.equal(RT_DAY_TARGET, 51);
});
