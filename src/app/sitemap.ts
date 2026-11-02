import type { MetadataRoute } from "next";
import { getLatestGuideUpdate, guides } from "~/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://radarthing.com/guides",
      lastModified: new Date(`${getLatestGuideUpdate()}T00:00:00Z`),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...guides.map((guide) => ({
      url: `https://radarthing.com/guides/${guide.slug}`,
      lastModified: new Date(`${guide.updated}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: "https://radarthing.com/leaderboard",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: "https://radarthing.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://radarthing.com/radar",
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 0.9,
    },
    {
      url: "https://radarthing.com/pricing",
      lastModified: new Date("2026-11-02T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://radarthing.com/aircraft-images",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: "https://radarthing.com/about",
      lastModified: new Date("2026-11-02T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://radarthing.com/privacy",
      lastModified: new Date("2026-08-28T00:00:00Z"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: "https://radarthing.com/terms",
      lastModified: new Date("2026-08-28T00:00:00Z"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: "https://radarthing.com/cookies",
      lastModified: new Date("2026-08-28T00:00:00Z"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: "https://radarthing.com/contact",
      lastModified: new Date("2026-08-28T00:00:00Z"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
