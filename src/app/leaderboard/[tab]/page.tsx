import { notFound } from "next/navigation";

import LeaderboardClient from "../LeaderboardClient";
import { isLeaderboardTab, tabToSortKey } from "../leaderboardTabs";

export default async function LeaderboardTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;

  if (!isLeaderboardTab(tab)) {
    notFound();
  }

  return <LeaderboardClient initialSort={tabToSortKey(tab)} />;
}
