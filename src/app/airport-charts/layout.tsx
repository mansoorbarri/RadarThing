import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Airport Charts",
  description:
    "Community-contributed airport charts for GeoFS. SIDs, STARs, approach procedures, taxi diagrams, and more.",
  alternates: {
    canonical: "/airport-charts",
  },
};

export default function AirportChartsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
