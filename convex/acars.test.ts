/* eslint-disable @typescript-eslint/require-await -- Async fixtures match Convex's database interface. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  registerDevice,
  publish,
  listPublic,
  listForDevice,
  postingStatus,
  remove,
  report,
  adminQueue,
  adminRemove,
  recordBlocked,
} from "./acars";

const googleId = "123456789012345678";
const tokenHash = "a".repeat(64);
const systemSecret = "test-acars-secret";

function fixture() {
  process.env.CONVEX_SYSTEM_SECRET = systemSecret;
  const tables: Record<string, any[]> = {
    users: [
      {
        _id: "pilot",
        clerkId: "pilot",
        googleId,
        role: "FREE",
        isDeleted: false,
      },
      { _id: "viewer", clerkId: "viewer", role: "FREE", isDeleted: false },
      { _id: "admin", clerkId: "admin", role: "ADMIN", isDeleted: false },
    ],
    acarsDevices: [],
    acarsMessages: [],
    acarsModerationEvents: [],
    acarsReports: [],
  };
  let sequence = 0;
  let actor = "viewer";
  const ctx: any = {
    auth: { getUserIdentity: async () => ({ subject: actor }) },
    db: {
      get: async (id: string) =>
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null,
      insert: async (table: string, value: any) => {
        const id = `record-${++sequence}`;
        (tables[table] ??= []).push({ ...value, _id: id });
        return id;
      },
      delete: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) rows.splice(index, 1);
        }
      },
      patch: async (id: string, value: any) => {
        const row = await ctx.db.get(id);
        assert.ok(row);
        Object.assign(row, value);
      },
      query: (table: string) => {
        let rows = [...(tables[table] ?? [])];
        const q: any = {
          withIndex: (_name: string, predicate?: (index: any) => unknown) => {
            const index: any = {
              eq: (field: string, value: unknown) => {
                rows = rows.filter((row) => row[field] === value);
                return index;
              },
            };
            predicate?.(index);
            return q;
          },
          order: (direction: string) => {
            rows.sort(
              (a, b) =>
                (a.createdAt - b.createdAt) * (direction === "desc" ? -1 : 1),
            );
            return q;
          },
          first: async () => rows[0] ?? null,
          take: async (count: number) => rows.slice(0, count),
          collect: async () => rows,
        };
        return q;
      },
    },
  };
  return {
    ctx,
    tables,
    as: (name: string) => {
      actor = name;
    },
  };
}

async function call<T>(
  fn: unknown,
  ctx: any,
  args: any,
): Promise<T> {
  return await (fn as { _handler: (context: any, values: any) => Promise<T> })._handler(ctx, args);
}

test("pilot entries require a registered device and trusted server mutation", async () => {
  const f = fixture();
  await assert.rejects(
    call(publish, f.ctx, {
      googleId,
      tokenHash,
      body: "Route update",
      systemSecret,
    }),
    /not registered/,
  );
  await assert.rejects(
    call(registerDevice, f.ctx, { googleId, tokenHash, systemSecret: "wrong" }),
    /Unauthorized/,
  );
  await call(registerDevice, f.ctx, { googleId, tokenHash, systemSecret });
  await assert.rejects(
    call(publish, f.ctx, {
      googleId,
      tokenHash,
      body: "Route update",
      systemSecret: "wrong",
    }),
    /Unauthorized/,
  );
  const id = await call<string>(publish, f.ctx, {
    googleId,
    tokenHash,
    body: "Route update",
    systemSecret,
  });
  assert.equal(
    (await call<any[]>(listPublic, f.ctx, { googleId }))[0].body,
    "Route update",
  );
  assert.equal(
    (await call<any[]>(listForDevice, f.ctx, { googleId, tokenHash }))[0]
      .canRemove,
    true,
  );
  assert.ok(
    (
      await call<{ retryAfter?: number }>(postingStatus, f.ctx, {
        googleId,
        tokenHash,
      })
    ).retryAfter,
  );
  await assert.rejects(
    call(publish, f.ctx, { googleId, tokenHash, body: "Again", systemSecret }),
    /Wait 30 seconds/,
  );
  await assert.rejects(
    call(remove, f.ctx, {
      googleId,
      tokenHash: "b".repeat(64),
      messageId: id,
      systemSecret,
    }),
    /not registered/,
  );
  await call(remove, f.ctx, {
    googleId,
    tokenHash,
    messageId: id,
    systemSecret,
  });
  assert.deepEqual(await call(listPublic, f.ctx, { googleId }), []);
});

test("existing account ban blocks ACARS publication and hides entries", async () => {
  const f = fixture();
  await call(registerDevice, f.ctx, { googleId, tokenHash, systemSecret });
  await call(publish, f.ctx, {
    googleId,
    tokenHash,
    body: "Before ban",
    systemSecret,
  });
  const pilot = f.tables.users?.[0];
  assert.ok(pilot);
  pilot.activeBanId = "ban";
  await assert.rejects(
    call(publish, f.ctx, {
      googleId,
      tokenHash,
      body: "After ban",
      systemSecret,
    }),
    /restricted/,
  );
  assert.deepEqual(await call(listPublic, f.ctx, { googleId }), []);
});

test("reported entries and blocked attempts appear in admin review", async () => {
  const f = fixture();
  await call(registerDevice, f.ctx, { googleId, tokenHash, systemSecret });
  const id = await call<string>(publish, f.ctx, {
    googleId,
    tokenHash,
    body: "Pilot update",
    systemSecret,
  });
  const reportId = await call<string>(report, f.ctx, {
    messageId: id,
    reason: "Misleading",
  });
  assert.equal(
    await call(report, f.ctx, { messageId: id, reason: "Duplicate" }),
    reportId,
  );
  await call(recordBlocked, f.ctx, {
    googleId,
    tokenHash,
    body: "Blocked sample",
    categories: ["harassment"],
    systemSecret,
  });
  await assert.rejects(call(adminQueue, f.ctx, {}), /Unauthorized/);
  f.as("admin");
  const queue = await call<any>(adminQueue, f.ctx, {});
  assert.equal(queue.reports[0].body, "Pilot update");
  assert.equal(queue.blocked[0].categories[0], "harassment");
  await call(adminRemove, f.ctx, { messageId: id });
  const afterRemoval = await call<any>(adminQueue, f.ctx, {});
  assert.equal(afterRemoval.reports[0].body, "Pilot update");
  assert.equal(afterRemoval.reports[0].isMessagePresent, false);
});
