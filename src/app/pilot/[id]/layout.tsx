import type { Metadata } from "next";
import { convex, api } from "~/server/convex";

// Profiles with very few counted flights are mostly empty templates. Keep them
// out of search indexes so thin pages don't dilute the site's quality signals.
const MIN_INDEXABLE_FLIGHTS = 5;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: profileIdentifier } = await params;

  try {
    const user = await convex.query(api.users.getByProfileIdentifier, {
      profileIdentifier,
    });
    if (!user) throw new Error("Pilot not found");

    const stats = await convex.query(api.flights.getStatsById, {
      userId: user._id,
    });

    const callsign = stats?.pilotCallsign ?? "Unknown Pilot";
    const flights = stats?.totalFlights ?? 0;
    const distance = stats?.totalDistanceNm ?? 0;

    const title = `${callsign} - Pilot Profile`;
    const description = `${callsign} on RadarThing: ${flights} flights, ${distance.toLocaleString()} nm flown. View flight stats, routes, and history.`;

    return {
      title,
      description,
      robots:
        flights >= MIN_INDEXABLE_FLIGHTS
          ? undefined
          : { index: false, follow: true },
      openGraph: {
        title,
        description,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return {
      title: "Pilot Profile",
      description: "View pilot stats and flight history on RadarThing.",
      robots: { index: false, follow: true },
    };
  }
}

export default function PilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
