import { useState, useEffect, useRef, useCallback } from "react";
import { type PositionUpdate, activeAircraft } from "~/lib/aircraft-store";

const AIRCRAFT_REMOVAL_GRACE_MS = 15_000;

export interface OnlineAirportController {
  user: string;
  discordUserId: string | null;
  position: "control" | "tower" | "ground" | "delivery";
  activatedAt: number;
}

export interface OnlineAirport {
  icao: string;
  discordInvite: string;
  controllers: OnlineAirportController[];
}

export const useAircraftStream = () => {
  const [aircrafts, setAircrafts] = useState<PositionUpdate[]>(
    activeAircraft.getAll(),
  );
  const [onlineAirports, setOnlineAirports] = useState<OnlineAirport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // When the next automatic reconnect happens, for a live countdown.
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const [lastMessageAgeSeconds, setLastMessageAgeSeconds] = useState<
    number | null
  >(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const lastMessageTime = useRef<number>(Date.now());
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connectToStream = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    setConnectionStatus("connecting");

    // Opt in to deltas that omit unchanged flight plans (handled below).
    const url = "https://sse.radarthing.com/api/stream?flightPlans=changed";

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionStatus("connected");
      setError(null);
      setNextRetryAt(null);
      reconnectAttempts.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const receivedAt = Date.now();
        lastMessageTime.current = receivedAt;
        const data = JSON.parse(event.data);

        // Handle full vs delta updates
        if (data.type === "full") {
          // Full update: clear store and add all aircraft
          activeAircraft.clear();
        }

        // Process aircraft (works for both full and delta)
        const processed: PositionUpdate[] =
          data.aircraft?.map((ac: any) => ({
            ...ac,
            ts: ac.ts || Date.now(),
          })) || [];

        // Update the store with each aircraft (this tracks flight paths)
        // Use callsign as primary key for consistency (id can be inconsistent)
        // Deltas omit flightPlan when it hasn't changed, so keep the last one.
        processed.forEach((ac) => {
          const key = ac.callsign || ac.id;
          const flightPlan = (ac as { flightPlan?: string | null }).flightPlan;
          ac.flightPlan =
            flightPlan === undefined
              ? (activeAircraft.get(key)?.flightPlan ?? "")
              : (flightPlan ?? "");
          activeAircraft.set(key, ac);
        });

        // Handle removed aircraft (delta updates only)
        if (data.type === "delta" && Array.isArray(data.removed)) {
          data.removed.forEach((id: string) => {
            // Try to find and remove by id or callsign
            for (const [key, ac] of activeAircraft.entries()) {
              if (ac.id === id || key === id) {
                activeAircraft.scheduleDelete(key, AIRCRAFT_REMOVAL_GRACE_MS);
                break;
              }
            }
          });
        }

        // Get all aircraft with their accumulated flight paths
        setAircrafts(activeAircraft.getAll());

        // The initial payload includes the complete ATC roster, while traffic
        // delta payloads normally omit it. Only replace the roster when the
        // server explicitly sends one so live-ATC markers persist between
        // aircraft updates.
        if (Array.isArray(data.onlineAirports)) {
          setOnlineAirports(data.onlineAirports);
        }
        setIsLoading(false);
        setError(null);
        setLastMessageAt(receivedAt);
        setLastMessageAgeSeconds(0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown stream parse error";
        console.error("Failed to process aircraft stream payload:", message);
        console.warn("[RadarThing] Stream payload error:", message);
        setError(
          "Some live data couldn't be read; waiting for the next update.",
        );
      }
    };

    es.onerror = () => {
      setConnectionStatus("disconnected");
      setError(
        typeof navigator !== "undefined" && navigator.onLine === false
          ? "You're offline."
          : "Connection lost.",
      );
      es.close();
      scheduleReconnect();
    };

    startWatchdog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    const backoff = Math.min(
      1000 * Math.pow(2, reconnectAttempts.current),
      30000,
    );
    reconnectAttempts.current++;
    setNextRetryAt(Date.now() + backoff);
    reconnectTimeoutRef.current = setTimeout(() => connectToStream(), backoff);
  }, [connectToStream]);

  const startWatchdog = useCallback(() => {
    if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    watchdogIntervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - lastMessageTime.current;
      if (elapsedMs > 30000) {
        setConnectionStatus("disconnected");
        setError(`No live data for ${Math.floor(elapsedMs / 1000)}s.`);
        if (eventSourceRef.current) eventSourceRef.current.close();
        scheduleReconnect();
      }
    }, 10000);
  }, [scheduleReconnect]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!lastMessageAt) {
        setLastMessageAgeSeconds(null);
        return;
      }

      setLastMessageAgeSeconds(
        Math.max(0, Math.floor((Date.now() - lastMessageAt) / 1000)),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [lastMessageAt]);

  // Skip the remaining backoff when the user asks, or when the browser comes
  // back online.
  const reconnectNow = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectAttempts.current = 0;
    lastMessageTime.current = Date.now();
    setNextRetryAt(null);
    connectToStream();
  }, [connectToStream]);

  useEffect(() => {
    const handleOnline = () => {
      if (eventSourceRef.current?.readyState !== EventSource.OPEN)
        reconnectNow();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [reconnectNow]);

  useEffect(() => {
    connectToStream();
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      if (watchdogIntervalRef.current)
        clearInterval(watchdogIntervalRef.current);
    };
  }, [connectToStream]);

  return {
    aircrafts,
    isLoading,
    error,
    connectionStatus,
    onlineAirports,
    lastMessageAt,
    lastMessageAgeSeconds,
    reconnectNow,
    // The status pill counts down to this itself, so the radar page doesn't
    // re-render every second while offline.
    nextRetryAt,
  };
};
