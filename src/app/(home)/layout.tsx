import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "RadarThing - Flight Radar for GeoFS",
  description:
    "Real-time flight tracking for GeoFS. Track aircraft positions, record flight paths, and access aviation weather data.",
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
