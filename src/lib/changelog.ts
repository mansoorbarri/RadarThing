export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "new" | "improvement" | "fix";
}

export const changelog: ChangelogEntry[] = [
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
