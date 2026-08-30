import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTelephonyCallsign,
  getAirlineDesignator,
  getIcaoAirlineDesignator,
} from "./airlineTelephony";

test("extracts ICAO airline designators", () => {
  assert.equal(getAirlineDesignator("BAW123"), "BAW");
  assert.equal(getIcaoAirlineDesignator("BAW123"), "BAW");
});

test("extracts alphabetic IATA airline designators", () => {
  assert.equal(getAirlineDesignator("BA123"), "BA");
});

test("extracts alphanumeric IATA airline designators", () => {
  assert.equal(getAirlineDesignator("U2123"), "U2");
  assert.equal(getAirlineDesignator("5J123"), "5J");
});

test("does not treat a numeric prefix as an airline designator", () => {
  assert.equal(getAirlineDesignator("12123"), null);
});

test("formats radio callsigns for ICAO and IATA flight numbers", () => {
  assert.equal(formatTelephonyCallsign("BAW123", "Speedbird"), "SPEEDBIRD 123");
  assert.equal(formatTelephonyCallsign("BA123", "Speedbird"), "SPEEDBIRD 123");
  assert.equal(formatTelephonyCallsign("U2123", "Easy"), "EASY 123");
});
