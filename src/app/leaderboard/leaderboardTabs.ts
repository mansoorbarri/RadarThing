export const leaderboardTabs = [
  "flights",
  "distance",
  "time",
  "streak",
  "contribution",
  "challenge",
] as const;

export type LeaderboardTab = (typeof leaderboardTabs)[number];

export type SortKey =
  | "flights"
  | "distance"
  | "time"
  | "streak"
  | "contribution"
  | "challenges";

export function isLeaderboardTab(tab: string): tab is LeaderboardTab {
  return leaderboardTabs.includes(tab as LeaderboardTab);
}

export function tabToSortKey(tab: LeaderboardTab): SortKey {
  return tab === "challenge" ? "challenges" : tab;
}

export function sortKeyToTab(sortKey: SortKey): LeaderboardTab {
  return sortKey === "challenges" ? "challenge" : sortKey;
}

export function getLeaderboardTabHref(sortKey: SortKey) {
  return `/leaderboard/${sortKeyToTab(sortKey)}`;
}
