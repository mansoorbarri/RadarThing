import assert from "node:assert/strict";
import test from "node:test";
import {
  canStartFreeTrial,
  getEffectiveAccessRole,
  hasEffectiveProAccess,
} from "./proAccess";

const now = 1_800_000_000_000;

test("an active no-card trial grants PRO until it ends", () => {
  const user = {
    role: "FREE" as const,
    trialStartedAt: now,
    trialEndsAt: now + 1000,
  };
  assert.equal(hasEffectiveProAccess(user, now), true);
  assert.equal(getEffectiveAccessRole(user, now), "PRO");
  assert.equal(hasEffectiveProAccess(user, now + 1000), false);
});

test("banned users lose trial access", () => {
  const user = {
    role: "FREE" as const,
    trialEndsAt: now + 1000,
    activeBanId: "ban",
  };
  assert.equal(hasEffectiveProAccess(user, now), false);
});

test("only FREE users who never trialed or subscribed can start a trial", () => {
  assert.equal(canStartFreeTrial({ role: "FREE" }, now), true);
  assert.equal(canStartFreeTrial({ role: "PRO" }, now), false);
  assert.equal(
    canStartFreeTrial({ role: "FREE", trialStartedAt: now - 1 }, now),
    false,
  );
  assert.equal(
    canStartFreeTrial({ role: "FREE", stripeSubscriptionId: "sub_1" }, now),
    false,
  );
  assert.equal(
    canStartFreeTrial({ role: "FREE", adminProExpiresAt: now + 1 }, now),
    false,
  );
  assert.equal(canStartFreeTrial(null, now), false);
});
