import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { clear, getRoute, list, replaceAll } from "./activeFlightSessions";

const SYSTEM_SECRET = "test-system-secret";

interface ActiveFlightSessionDoc {
  _id: string;
  _creationTime: number;
  userId: string;
  state: "active" | "disconnected";
  originalId: string;
  session: unknown;
  disconnectedAt?: number;
  updatedAt: number;
  routeVersion?: string;
  routePointCount?: number;
}

interface LiveHourDoc {
  hourStart: number;
  peak: number;
  sampleSum: number;
  sampleCount: number;
  last: number;
}

type PersistedSession = Omit<
  ActiveFlightSessionDoc,
  "_id" | "_creationTime" | "updatedAt"
>;

function session(
  userId: string,
  state: "active" | "disconnected" = "active",
): PersistedSession {
  return {
    userId,
    state,
    originalId: `aircraft-${userId}`,
    session: { userId, state },
    disconnectedAt: state === "disconnected" ? 123 : undefined,
  };
}

interface RouteChunkDoc {
  _id: string;
  userId: string;
  routeVersion: string;
  startIndex: number;
  coords: unknown[];
}

function createMockCtx(initialDocs: ActiveFlightSessionDoc[] = []) {
  let nextId = initialDocs.length + 1;
  const docs = initialDocs.map((doc) => ({ ...doc }));
  const liveHours: (LiveHourDoc & { _id: string })[] = [];
  const chunks: RouteChunkDoc[] = [];
  const tables: Record<string, { _id: string }[]> = {
    activeFlightSessions: docs,
    activeFlightRouteChunks: chunks,
    telemetryLiveHours: liveHours,
  };

  const db = {
    get(id: string) {
      return Promise.resolve({ _id: id, isDeleted: false });
    },
    query(tableName: string) {
      const rows = tables[tableName];
      assert.ok(rows, `unexpected table ${tableName}`);
      const filters: [string, unknown][] = [];

      const builder = {
        withIndex(_indexName: string, predicate?: (q: unknown) => unknown) {
          const index = {
            eq(field: string, value: unknown) {
              filters.push([field, value]);
              return index;
            },
          };
          predicate?.(index);
          return builder;
        },
        collect() {
          return Promise.resolve(
            rows.filter((row) =>
              filters.every(
                ([field, value]) =>
                  (row as Record<string, unknown>)[field] === value,
              ),
            ),
          );
        },
        async first() {
          return (await builder.collect())[0] ?? null;
        },
        async take(limit: number) {
          return (await builder.collect()).slice(0, limit);
        },
      };
      return builder;
    },
    insert(tableName: string, value: Record<string, unknown>) {
      const rows = tables[tableName];
      assert.ok(rows, `unexpected table ${tableName}`);
      const _id = `doc-${nextId++}`;
      rows.push({ _id, _creationTime: Date.now(), ...value } as never);
      return Promise.resolve(_id);
    },
    patch(_id: string, value: Record<string, unknown>) {
      const row = Object.values(tables)
        .flat()
        .find((candidate) => candidate._id === _id);
      assert.ok(row);
      // Convex patch removes fields set to undefined.
      for (const [key, fieldValue] of Object.entries(value)) {
        if (fieldValue === undefined) {
          delete (row as Record<string, unknown>)[key];
        } else {
          (row as Record<string, unknown>)[key] = fieldValue;
        }
      }
      return Promise.resolve();
    },
    delete(_id: string) {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex((candidate) => candidate._id === _id);
        if (index !== -1) {
          rows.splice(index, 1);
          return Promise.resolve();
        }
      }
      assert.fail(`missing document ${_id}`);
    },
  };

  return {
    ctx: { db },
    docs,
    chunks,
    liveHours,
  };
}

async function callHandler<T>(
  fn: { _handler: (ctx: unknown, args: unknown) => Promise<T> },
  ctx: unknown,
  args: Record<string, unknown>,
) {
  return await fn._handler(ctx, {
    ...args,
    systemSecret: SYSTEM_SECRET,
  });
}

beforeEach(() => {
  process.env.CONVEX_SYSTEM_SECRET = SYSTEM_SECRET;
});

test("list returns a bounded active session set", async () => {
  const { ctx } = createMockCtx([
    { _id: "doc-1", _creationTime: 1, updatedAt: 1, ...session("user-1") },
    { _id: "doc-2", _creationTime: 2, updatedAt: 2, ...session("user-2") },
  ]);

  const result = await callHandler<ActiveFlightSessionDoc[]>(
    list as never,
    ctx,
    {
      limit: 1,
    },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.userId, "user-1");
});

test("replaceAll patches existing sessions, inserts new sessions, and deletes missing users", async () => {
  const { ctx, docs } = createMockCtx([
    { _id: "doc-1", _creationTime: 1, updatedAt: 1, ...session("user-1") },
    { _id: "doc-2", _creationTime: 2, updatedAt: 2, ...session("user-3") },
  ]);

  const result = await callHandler(replaceAll as never, ctx, {
    sessions: [session("user-1", "disconnected"), session("user-2")],
  });

  assert.deepEqual(result, { saved: 2, deleted: 1, resync: [] });
  assert.deepEqual(docs.map((doc) => [doc.userId, doc.state]).sort(), [
    ["user-1", "disconnected"],
    ["user-2", "active"],
  ]);
});

