import { useEffect, useState } from "react";
import L from "leaflet";

interface MetarData {
  raw?: string;
  flight_category?: string;
  temperature?: { value: number };
  wind_speed?: { value: number };
  visibility?: { value: number };
  time_of_obs?: string;
}

export const useMetarOverlay = (
  mapInstance: React.MutableRefObject<L.Map | null>,
  icao: string | undefined,
) => {
  const [metar, setMetar] = useState<MetarData | null>(null);

  useEffect(() => {
    if (!icao || icao.length < 4) {
      setMetar(null);
      return;
    }
    const fetchMetar = async () => {
      try {
        const res = await fetch(`https://avwx.rest/api/metar/${icao}`, {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AVWX_TOKEN}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch METAR");
        const data = await res.json();
        setMetar(data);
      } catch (err) {
        console.error("METAR fetch error:", err);
      }
    };
    fetchMetar();

    const interval = setInterval(fetchMetar, 5 * 60 * 1000); // refresh every 5 mins
    return () => clearInterval(interval);
  }, [icao]);

  return metar;
};
