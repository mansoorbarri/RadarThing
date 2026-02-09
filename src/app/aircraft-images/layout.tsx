import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aircraft Gallery",
  description:
    "Community-contributed aircraft photos for GeoFS. Browse airline liveries and upload your own aircraft images.",
  alternates: {
    canonical: "/aircraft-images",
  },
};

export default function AircraftImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
