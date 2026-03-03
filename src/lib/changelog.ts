export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "new" | "improvement" | "fix";
}

export const changelog: ChangelogEntry[] = [
  {
    id: "shareable-flight-cards",
    date: "2026-03-03",
    title: "Shareable Flight Cards",
    description:
      "PRO users can now generate beautiful flight summary card images from their flight history. Perfect for sharing your flights on Discord and social media.",
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
