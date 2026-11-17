import assert from "node:assert/strict";
import test from "node:test";
import { endTrial } from "./users";

const SUPER_ADMIN_GOOGLE_ID = "101233162035372298523";

interface Handler {
  _handler: (ctx: unknown, args: unknown) => Promise<unknown>;
}
const run = (fn: unknown, ctx: unknown, args: unknown) =>
  (fn as Handler)._handler(ctx, args);

type Doc = Record<string, unknown> & { _id: string };

function createCtx(docs: Doc[]) {
  const byId = new Map(docs.map((doc) => [doc._id, doc]));
  const inserted: Record<string, unknown>[] = [];

  return {
    inserted,
    byId,
    ctx: {
      auth: {
        getUserIdentity: () => Promise.resolve({ subject: "clerk-admin" }),
      },
      db: {
        get: (id: string) => Promise.resolve(byId.get(id) ?? null),
        patch: (id: string, value: Record<string, unknown>) => {
          Object.assign(byId.get(id)!, value);
          return Promise.resolve();
        },
        insert: (_table: string, value: Record<string, unknown>) => {
          inserted.push(value);
          return Promise.resolve("telemetry-id");
        },
        query: () => ({
          withIndex: (
            _name: string,
            build: (q: {
              eq: (field: string, value: unknown) => unknown;
            }) => unknown,
          ) => {
            let match: [string, unknown] | null = null;
            build({
              eq: (field, value) => {
                match = [field, value];
                return null;
              },
            });
            return {
              first: () =>
                Promise.resolve(
                  docs.find((doc) => match && doc[match[0]] === match[1]) ??
                    null,
                ),
            };
          },
        }),
      },
    },
  };
}

const admin = {
  _id: "admin",
  clerkId: "clerk-admin",
  googleId: SUPER_ADMIN_GOOGLE_ID,
  role: "ADMIN",
  email: "admin@example.com",
};

test("endTrial ends an active trial but keeps it marked as used", async () => {
  const now = Date.now();
  const trialUser = {
    _id: "trial",
    clerkId: "clerk-trial",
    email: "trial@example.com",
    role: "FREE",
    isDeleted: false,
    trialStartedAt: now - 1000,
    trialEndsAt: now + 60_000,
  };
  const { ctx, byId, inserted } = createCtx([admin, trialUser]);

  await run(endTrial, ctx, { id: "trial" });

  const updated = byId.get("trial")!;
  assert.ok((updated.trialEndsAt as number) <= Date.now());
  assert.equal(updated.trialStartedAt, now - 1000);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]?.action, "revoke_pro");
});

test("endTrial rejects users without an active trial", async () => {
  const freeUser = {
    _id: "free",
    clerkId: "clerk-free",
    email: "free@example.com",
    role: "FREE",
    isDeleted: false,
  };
  const { ctx } = createCtx([admin, freeUser]);

  await assert.rejects(run(endTrial, ctx, { id: "free" }), /no active trial/);
});
