import { useEffect, useState } from "react";

interface AtisData {
  airport: string;
  type: string;
  code: string;
  datis: string;
}

export const useAtisOverlay = (icao: string | undefined) => {
  const [atis, setAtis] = useState<AtisData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!icao) {
      setAtis(null);
      return;
    }

    const fetchAtis = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/weather/atis?icao=${icao}`);
        if (!res.ok) {
          setAtis(null);
          return;
        }
        const data = await res.json();
        // API returns an array, we want the combined or first ATIS
        if (Array.isArray(data) && data.length > 0) {
          // Prefer combined ATIS if available, otherwise use first entry
          const combined = data.find((d: AtisData) => d.type === "combined");
          setAtis(combined || data[0]);
        } else if (data.error) {
          setAtis(null);
        } else {
          setAtis(null);
        }
      } catch (err) {
        console.error("ATIS fetch error:", err);
        setAtis(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAtis();

    // Refresh ATIS every 5 minutes (ATIS typically updates every 30-60 mins)
    const interval = setInterval(fetchAtis, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [icao]);

  return { atis, loading };
};
