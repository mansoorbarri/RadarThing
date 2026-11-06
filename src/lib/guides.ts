import { readFile } from "node:fs/promises";
import path from "node:path";

export const guideCategories = [
  {
    id: "start",
    title: "Get started",
    description: "Install the tracker and put your first flight on the radar.",
  },
  {
    id: "radar",
    title: "Using the radar",
    description: "Read traffic, tune the map, and get more from each layer.",
  },
  {
    id: "flying",
    title: "Flying better",
    description:
      "Weather, charts, navigation, and radio for realistic flights.",
  },
  {
    id: "community",
    title: "Community",
    description: "Stats, challenges, virtual airlines, and contributions.",
  },
] as const;

export type GuideCategoryId = (typeof guideCategories)[number]["id"];

interface GuideEntry {
  slug: string;
  title: string;
  description: string;
  category: GuideCategoryId;
  /** ISO date of the last substantive content update. */
  updated: string;
}

// Keep this explicit: route parameters must never become arbitrary file paths.
export const guides = [
  {
    slug: "getting-started",
    title: "Getting started with RadarThing",
    description:
      "Install the tracker, transmit your first GeoFS flight, and find it on the live map.",
    category: "start",
    updated: "2026-11-02",
  },
  {
    slug: "aircraft-not-appearing",
    title: "Aircraft not appearing on the radar",
    description:
      "Check transmission, sign-in, installation, filters, and your connection.",
    category: "start",
    updated: "2026-11-02",
  },
  {
    slug: "using-the-radar",
    title: "Using the radar",
    description:
      "Find flights, read telemetry, follow aircraft, and explore map layers.",
    category: "radar",
    updated: "2026-11-02",
  },
  {
    slug: "reading-flight-telemetry",
    title: "Reading flight telemetry",
    description:
      "What altitude, flight levels, knots, Mach, heading, and vertical speed tell you.",
    category: "radar",
    updated: "2026-11-02",
  },
  {
    slug: "radar-settings-and-shortcuts",
    title: "Radar settings, layers, and keyboard shortcuts",
    description:
      "Every Configuration option, the default shortcuts, and saving layer presets.",
    category: "radar",
    updated: "2026-11-02",
  },
  {
    slug: "squawk-codes",
    title: "Squawk codes and transponders explained",
    description:
      "What four-digit squawk codes mean, the emergency codes, and squawk etiquette.",
    category: "radar",
    updated: "2026-11-02",
  },
  {
    slug: "conflict-alerts",
    title: "How conflict alerts work",
    description:
      "The prediction model, separation thresholds, and how to act on an alert.",
    category: "radar",
    updated: "2026-11-02",
  },
  {
    slug: "planning-a-realistic-flight",
    title: "Planning a realistic flight in GeoFS",
    description:
      "A phase-by-phase method from route choice to descent planning and review.",
    category: "flying",
    updated: "2026-11-02",
  },
  {
    slug: "reading-metars",
    title: "How to read a METAR",
    description:
      "Decode airport weather reports group by group and choose the right runway.",
    category: "flying",
    updated: "2026-11-02",
  },
  {
    slug: "airport-charts",
    title: "Reading airport charts: ground, SID, STAR, and approach",
    description:
      "What each chart type is for, how to read it, and how to open charts on RadarThing.",
    category: "flying",
    updated: "2026-11-02",
  },
  {
    slug: "flight-plans-and-navigation",
    title: "Flight plans, waypoints, and navigation",
    description:
      "Share your GeoFS route, preview plans from a file, and measure headings on the map.",
    category: "flying",
    updated: "2026-11-02",
  },
  {
    slug: "atc-and-phraseology",
    title: "ATC and radio phraseology for GeoFS pilots",
    description:
      "The structure of a radio call, standard phrases, and flying with community controllers.",
    category: "flying",
    updated: "2026-11-02",
  },
  {
    slug: "callsigns-explained",
    title: "Callsigns explained",
    description:
      "Airline, registration, and military callsigns, and ICAO versus IATA codes.",
    category: "flying",
    updated: "2026-11-02",
  },
  {
    slug: "flight-history-and-replay",
    title: "Flight history and replay",
    description:
      "Find recorded flights, understand access limits, and share a replay.",
    category: "community",
    updated: "2026-09-14",
  },
  {
    slug: "pilot-stats-and-leaderboards",
    title: "Pilot stats, streaks, and leaderboards",
    description:
      "How totals and streaks are calculated, and why some flights do not count.",
    category: "community",
    updated: "2026-11-02",
  },
  {
    slug: "pilot-challenges",
    title: "Pilot challenges",
    description:
      "How weekly and monthly challenges are tracked, and how to submit manual ones.",
    category: "community",
    updated: "2026-11-02",
  },
  {
    slug: "virtual-airlines",
    title: "Virtual airlines on RadarThing",
    description:
      "Register a virtual airline, manage pilots and fleet images, and grow your community.",
    category: "community",
    updated: "2026-11-02",
  },
  {
    slug: "contributing-aircraft-images",
    title: "Contributing aircraft images",
    description:
      "How images are matched to flights, submission guidelines, and review.",
    category: "community",
    updated: "2026-11-02",
  },
  {
    slug: "acars-flight-updates",
    title: "ACARS flight updates",
    description:
      "Post short updates from your flight for radar viewers, and the rules that apply.",
    category: "community",
    updated: "2026-11-02",
  },
] as const satisfies readonly GuideEntry[];

export type Guide = (typeof guides)[number];

export function getGuidesByCategory() {
  return guideCategories.map((category) => ({
    ...category,
    guides: guides.filter((guide) => guide.category === category.id),
  }));
}

export function getLatestGuideUpdate(): string {
  return guides.reduce<string>(
    (latest, guide) => (guide.updated > latest ? guide.updated : latest),
    guides[0].updated,
  );
}

const WORDS_PER_MINUTE = 220;

export async function getGuide(slug: string) {
  const index = guides.findIndex((entry) => entry.slug === slug);
  const guide = guides[index];
  if (!guide) return null;
  const markdown = await readFile(
    path.join(process.cwd(), "content/guides", `${guide.slug}.md`),
    "utf8",
  );
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return {
    ...guide,
    markdown,
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    previous: guides[index - 1] ?? null,
    next: guides[index + 1] ?? null,
  };
}
