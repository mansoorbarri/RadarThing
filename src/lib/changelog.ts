export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "new" | "improvement" | "fix";
}

export const changelog: ChangelogEntry[] = [
  {
    id: "pilot-challenges",
    date: "2026-02-25",
    title: "Pilot Challenges",
    description:
      "Compete in weekly and monthly pilot challenges! Track your progress on the dashboard, complete objectives like flying to specific regions or airports, and race to be the first to finish.",
    type: "new",
  },
  {
    id: "live-atc-indicator",
    date: "2025-02-25",
    title: "Live ATC on the radar",
    description:
      "Airports with active ATC from ATCThing now show a live green indicator directly on the map. Click it to join the controller's Discord.",
    type: "new",
  },
];

export const LATEST_CHANGELOG_ID = changelog[0]!.id;