test("replaceAll records live flight samples into the current hour bucket", async () => {
  const { ctx, liveHours } = createMockCtx();

  await callHandler(replaceAll as never, ctx, {
    sessions: [session("user-1"), session("user-2"), session("user-3")],
  });
  await callHandler(replaceAll as never, ctx, {
    sessions: [session("user-1"), session("user-2", "disconnected")],
  });

  assert.equal(liveHours.length, 1);
  assert.equal(liveHours[0]?.peak, 3);
  assert.equal(liveHours[0]?.last, 1);
  assert.equal(liveHours[0]?.sampleSum, 4);
  assert.equal(liveHours[0]?.sampleCount, 2);
});

test("replaceAll processes duplicate incoming userIds once", async () => {
  const { ctx, docs } = createMockCtx();

  const result = await callHandler(replaceAll as never, ctx, {
    sessions: [session("user-1"), session("user-1", "disconnected")],
  });

  assert.deepEqual(result, { saved: 1, deleted: 0, resync: [] });
  assert.equal(docs.length, 1);
  assert.equal(docs[0]?.state, "disconnected");
});

test("replaceAll with an empty sessions array clears all active session rows", async () => {
  const { ctx, docs } = createMockCtx([
    { _id: "doc-1", _creationTime: 1, updatedAt: 1, ...session("user-1") },
    { _id: "doc-2", _creationTime: 2, updatedAt: 2, ...session("user-2") },
  ]);

  const result = await callHandler(replaceAll as never, ctx, { sessions: [] });

  assert.deepEqual(result, { saved: 0, deleted: 2, resync: [] });
  assert.deepEqual(docs, []);
});

test("clear deletes only targeted userIds when provided", async () => {
  const { ctx, docs } = createMockCtx([
    { _id: "doc-1", _creationTime: 1, updatedAt: 1, ...session("user-1") },
    { _id: "doc-2", _creationTime: 2, updatedAt: 2, ...session("user-2") },
    { _id: "doc-3", _creationTime: 3, updatedAt: 3, ...session("user-3") },
  ]);

  const result = await callHandler(clear as never, ctx, {
    userIds: ["user-1", "user-3", "user-3"],
  });

  assert.deepEqual(result, { deleted: 2 });
  assert.deepEqual(
    docs.map((doc) => doc.userId),
    ["user-2"],
  );
});

function routed(
  userId: string,
  version: string,
  startIndex: number,
  coords: number[][],
) {
  return { ...session(userId), route: { version, startIndex, coords } };
}

test("replaceAll stores routes as appended chunks and getRoute reassembles them", async () => {
  const { ctx, docs, chunks } = createMockCtx();

  await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v1", 0, [[1, 1], [2, 2]])],
  });
  const result = await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v1", 2, [[3, 3]])],
  });
  await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v1", 3, [])],
  });

  assert.deepEqual(result, { saved: 1, deleted: 0, resync: [] });
  assert.equal(chunks.length, 2);
  assert.equal(docs[0]?.routePointCount, 3);
  assert.deepEqual(
    await callHandler(getRoute as never, ctx, { userId: "user-1" }),
    [
      [1, 1],
      [2, 2],
      [3, 3],
    ],
  );
});

test("replaceAll replaces old chunks when a route is resent in full", async () => {
  const { ctx, chunks } = createMockCtx();

  await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v1", 0, [[1, 1], [2, 2]])],
  });
  await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v1", 2, [[3, 3]])],
  });
  await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v2", 0, [[1, 1], [3, 3]])],
  });

  assert.equal(chunks.length, 1);
  assert.deepEqual(
    await callHandler(getRoute as never, ctx, { userId: "user-1" }),
    [
      [1, 1],
      [3, 3],
    ],
  );
});

test("replaceAll asks for a full resend when an append does not line up", async () => {
  const { ctx, docs, chunks } = createMockCtx();

  await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v1", 0, [[1, 1]])],
  });
  const wrongVersion = await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v2", 1, [[2, 2]])],
  });
  const gap = await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v1", 5, [[2, 2]])],
  });
  const missing = await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v1", 1, []), routed("user-2", "v1", 1, [])],
  });

  assert.deepEqual(wrongVersion, { saved: 1, deleted: 0, resync: ["user-1"] });
  assert.deepEqual(gap, { saved: 1, deleted: 0, resync: ["user-1"] });
  assert.deepEqual(missing, { saved: 2, deleted: 0, resync: ["user-2"] });
  assert.equal(chunks.length, 1);
  assert.equal(docs.find((doc) => doc.userId === "user-1")?.routePointCount, 1);
});

test("removing a session deletes its route chunks", async () => {
  const { ctx, docs, chunks } = createMockCtx();

  await callHandler(replaceAll as never, ctx, {
    sessions: [
      routed("user-1", "v1", 0, [[1, 1]]),
      routed("user-2", "v1", 0, [[2, 2]]),
    ],
  });
  await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-2", "v1", 1, [])],
  });
  assert.deepEqual(
    chunks.map((chunk) => chunk.userId),
    ["user-2"],
  );

  await callHandler(clear as never, ctx, { userIds: ["user-2"] });
  assert.deepEqual(chunks, []);
  assert.deepEqual(docs, []);
});

test("replaceAll without a route drops chunked storage for legacy callers", async () => {
  const { ctx, docs, chunks } = createMockCtx();

  await callHandler(replaceAll as never, ctx, {
    sessions: [routed("user-1", "v1", 0, [[1, 1]])],
  });
  await callHandler(replaceAll as never, ctx, {
    sessions: [session("user-1")],
  });

  assert.deepEqual(chunks, []);
  assert.equal(docs[0]?.routeVersion, undefined);
  assert.equal(
    await callHandler(getRoute as never, ctx, { userId: "user-1" }),
    null,
  );
});
