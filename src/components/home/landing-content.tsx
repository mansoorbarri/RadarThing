import {
  Activity,
  CloudSun,
  Command,
  Gauge,
  Globe,
  Layers3,
  Map,
  Plane,
  Radar,
  Route,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import userscriptConfig from "../../../userscript-src/config.json";

export type VariantId = "1" | "2" | "3" | "4" | "5" | "6";

export const USERSCRIPT_INSTALL_PATH = "/userscript";
export const USERSCRIPT_LOADER_URL = `${userscriptConfig.siteUrl}/loader`;
export const CONSOLE_SNIPPET = `(() => {
  const script = document.createElement("script");
  script.src = "${USERSCRIPT_LOADER_URL}?t=" + Date.now();
  document.documentElement.appendChild(script);
})();`;

export const variantMeta: {
  id: VariantId;
  name: string;
  tone: string;
  summary: string;
}[] = [
  {
    id: "1",
    name: "Command Radar",
    tone: "precise, cinematic, radar-first",
    summary:
      "A focused hero with a radar-room feel and clear feature hierarchy.",
  },
  {
    id: "2",
    name: "Approach Brief",
    tone: "editorial, spacious, premium",
    summary:
      "A calmer landing page built like a pilot briefing instead of a dashboard.",
  },
  {
    id: "3",
    name: "Glass Cockpit",
    tone: "product-heavy, layered, technical",
    summary:
      "The most app-like concept, using cockpit panels to sell the feature depth.",
  },
  {
    id: "4",
    name: "Ops Board",
    tone: "industrial, utilitarian, ATC-minded",
    summary:
      "A tougher operations-board aesthetic with install and control tools upfront.",
  },
  {
    id: "5",
    name: "Night Approach",
    tone: "minimal, atmospheric, dramatic",
    summary:
      "A stripped-back cinematic concept that still surfaces the strongest product pillars.",
  },
  {
    id: "6",
    name: "Current Landing",
    tone: "feature-forward, boxed, production-style",
    summary:
      "The previous homepage design, kept intact as a baseline for user feedback.",
  },
];

export const signalStats = [
  { label: "Traffic", value: "Live GeoFS aircraft" },
  { label: "Coverage", value: "Global radar + airports" },
  { label: "Install", value: "Userscript or console loader" },
  { label: "Upgrade", value: "PRO from $3/mo" },
] as const;

export const highlightFeatures: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Radar,
    title: "Live radar built for GeoFS",
    description:
      "Track aircraft in real time with search, filters, follow mode, and multi-aircraft selection.",
  },
  {
    icon: Command,
    title: "Controller-grade tools",
    description:
      "Remote commands, flight-plan drawing, waypoint ETA context, and conflict awareness for serious operations.",
  },
  {
    icon: CloudSun,
    title: "Weather and chart overlays",
    description:
      "Layer METAR, NOTAM, AIRMET, SIGMET, precipitation, and airport charts directly into the map workflow.",
  },
  {
    icon: Route,
    title: "History, replay, and pilot stats",
    description:
      "Record routes automatically, replay flights, and review distance, time, streaks, and top airports.",
  },
  {
    icon: Users,
    title: "Community systems",
    description:
      "Leaderboard, challenges, virtual airlines, chart uploads, and community aircraft imagery keep the app alive beyond the map.",
  },
];

export const featuredWorkflows: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
}[] = [
  {
    icon: Plane,
    eyebrow: "Track",
    title: "Watch flights as they happen",
    detail:
      "Click into aircraft, follow routes in progress, and inspect who the community is tracking most.",
  },
  {
    icon: Layers3,
    eyebrow: "Overlay",
    title: "See the operating picture",
    detail:
      "Stack live traffic with weather, airport information, live ATC activity, and chart overlays.",
  },
  {
    icon: Gauge,
    eyebrow: "Control",
    title: "Act on the flight deck",
    detail:
      "Send supported autopilot commands, measure headings, and manage multiple aircraft from one interface.",
  },
  {
    icon: Activity,
    eyebrow: "Review",
    title: "Turn flights into history",
    detail:
      "Replay finished flights, export pilot data, share flight cards, and keep a running personal logbook.",
  },
];

export const secondaryHighlights: {
  icon: LucideIcon;
  title: string;
  detail: string;
}[] = [
  {
    icon: Map,
    title: "Airport charts and procedures",
    detail:
      "Taxi diagrams, SIDs, STARs, approaches, and map overlays where supported.",
  },
  {
    icon: Trophy,
    title: "Leaderboard and challenges",
    detail:
      "Competitive pilot stats, streaks, and goal-based community activity.",
  },
  {
    icon: Globe,
    title: "Free core + PRO depth",
    detail:
      "Core radar is free; PRO unlocks global charts, advanced weather access, and richer analytics.",
  },
];

export const setupSteps = [
  {
    step: "01",
    title: "Install the userscript",
    detail:
      "Use Tampermonkey for the cleanest persistent setup and automatic loader updates.",
  },
  {
    step: "02",
    title: "Open GeoFS and fly",
    detail:
      "Your aircraft appears automatically while the script is running. No extra client is required.",
  },
  {
    step: "03",
    title: "Open RadarThing",
    detail:
      "Track flights, switch overlays, inspect airports, and review history from the radar interface.",
  },
];

export const pricingHighlights = {
  free: [
    "Live aircraft tracking and search",
    "Multi-select, follow mode, and replay",
    "Remote aircraft control tools",
  ],
  pro: [
    "Decoded NOTAMs plus AIRMET/SIGMET overlays",
    "Global airport charts and procedures",
    "Full history and deeper analytics",
  ],
} as const;
