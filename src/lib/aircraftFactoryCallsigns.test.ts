import assert from "node:assert/strict";
import test from "node:test";
import { getAircraftFactoryCallsignCandidates } from "./aircraftFactoryCallsigns";

test("maps Airbus aircraft to the AIB factory callsign", () => {
  assert.deepEqual(getAircraftFactoryCallsignCandidates("Airbus A380"), [
    "AIB",
  ]);
  assert.deepEqual(getAircraftFactoryCallsignCandidates("A388"), ["AIB"]);
});

test("maps Boeing aircraft to the BOE factory callsign", () => {
  assert.deepEqual(getAircraftFactoryCallsignCandidates("Boeing 777-300ER"), [
    "BOE",
  ]);
  assert.deepEqual(getAircraftFactoryCallsignCandidates("B738"), ["BOE"]);
});

test("maps regional jets to their factory callsigns", () => {
  assert.deepEqual(getAircraftFactoryCallsignCandidates("Embraer E190"), [
    "EMB",
  ]);
  assert.deepEqual(getAircraftFactoryCallsignCandidates("CRJ900"), ["BBA"]);
});

test("does not treat unrelated aircraft as Airbus or Boeing", () => {
  assert.deepEqual(getAircraftFactoryCallsignCandidates("Antonov AN-225"), []);
  assert.deepEqual(getAircraftFactoryCallsignCandidates("F-16"), []);
});
