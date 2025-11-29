import { useState, useEffect, useRef, useCallback } from "react";
import { type PositionUpdate } from "~/lib/aircraft-store";

export const useAircraftStream = () => {
  const [aircrafts, setAircrafts] = useState<PositionUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connectToStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus("connecting");

    const eventSourceUrl =
      process.env.NODE_ENV === "development"
        ? "https://radar.xyzmani.com/api/atc/stream"
        : "/api/atc/stream";

    const eventSource = new EventSource(eventSourceUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus("connected");
      setError(null);
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        const processedAircraft: PositionUpdate[] =
          data.aircraft?.map((ac: any) => ({
            ...ac,
            ts: ac.ts || Date.now(),
          })) || [];

        setAircrafts(processedAircraft);
        setIsLoading(false);
        setError(null);
      } catch (e) {}
    };

    eventSource.onerror = () => {
      setConnectionStatus("disconnected");
      eventSource.close();

      const backoffTime = Math.min(
        1000 * Math.pow(2, reconnectAttempts.current),
        30000,
      );
      reconnectAttempts.current++;

      setError(`Connection lost. Reconnecting in ${backoffTime / 1000}s...`);

      reconnectTimeoutRef.current = setTimeout(() => {
        connectToStream();
      }, backoffTime);
    };
  }, []);

  useEffect(() => {
    connectToStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectToStream]);

  return { aircrafts, isLoading, error, connectionStatus };
};
