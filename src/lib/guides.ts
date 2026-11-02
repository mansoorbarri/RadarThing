import { readFile } from "node:fs/promises";
import path from "node:path";

export const guideCategories = [
  "Getting started",
  "Using the radar",
  "Flying skills",
  "Community",
] as const;

export type GuideCategory = (typeof guideCategories)[number];

interface GuideEntry {
  slug: string;
  title: string;
  description: string;
  category: GuideCategory;
  /** ISO date (YYYY-MM-DD) of the last substantive content update. */
  updated: string;
}

// Keep this explicit: route parameters must never become arbitrary file paths.
export const guides = [
  {
    slug: "getting-started",
    title: "Getting started with RadarThing",
    description: "Install the tracker and find your first GeoFS flight.",
    category: "Getting started",
    updated: "2026-09-14",
  },
  {
    slug: "aircraft-not-appearing",
    title: "Aircraft not appearing on the radar",
    description: "Check sign-in, installation, filters, and your connection.",
    category: "Getting started",
    updated: "2026-09-14",
  },
  {
    slug: "using-the-radar",
    title: "Using the radar",
    description:
      "Find flights, read telemetry, follow aircraft, and explore map layers.",
    category: "Using the radar",
    updated: "2026-11-02",
  },
  {
    slug: "radar-tools-and-shortcuts",
    title: "Radar tools, keyboard shortcuts and presets",
    description:
      "Measure heading and distance, cycle the display, compare aircraft, and save layer presets.",
    category: "Using the radar",
    updated: "2026-11-02",
  },
  {
    slug: "altitude-flight-levels-and-units",
    title: "Altitude, flight levels, speed and time",
    description:
      "Feet versus flight levels, indicated airspeed versus Mach, Zulu time, and the route altitude colours.",
    category: "Using the radar",
    updated: "2026-11-02",
  },
  {
    slug: "traffic-conflict-alerts",
    title: "Traffic conflict alerts",
    description:
      "How RadarThing predicts loss of separation, what the alert colours mean, and what is filtered out.",
    category: "Using the radar",
    updated: "2026-11-02",
  },
  {
    slug: "flight-history-and-replay",
    title: "Flight history and replay",
    description:
      "Find recorded flights, understand access limits, and share a replay.",
    category: "Using the radar",
    updated: "2026-09-14",
  },
  {
    slug: "emergency-squawk-codes",
    title: "Emergency squawk codes: 7500, 7600 and 7700",
    description:
      "What each emergency transponder code means, how the radar highlights it, and how to practise responsibly.",
    category: "Flying skills",
    updated: "2026-11-02",
  },
  {
    slug: "reading-airport-charts",
    title: "Reading airport charts",
    description:
      "Ground diagrams, SIDs, STARs and approach charts explained, and how to open them beside the radar.",
    category: "Flying skills",
    updated: "2026-11-02",
  },
  {
    slug: "importing-flight-plans",
    title: "Importing and planning flight plans",
    description:
      "Preview a route on the map, read leg distance and time estimates, and file flights for events.",
    category: "Flying skills",
    updated: "2026-11-02",
  },
  {
    slug: "callsigns-and-airline-codes",
    title: "Callsigns and airline codes explained",
    description:
      "ICAO versus IATA codes, radio telephony callsigns, and how your callsign drives liveries and branding.",
    category: "Flying skills",
    updated: "2026-11-02",
  },
  {
    slug: "acars-flight-updates",
    title: "ACARS flight updates",
    description:
      "Publish short cockpit updates for radar viewers, and read or report updates from other pilots.",
    category: "Community",
    updated: "2026-11-02",
  },
  {
    slug: "leaderboards-streaks-and-challenges",
    title: "Leaderboards, streaks and challenges",
    description:
      "How stats are calculated, why a flight may not count, how UTC streaks work, and how to complete challenges.",
    category: "Community",
    updated: "2026-11-02",
  },
  {
    slug: "contributing-aircraft-images",
    title: "Contributing aircraft images",
    description:
      "How livery photos are matched to flights, and how to submit an image that gets approved.",
    category: "Community",
    updated: "2026-11-02",
  },
  {
    slug: "virtual-airlines",
    title: "Running a virtual airline",
    description:
      "Register your VA, choose a callsign prefix, manage your roster, and upload fleet images.",
    category: "Community",
    updated: "2026-11-02",
  },
] as const satisfies readonly GuideEntry[];

export type Guide = (typeof guides)[number];

export function getGuidesByCategory() {
  return guideCategories.map((category) => ({
    category,
    guides: guides.filter((guide) => guide.category === category),
  }));
}

export async function getGuide(slug: string) {
  const index = guides.findIndex((entry) => entry.slug === slug);
  const guide = guides[index];
  if (!guide) return null;
  const markdown = await readFile(
    path.join(process.cwd(), "content/guides", `${guide.slug}.md`),
    "utf8",
  );
  return {
    ...guide,
    markdown,
    previous: guides[index - 1] ?? null,
    next: guides[index + 1] ?? null,
  };
}
