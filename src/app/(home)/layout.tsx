import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "RadarThing - Flight Radar for GeoFS",
  description:
    "Real-time flight tracking for GeoFS. Track aircraft positions, record flight paths, and access aviation weather data.",
  alternates: {
    canonical: "/",
  },
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "RadarThing",
            url: "https://radarthing.com",
            applicationCategory: "GameApplication",
            operatingSystem: "Web",
            description:
              "Real-time flight tracking for GeoFS flight simulator. Track aircraft, record routes, access weather data, airport charts, and more.",
            offers: [
              {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                name: "Free",
              },
              {
                "@type": "Offer",
                price: "3",
                priceCurrency: "USD",
                name: "Pro",
                billingIncrement: "P1M",
              },
            ],
          }),
        }}
      />
      {children}
    </>
  );
}
