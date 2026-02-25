import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup stale active trackers",
  { minutes: 2 },
  internal.activeTrackers.cleanupStale,
);

crons.daily(
  "deactivate expired challenges",
  { hourUTC: 0, minuteUTC: 5 },
  internal.challenges.deactivateExpired,
);

export default crons;
