export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "new" | "improvement" | "fix";
}

export const changelog: ChangelogEntry[] = [
  {
    id: "console-loader-install",
    date: "2026-04-16",
    title: "Console Install Option",
    description:
      "RadarThing can now be launched from a console snippet that uses the same hosted loader as the Tampermonkey install.",
    type: "new",
  },
  {
    id: "shortcuts-menu",
    date: "2026-04-12",
    title: "Shortcut Reference Menu",
    description:
      "The radar dock now includes a Shortcuts menu so you can quickly see the available keyboard and mouse controls.",
    type: "new",
  },
  {
    id: "virtual-airlines",
    date: "2026-04-04",
    title: "VAs are now supported!",
    description: "Message @xyzmani on Discord to register yours!",
    type: "new",
  },
  {
    id: "controller-ident-requests",
    date: "2026-04-03",
    title: "Controller IDENT Requests",
    description: "Update your userscript for the new pilot IDENT UI.",
    type: "new",
  },
  {
    id: "replay-hides-live-traffic",
    date: "2026-04-02",
    title: "Cleaner Flight Replays",
    description:
      "Live traffic is now hidden while you replay a flight, so the route playback stays isolated from current radar traffic.",
    type: "fix",
  },
  {
    id: "free-us-airport-charts",
    date: "2026-03-31",
    title: "US Airport Charts Are Now Free",
    description:
      "Airport charts for US airports are now available to every user on the radar without a PRO subscription.",
    type: "improvement",
  },
  {
    id: "sidebar-nav-waypoint-controls",
    date: "2026-03-29",
    title: "Sidebar NAV and Waypoint Controls",
    description:
      "Your own aircraft sidebar now lets you switch between NAV and HDG mode, and NAV mode can retarget a specific waypoint from the active flight plan.",
    type: "improvement",
  },
  {
    id: "heading-mode-keybind",
    date: "2026-03-28",
    title: "Heading Mode Keybind",
    description:
      "You can now press T on the radar to enter Heading Mode without clicking the map control.",
    type: "improvement",
  },
  {
    id: "discord-waypoint-reminders",
    date: "2026-03-23",
    title: "Discord Waypoint Reminders",
    description:
      "You can now use the Discord bot to schedule waypoint reminders for your live flight and get pinged on your chosen interval after the trigger point.",
    type: "new",
  },
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

const CURRENT_CHANGELOG_MONTH = new Date().toISOString().slice(0, 7);

export const currentMonthChangelog = changelog.filter((entry) =>
  entry.date.startsWith(CURRENT_CHANGELOG_MONTH),
);

export const CURRENT_CHANGELOG_MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${CURRENT_CHANGELOG_MONTH}-01T00:00:00Z`));

export const LATEST_CHANGELOG_ID = currentMonthChangelog[0]?.id ?? null;
