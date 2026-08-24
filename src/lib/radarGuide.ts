export type RadarGuideEligibility = boolean | undefined;

export function shouldOpenRadarGuide({
  isAppReady,
  shouldReplay,
  eligibility,
  hasOpened,
}: {
  isAppReady: boolean;
  shouldReplay: boolean;
  eligibility: RadarGuideEligibility;
  hasOpened: boolean;
}) {
  return (
    isAppReady &&
    eligibility !== undefined &&
    (shouldReplay || eligibility) &&
    !hasOpened
  );
}

export function completeRadarGuideIfEligible(
  eligibility: RadarGuideEligibility,
  completeRadarGuide: () => Promise<unknown>,
) {
  return eligibility === true ? completeRadarGuide() : undefined;
}
