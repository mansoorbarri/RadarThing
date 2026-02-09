import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "RadarThing Pro for $3/month. Get NOTAMs, AIRMETs, SIGMETs, airport charts, full flight history, and advanced analytics for GeoFS.",
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
