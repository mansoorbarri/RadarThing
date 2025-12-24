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
  const lastMessageTime = useRef<number>(Date.now());
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connectToStream = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    setConnectionStatus("connecting");

    const url = "https://radar-sse-production.up.railway.app/api/stream"

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionStatus("connected");
      setError(null);
      reconnectAttempts.current = 0;
    };

    es.onmessage = (event) => {
      try {
        lastMessageTime.current = Date.now();
        const data = JSON.parse(event.data);
        const processed: PositionUpdate[] =
          data.aircraft?.map((ac: any) => ({ ...ac, ts: ac.ts || Date.now() })) ||
          [];
        setAircrafts(processed);
        setIsLoading(false);
        setError(null);
      } catch {}
    };

    es.onerror = () => {
      setConnectionStatus("disconnected");
      es.close();
      scheduleReconnect();
    };

    startWatchdog();
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectAttempts.current++;
    setError(`Connection lost. Reconnecting in ${backoff / 1000}s...`);
    reconnectTimeoutRef.current = setTimeout(() => connectToStream(), backoff);
  }, [connectToStream]);

  const startWatchdog = useCallback(() => {
    if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    watchdogIntervalRef.current = setInterval(() => {
      if (Date.now() - lastMessageTime.current > 30000) {
        setConnectionStatus("disconnected");
        if (eventSourceRef.current) eventSourceRef.current.close();
        scheduleReconnect();
      }
    }, 10000);
  }, [scheduleReconnect, scheduleReconnect]);

  useEffect(() => {
    connectToStream();
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    };
  }, [connectToStream]);

  return { aircrafts, isLoading, error, connectionStatus };
};