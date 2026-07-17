import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { getFlightDurationMs } from "~/lib/flightDuration";
import { unwrapPath } from "~/lib/map-utils";

export interface FlightData {
  id: string;
  depICAO?: string;
  arrICAO?: string;
  startTime: number;
  endTime?: number;
  aircraftType?: string;
  callsign?: string;
  duration?: number;
  maxAltitude?: number;
  maxSpeed?: number;
  routeData?: [number, number][];
}

export interface FlightReplayState {
  isPlaying: boolean;
  progress: number; // 0-1
  currentPosition: [number, number] | null;
  currentHeading: number;
  traversedPath: [number, number][];
  remainingPath: [number, number][];
  elapsedTime: number; // in ms
  totalDuration: number; // in ms
  speed: number;
}

export type SpeedMultiplier = 1 | 2 | 4 | 8 | 16;

const SPEED_OPTIONS: SpeedMultiplier[] = [1, 2, 4, 8, 16];

function isValidCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

// Haversine formula to calculate distance between two points in nautical miles
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate total route distance in nautical miles
function calculateTotalDistance(routeData: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < routeData.length; i++) {
    const [lat1, lon1] = routeData[i - 1]!;
    const [lat2, lon2] = routeData[i]!;
    total += haversineDistance(lat1, lon1, lat2, lon2);
  }
  return total;
}

// Estimate duration based on distance at average speed (450 knots)
function estimateDuration(routeData: [number, number][]): number {
  const distanceNm = calculateTotalDistance(routeData);
  const avgSpeedKnots = 450;
  const hoursRequired = distanceNm / avgSpeedKnots;
  return hoursRequired * 60 * 60 * 1000; // Convert to milliseconds
}

// Calculate heading between two points
function calculateHeading(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const x = Math.sin(dLon) * Math.cos(lat2Rad);
  const y =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let heading = (Math.atan2(x, y) * 180) / Math.PI;
  heading = (heading + 360) % 360;
  return heading;
}

// Interpolate between two points on an already-unwrapped path.
function interpolatePosition(
  p1: [number, number],
  p2: [number, number],
  t: number,
): [number, number] {
  const lon1 = p1[1];
  const lon2 = p2[1];

  return [p1[0] + (p2[0] - p1[0]) * t, lon1 + (lon2 - lon1) * t];
}

export function useFlightReplay(flight: FlightData | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedMultiplier>(1);
  const [elapsedTime, setElapsedTime] = useState(0);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const rawRouteData = flight?.routeData;

  // Keep replay coordinates on a continuous longitude timeline so the marker
  // does not jump world copies mid-flight when crossing the antimeridian.
  const routeData = useMemo(
    () => unwrapPath((rawRouteData || []).filter(isValidCoordinatePair)),
    [rawRouteData],
  );

  // Calculate total duration
  const totalDuration = useMemo(() => {
    const recordedDuration = flight ? getFlightDurationMs(flight) : undefined;
    if (recordedDuration !== undefined) return recordedDuration;
    if (routeData.length > 0) {
      return estimateDuration(routeData);
    }
    return 0;
  }, [flight, routeData]);

  // Memoize computed state to prevent new object creation on every render
  const computedState = useMemo(() => {
    if (routeData.length < 2) {
      return {
        progress: 0,
        currentPosition: routeData[0] || null,
        currentHeading: 0,
        traversedPath: [],
        remainingPath: routeData,
        elapsedTime: 0,
        totalDuration,
      };
    }

    const currentProgress = Math.min(
      1,
      totalDuration > 0 ? elapsedTime / totalDuration : 0,
    );

    // Calculate which segment we're on
    const timePerSegment = totalDuration / (routeData.length - 1);
    const currentSegmentIndex = Math.min(
      Math.floor(elapsedTime / timePerSegment),
      routeData.length - 2,
    );
    const segmentProgress =
      timePerSegment > 0 ? (elapsedTime % timePerSegment) / timePerSegment : 0;

    // Get current interpolated position
    const p1 = routeData[currentSegmentIndex]!;
    const p2 = routeData[currentSegmentIndex + 1]!;
    const currentPosition = interpolatePosition(p1, p2, segmentProgress);

    // Calculate heading
    const currentHeading = calculateHeading(p1[0], p1[1], p2[0], p2[1]);

    // Split path into traversed and remaining
    const traversedPath: [number, number][] = [
      ...routeData.slice(0, currentSegmentIndex + 1),
      currentPosition,
    ];
    const remainingPath: [number, number][] = [
      currentPosition,
      ...routeData.slice(currentSegmentIndex + 1),
    ];

    return {
      progress: currentProgress,
      currentPosition,
      currentHeading,
      traversedPath,
      remainingPath,
      elapsedTime,
      totalDuration,
    };
  }, [routeData, elapsedTime, totalDuration]);

  // Animation loop using ref to avoid recreating callback
  const speedRef = useRef(speed);
  const totalDurationRef = useRef(totalDuration);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  const animate = useCallback((timestamp: number) => {
    if (lastTimestampRef.current === null) {
      lastTimestampRef.current = timestamp;
    }

    const deltaTime = timestamp - lastTimestampRef.current;
    lastTimestampRef.current = timestamp;

    setElapsedTime((prev) => {
      const newElapsed = prev + deltaTime * speedRef.current;
      if (newElapsed >= totalDurationRef.current) {
        setIsPlaying(false);
        return totalDurationRef.current;
      }
      return newElapsed;
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Start/stop animation
  useEffect(() => {
    if (isPlaying) {
      lastTimestampRef.current = null;
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, animate]);

  // Reset when flight changes
  useEffect(() => {
    setIsPlaying(false);
    setElapsedTime(0);
    setSpeed(1);
  }, [flight?.id]);

  // Controls
  const play = useCallback(() => {
    setElapsedTime((prev) => {
      if (prev >= totalDurationRef.current) {
        return 0;
      }
      return prev;
    });
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev) {
        // Starting playback - reset if at end
        setElapsedTime((elapsed) => {
          if (elapsed >= totalDurationRef.current) {
            return 0;
          }
          return elapsed;
        });
      }
      return !prev;
    });
  }, []);

  const seek = useCallback((newProgress: number) => {
    const clampedProgress = Math.max(0, Math.min(1, newProgress));
    setElapsedTime(clampedProgress * totalDurationRef.current);
  }, []);

  const setSpeedMultiplier = useCallback((newSpeed: SpeedMultiplier) => {
    setSpeed(newSpeed);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setElapsedTime(0);
  }, []);

  return {
    ...computedState,
    isPlaying,
    speed,
    play,
    pause,
    togglePlay,
    seek,
    setSpeed: setSpeedMultiplier,
    reset,
    speedOptions: SPEED_OPTIONS,
  };
}
