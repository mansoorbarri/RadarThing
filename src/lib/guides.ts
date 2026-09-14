import { readFile } from "node:fs/promises";
import path from "node:path";

// Keep this explicit: route parameters must never become arbitrary file paths.
export const guides = [
  {
    slug: "getting-started",
    title: "Getting started with RadarThing",
    description: "Install the tracker and find your first GeoFS flight.",
  },
  {
    slug: "aircraft-not-appearing",
    title: "Aircraft not appearing on the radar",
    description: "Check sign-in, installation, filters, and your connection.",
  },
  {
    slug: "using-the-radar",
    title: "Using the radar",
    description:
      "Find flights, read telemetry, follow aircraft, and explore map layers.",
  },
  {
    slug: "flight-history-and-replay",
    title: "Flight history and replay",
    description:
      "Find recorded flights, understand access limits, and share a replay.",
  },
] as const;

export async function getGuide(slug: string) {
  const guide = guides.find((entry) => entry.slug === slug);
  if (!guide) return null;
  const markdown = await readFile(
    path.join(process.cwd(), "content/guides", `${guide.slug}.md`),
    "utf8",
  );
  return { ...guide, markdown };
}
