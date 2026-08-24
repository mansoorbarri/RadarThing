import assert from "node:assert/strict";
import test from "node:test";

import {
  completeRadarGuideIfEligible,
  shouldOpenRadarGuide,
  type RadarGuideEligibility,
} from "./radarGuide";

test("URL replay waits for eligibility and persists an eligible completion", async () => {
  const query: { eligibility: RadarGuideEligibility } = {
    eligibility: undefined,
  };
  let completionCalls = 0;

  assert.equal(
    shouldOpenRadarGuide({
      isAppReady: true,
      shouldReplay: true,
      eligibility: query.eligibility,
      hasOpened: false,
    }),
    false,
  );

  query.eligibility = true;
  assert.equal(
    shouldOpenRadarGuide({
      isAppReady: true,
      shouldReplay: true,
      eligibility: query.eligibility,
      hasOpened: false,
    }),
    true,
  );

  await completeRadarGuideIfEligible(query.eligibility, () => {
    completionCalls += 1;
    return Promise.resolve();
  });
  assert.equal(completionCalls, 1);
});

test("URL replay still opens for resolved ineligible users without persisting", async () => {
  let completionCalls = 0;

  assert.equal(
    shouldOpenRadarGuide({
      isAppReady: true,
      shouldReplay: true,
      eligibility: false,
      hasOpened: false,
    }),
    true,
  );

  await completeRadarGuideIfEligible(false, () => {
    completionCalls += 1;
    return Promise.resolve();
  });
  assert.equal(completionCalls, 0);
});
