import assert from "node:assert/strict";
import test from "node:test";
import { getRtDayFlightTotals } from "./flights";

const run = (
  getRtDayFlightTotals as unknown as {
    _handler: (
      ctx: unknown,
      args: unknown,
    ) => Promise<{
      page: { included: boolean; distanceNm: number; durationMs: number }[];
      isDone: boolean;
      continueCursor: string;
    }>;
  }
)._handler;

test("RT Day totals use UTC boundaries, exclude ineligible flights, and expose aggregates only", async () => {
  const boundaries: unknown[] = [];
  const range = {
    gte(field: string, value: number) {
      boundaries.push([field, value]);
      return range;
    },
    lt(field: string, value: number) {
      boundaries.push([field, value]);
      return range;
    },
  };
  const flight = {
    userId: "private",
    callsign: "TEST",
    aircraftType: "A320",
    startTime: Date.UTC(2026, 10, 14, 12),
    duration: 3600000,
    routeData: [
      [0, 0],
      [0, 1],
    ],
  };
  const ctx = {
    db: {
      query(table: string) {
        assert.equal(table, "flights");
        return {
          withIndex(name: string, build: (q: typeof range) => unknown) {
            assert.equal(name, "by_startTime");
            build(range);
            return {
              async paginate(options: { numItems: number }) {
                assert.equal(options.numItems, 20);
                return await Promise.resolve({
                  page: [
                    flight,
                    { ...flight, statsExcludedReason: "moderated" },
                    { ...flight, maxSpeed: 2000 },
                  ],
                  isDone: true,
                  continueCursor: "",
                });
              },
            };
          },
        };
      },
    },
  };
  const result = await run(ctx, {
    year: 2026,
    paginationOpts: { numItems: 200, cursor: null },
  });
  assert.deepEqual(boundaries, [
    ["startTime", Date.UTC(2026, 10, 14)],
    ["startTime", Date.UTC(2026, 10, 15)],
  ]);
  assert.equal(result.page[0]?.durationMs, 3600000);
  assert.ok((result.page[0]?.distanceNm ?? 0) > 59);
  assert.deepEqual(Object.keys(result.page[0]).sort(), [
    "distanceNm",
    "durationMs",
    "included",
  ]);
  assert.deepEqual(result.page.slice(1), [
    { included: false, distanceNm: 0, durationMs: 0 },
    { included: false, distanceNm: 0, durationMs: 0 },
  ]);
});

test("invalid event years are rejected before reading the database", async () => {
  await assert.rejects(
    () =>
      run({}, { year: 2026.5, paginationOpts: { numItems: 20, cursor: null } }),
    /Invalid RT Day year/,
  );
});
