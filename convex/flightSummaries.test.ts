import assert from "node:assert/strict";
import { test } from "node:test";
import { getFlightHistoryPage, getStatsByClerkId } from "./flights";
import { collectFlightSummaries } from "./lib/flightSummaries";
import { FREE_RECENT_FLIGHTS_LIMIT } from "../src/lib/flightHistory";
import {
  calculateRouteDistanceNm,
  doesFlightCollectionMatchChallenge,
  doesFlightMatchChallenge,
  type ChallengeRule,
} from "./lib/challengeRules";

const startTime = Date.UTC(2026, 8, 1);
const routeData = [
  [0, 0],
  [0, 1],
];
const flight = {
  _id: "flight-1",
  userId: "user-1",
  callsign: "TEST123",
  aircraftType: "A320",
  depICAO: "EGLL",
  arrICAO: "LFPG",
  startTime,
  duration: 60_000,
  routeData,
};

async function* iterate<Flight>(flights: Flight[]) {
  for (const entry of flights) {
    yield await Promise.resolve(entry);
  }
}

function mockContext(flights = [flight], role = "PRO", stats: unknown = null) {
  const user = { _id: "user-1", clerkId: "clerk-1", role };
  return {
    auth: {
      getUserIdentity: async () => Promise.resolve({ subject: "clerk-1" }),
    },
    db: {
      get: async () => Promise.resolve(user),
      query(table: string) {
        return {
          withIndex() {
            return this;
          },
          order() {
            return this;
          },
          first: async () => Promise.resolve(table === "users" ? user : stats),
          collect() {
            throw new Error("Flight queries must not collect route traces");
          },
          [Symbol.asyncIterator]() {
            return iterate(flights);
          },
        };
      },
    },
  };
}

function callHandler<Result>(registered: unknown, ctx: unknown, args: unknown) {
  return (
    registered as {
      _handler: (ctx: unknown, args: unknown) => Promise<Result>;
    }
  )._handler(ctx, args);
}

test("large histories retain metadata and exact distances without route traces", async () => {
  async function* largeHistory() {
    for (let index = 0; index < 200; index++) {
      yield await Promise.resolve({
        ...flight,
        _id: `flight-${index}`,
        routeData: Array.from({ length: 4000 }, (_, pointIndex) => [
          0,
          pointIndex / 4000,
          30000,
          450,
          90,
          0,
          startTime + pointIndex,
        ]),
      });
    }
  }
  const summaries = await collectFlightSummaries(largeHistory());
  assert.equal(summaries.length, 200);
  assert.ok(summaries.every((summary) => !("routeData" in summary)));
  assert.ok(summaries.every((summary) => summary.hasRouteData));
  assert.ok(summaries.every((summary) => summary.distanceNm > 59));
  assert.ok(JSON.stringify(summaries).length < 100_000);
});

test("summaries preserve distance rules, including missing and zero-distance routes", async () => {
  const routes = [
    undefined,
    [],
    [[0, 0]],
    [
      [0, 0],
      [0, 0],
    ],
    routeData,
    [
      [null, 1],
      [0, 1],
    ],
  ];
  const flights = routes.map((route) => ({ ...flight, routeData: route }));
  const summaries = await collectFlightSummaries(iterate(flights));
  for (const scope of ["each_flight", "challenge"] as const) {
    for (const ruleType of ["min_distance", "max_distance"] as const) {
      const challenge: ChallengeRule = {
        mode: "auto",
        ruleType,
        scope,
        minDistanceNm: 50,
        maxDistanceNm: 100,
        startAt: startTime,
        endAt: startTime + 86400_000,
        isPublished: true,
      };
      for (const [index, entry] of flights.entries()) {
        const summary = summaries[index];
        assert.ok(summary, `Missing flight summary at index ${index}`);
        assert.equal(
          doesFlightMatchChallenge(challenge, summary),
          doesFlightMatchChallenge(challenge, entry),
        );
      }
      assert.equal(
        doesFlightCollectionMatchChallenge(challenge, summaries),
        doesFlightCollectionMatchChallenge(challenge, flights),
      );
    }
  }
});

test("dashboard stats preserve fallback totals and exclude excessive speeds", async () => {
  const stats = await callHandler<{
    totalFlights: number;
    totalFlightTimeMs: number;
    totalDistanceNm: number;
    uniqueAirports: number;
    topAircraft: { name: string; count: number }[];
  }>(
    getStatsByClerkId,
    mockContext([
      flight,
      { ...flight, _id: "flight-2", maxSpeed: 900 } as typeof flight,
    ]),
    { clerkId: "clerk-1" },
  );
  assert.equal(stats.totalFlights, 1);
  assert.equal(stats.totalFlightTimeMs, flight.duration);
  assert.equal(
    stats.totalDistanceNm,
    Math.round(calculateRouteDistanceNm(routeData)),
  );
  assert.equal(stats.uniqueAirports, 2);
  assert.deepEqual(stats.topAircraft, [{ name: "A320", count: 1 }]);
});

test("dashboard stats continue to use stored aggregate totals", async () => {
  const stats = await callHandler<{
    totalFlights: number;
    totalDistanceNm: number;
  }>(
    getStatsByClerkId,
    mockContext([flight], "PRO", {
      totalFlights: 99,
      totalDistanceNm: 1234,
      totalFlightTimeMs: 5678,
    }),
    { clerkId: "clerk-1" },
  );
  assert.equal(stats.totalFlights, 99);
  assert.equal(stats.totalDistanceNm, 1234);
});

test("history keeps PRO access, free limits and counts without returning routes", async () => {
  const flights = Array.from({ length: 25 }, (_, index) => ({
    ...flight,
    _id: `flight-${index}`,
  }));
  for (const role of ["FREE", "PRO"]) {
    const history = await callHandler<{
      flights: { id: string; hasRouteData: boolean }[];
      totalRecordedFlights: number;
      hiddenFlightCount: number;
    }>(getFlightHistoryPage, mockContext(flights, role), { userId: "user-1" });
    assert.equal(history.totalRecordedFlights, 25);
    assert.equal(history.flights.length + history.hiddenFlightCount, 25);
    assert.equal(
      history.flights.length,
      role === "PRO" ? 25 : FREE_RECENT_FLIGHTS_LIMIT,
    );
    assert.ok(
      history.flights.every(
        (entry) => entry.hasRouteData && !("routeData" in entry),
      ),
    );
  }
});
