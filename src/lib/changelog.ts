export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "new" | "improvement" | "fix";
}

export const changelog: ChangelogEntry[] = [
  {
    id: "live-flight-paths",
    date: "2026-03-23",
    title: "Mid-Flight Route Viewing",
    description:
      "Selected flights can now expose the route flown so far before landing, so you no longer have to wait for a flight to end to inspect its track.",
    type: "improvement",
  },
  {
    id: "military-helicopter-icons",
    date: "2026-03-21",
    title: "Military and Helicopter Icons",
    description:
      "Military aircraft now use the A6 marker silhouette on the radar, and helicopters use the A7 silhouette.",
    type: "improvement",
  },
  {
    id: "aircraft-class-icons",
    date: "2026-03-20",
    title: "Aircraft Class Icons",
    description:
      "Live aircraft on the radar now use different marker silhouettes for classes like light, regional, heavy, super, business, and military traffic.",
    type: "improvement",
  },
  {
    id: "leaderboard-contributions-tab",
    date: "2026-03-18",
    title: "Contribution Leaderboard",
    description:
      "The leaderboard now includes a Contribution tab so you can rank users by approved aircraft image contributions.",
    type: "new",
  },
  {
    id: "display-units-customizer",
    date: "2026-03-08",
    title: "Display Units Customizer",
    description:
      "Choose your preferred units in Radar Configuration. Switch speed between knots and Mach, and altitude between feet, flight levels, or auto. Upload Aircraft Images has also moved to the dock for easier access.",
    type: "new",
  },
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
