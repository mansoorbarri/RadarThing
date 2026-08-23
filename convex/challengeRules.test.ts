import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countUniqueVisitedTargetAirports,
  doesFlightCollectionMatchChallenge,
  doesFlightMatchChallenge,
} from "./lib/challengeRules";
import { getAircraftCategories } from "../src/lib/aircraftCategories";

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

test("maximum duration is inclusive and rejects missing duration data", () => {
  const challenge = {
    mode: "auto" as const,
    ruleType: "max_duration" as const,
    scope: "each_flight" as const,
    maxDurationMinutes: 90,
    startAt: windowStart,
    endAt: windowEnd,
  };

  assert.equal(
    doesFlightMatchChallenge(challenge, {
      aircraftType: "A320",
      startTime: windowStart,
      duration: 90 * 60 * 1000,
    }),
    true,
  );
  assert.equal(
    doesFlightMatchChallenge(challenge, {
      aircraftType: "A320",
      startTime: windowStart,
    }),
    false,
  );
});

test("maximum distance is inclusive and rejects missing route data", () => {
  const challenge = {
    mode: "auto" as const,
    ruleType: "max_distance" as const,
    scope: "each_flight" as const,
    maxDistanceNm: 61,
    startAt: windowStart,
    endAt: windowEnd,
  };

  assert.equal(
    doesFlightMatchChallenge(challenge, {
      aircraftType: "A320",
      startTime: windowStart,
      routeData: [
        [0, 0],
        [0, 1],
      ],
    }),
    true,
  );
  assert.equal(
    doesFlightMatchChallenge(challenge, {
      aircraftType: "A320",
      startTime: windowStart,
    }),
    false,
  );
});

test("maximum rules filter the flights counted by an aggregate goal", () => {
  const challenge = {
    mode: "auto" as const,
    ruleType: "flight_count" as const,
    rules: [
      {
        ruleType: "flight_count" as const,
        scope: "challenge" as const,
        requiredFlightCount: 2,
      },
      {
        ruleType: "max_duration" as const,
        scope: "each_flight" as const,
        maxDurationMinutes: 60,
      },
    ],
    requiredFlightCount: 2,
    startAt: windowStart,
    endAt: windowEnd,
    isPublished: true,
  };
  const flight = (offset: number, minutes: number) => ({
    aircraftType: "A320",
    startTime: windowStart + offset,
    duration: minutes * 60 * 1000,
  });

  assert.equal(
    doesFlightCollectionMatchChallenge(challenge, [
      flight(1, 45),
      flight(2, 60),
      flight(3, 90),
    ]),
    true,
  );
  assert.equal(
    doesFlightCollectionMatchChallenge(challenge, [
      flight(1, 45),
      flight(2, 90),
    ]),
    false,
  );
});

test("aircraft categories overlap and match any selected category", () => {
  assert.deepEqual(getAircraftCategories("Airbus A320"), [
    "airbus",
    "commercial",
  ]);
  assert.deepEqual(getAircraftCategories("ATR 72-600"), [
    "commercial",
    "turboprop",
  ]);
  assert.deepEqual(getAircraftCategories("UH-60 helicopter"), [
    "military",
    "helicopter",
  ]);
  assert.ok(getAircraftCategories("Cessna 172").includes("general_aviation"));

  assert.equal(
    doesFlightMatchChallenge(
      {
        mode: "auto",
        ruleType: "aircraft_category",
        scope: "each_flight",
        targetAircraftCategories: ["boeing", "turboprop"],
        startAt: windowStart,
        endAt: windowEnd,
      },
      {
        aircraftType: "ATR72",
        startTime: windowStart,
      },
    ),
    true,
  );
});
