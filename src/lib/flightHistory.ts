export const FLIGHT_HISTORY_PAGE_SIZE = 10;
export const FREE_RECENT_FLIGHTS_LIMIT = FLIGHT_HISTORY_PAGE_SIZE;

export const FLIGHT_HISTORY_STATUS_FILTERS = [
  "all",
  "completed",
  "in_progress",
] as const;

export type FlightHistoryStatusFilter =
  (typeof FLIGHT_HISTORY_STATUS_FILTERS)[number];

export const FLIGHT_HISTORY_REPLAY_FILTERS = [
  "all",
  "replayable",
  "non_replayable",
] as const;

export type FlightHistoryReplayFilter =
  (typeof FLIGHT_HISTORY_REPLAY_FILTERS)[number];
