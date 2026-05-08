import type { Metadata } from "next";
import { FREE_RECENT_FLIGHTS_LIMIT } from "~/lib/flightHistory";

export const metadata: Metadata = {
  title: "Pricing",
  description: `RadarThing Pro for $3/month. Free includes your last ${FREE_RECENT_FLIGHTS_LIMIT} flights, while PRO unlocks full flight history, airport charts, weather intel, and advanced analytics for GeoFS.`,
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
