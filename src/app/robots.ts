import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/dashboard", "/admin", "/api", "/checkout"],
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "Google-Extended",
          "CCBot",
          "anthropic-ai",
          "ClaudeBot",
          "Claude-Web",
          "Bytespider",
          "cohere-ai",
          "Diffbot",
          "FacebookBot",
          "PerplexityBot",
          "Applebot-Extended",
          "Omgilibot",
          "Amazonbot",
        ],
        disallow: ["/"],
      },
    ],
    sitemap: "https://radarthing.com/sitemap.xml",
  };
}
