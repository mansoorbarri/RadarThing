"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "~/../convex/_generated/api";
import { toast } from "sonner";

const STORAGE_KEY = "contributor-reward-last-shown";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function ContributorRewardModal() {
  const { user, isLoaded } = useUser();
  const [hasShown, setHasShown] = useState(false);

  const clerkId = user?.id ?? "";

  const eligibility = useQuery(
    api.contributorRewards.checkEligibility,
    clerkId ? { clerkId } : "skip"
  );

  const claimReward = useMutation(api.contributorRewards.claimReward);

  useEffect(() => {
    if (hasShown || !isLoaded || !user || !eligibility) return;

    // Not eligible
    if (!eligibility.eligible || !eligibility.eligibleRewards?.length) return;

    // Check if shown today (once per day in prod)
    const lastShown = localStorage.getItem(STORAGE_KEY);
    if (lastShown) {
      const lastShownTime = parseInt(lastShown, 10);
      if (Date.now() - lastShownTime < ONE_DAY_MS) {
        return;
      }
    }

    // Claim the first eligible reward
    const rewardType = eligibility.eligibleRewards[0];
    if (!rewardType) return;

    setHasShown(true);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());

    void claimReward({ clerkId, rewardType });

    const rewardName =
      rewardType === "aircraftImages" ? "aircraft images" : "airport charts";

    toast.success(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">
          Congratulations! You&apos;re the first to hit 100 approved {rewardName}!
        </span>
        <span className="text-sm opacity-90">
          DM <span className="font-mono font-semibold">@xyzmani</span> on
          Discord to claim your free month of Pro!
        </span>
      </div>,
      {
        duration: Infinity,
        action: {
          label: "Got it!",
          onClick: () => {},
        },
      }
    );
  }, [hasShown, isLoaded, user, eligibility, claimReward, clerkId]);

  return null;
}
