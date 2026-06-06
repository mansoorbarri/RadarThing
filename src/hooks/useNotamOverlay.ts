import { useEffect, useState } from "react";

interface Notam {
  text: string;
  decoded?: string | null;
}

interface NotamData {
  notams: Notam[];
  count: number;
}

export const useNotamOverlay = (icao: string | undefined, isPro = false) => {
  const [notamData, setNotamData] = useState<NotamData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!icao || icao.length < 4) {
      setNotamData(null);
      return;
    }

    const fetchNotams = async () => {
      setLoading(true);
      try {
        if (!isPro) {
          setNotamData({ notams: [], count: 0 });
          return;
        }

        const res = await fetch(
          `/api/weather/notams?icao=${encodeURIComponent(icao)}`,
        );
        if (!res.ok) throw new Error("Failed to fetch NOTAMs");

        const data = await res.json();
        const notams: Notam[] = (data.features || []).map((f: any) => ({
          text: f.properties?.text || "",
          decoded: f.properties?.decoded || null,
        }));

        setNotamData({
          notams,
          count: notams.length,
        });
      } catch (err) {
        console.error("NOTAM fetch error:", err);
        setNotamData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNotams();
  }, [icao, isPro]);

  return { notamData, loading };
};
