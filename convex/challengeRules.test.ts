import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countUniqueVisitedTargetAirports,
  doesFlightCollectionMatchChallenge,
} from "./lib/challengeRules";

const windowStart = 1_700_000_000_000;
const windowEnd = windowStart + 7 * 24 * 60 * 60 * 1000;

test("counts unique visited target airports only once", () => {
  const flights = [
    {
      aircraftType: "A320",
      depICAO: "KJFK",
      arrICAO: "EGLL",
      startTime: windowStart,
    },
    {
      aircraftType: "A320",
      depICAO: "EGLL",
      arrICAO: "LFPG",
      startTime: windowStart + 1,
    },
    {
      aircraftType: "A320",
      depICAO: "EHAM",
      arrICAO: "EDDF",
      startTime: windowStart + 2,
    },
  ];

  assert.equal(
    countUniqueVisitedTargetAirports(flights, ["egll", "lfpg", "eham"]),
    3,
  );
});

test("visit_airport_list challenge completes against target airport set", () => {
  const challenge = {
    mode: "auto" as const,
    ruleType: "visit_airport_list" as const,
    scope: "challenge" as const,
    targetAirports: ["EGLL", "LFPG", "EHAM"],
    requiredAirportCount: 3,
    startAt: windowStart,
    endAt: windowEnd,
    isPublished: true,
  };

  const flights = [
    {
      aircraftType: "A320",
      depICAO: "KJFK",
      arrICAO: "EGLL",
      startTime: windowStart,
    },
    {
      aircraftType: "A320",
      depICAO: "EGLL",
      arrICAO: "LFPG",
      startTime: windowStart + 1,
    },
    {
      aircraftType: "A320",
      depICAO: "EHAM",
      arrICAO: "EDDF",
      startTime: windowStart + 2,
    },
  ];

  assert.equal(doesFlightCollectionMatchChallenge(challenge, flights), true);
});
