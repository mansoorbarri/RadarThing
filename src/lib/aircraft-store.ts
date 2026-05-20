export interface PositionUpdate {
  id: string;
  googleId?: string;
  source?: string | null;
  trafficSource?: string | null;
  callsign: string;
  type: string;
  lat: number;
  lon: number;
  alt: number;
  altMSL: number;
  heading: number;
  speed: number;
  groundSpeed?: number;
  observedGroundSpeed?: number;
  etaObservedGroundSpeed?: number;
  flightNo: string;
  departure: string;
  arrival: string;
  takeoffTime: string;
  squawk: string;
  af: string;
  flightPlan: string;
  vspeed: string;
  nextWaypoint: string;
  navMode?: boolean;
  speedMode?: "knots" | "mach";
  flapsPosition?: number;
  flapsMaxPosition?: number;
  identActive?: boolean;
  identUntil?: number | null;
  ts: number;
  lastSeen: number;
  flightPath?: [number, number][];
}

type Subscriber = (aircraft: Map<string, PositionUpdate>) => void;

const MAX_FLIGHT_PATH_POINTS = 150;
const MAX_SPEED_SAMPLE_POINTS = 60;
const MAX_SPEED_SAMPLE_AGE_MS = 90_000;
const MIN_SPEED_SAMPLE_WINDOW_MS = 8_000;
const MAX_REASONABLE_OBSERVED_SPEED_KTS = 1_400;
const ETA_SPEED_HALF_LIFE_MS = 12_000;

export interface TimedPositionSample {
  lat: number;
  lon: number;
  ts: number;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceNm(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
) {
  const dLat = toRadians(toLat - fromLat);
  const dLon = toRadians(toLon - fromLon);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 3440.065 * c;
}

class AircraftStore {
  private store = new Map<string, PositionUpdate>();
  private flightPaths = new Map<string, [number, number][]>();
  private recentSamples = new Map<string, TimedPositionSample[]>();
  private subscribers = new Set<Subscriber>();
  private pendingNotification = false;
  private notificationFrame: number | null = null;

  set(id: string, data: PositionUpdate) {
    // Track flight path history
    const currentPosition: [number, number] = [data.lat, data.lon];
    const existingPath = this.flightPaths.get(id) || [];
    const lastPosition = existingPath[existingPath.length - 1];

    // Only add if position has changed
    if (
      lastPosition?.[0] !== currentPosition[0] ||
      lastPosition?.[1] !== currentPosition[1]
    ) {
      existingPath.push(currentPosition);
      // Limit to max points
      if (existingPath.length > MAX_FLIGHT_PATH_POINTS) {
        existingPath.shift();
      }
      this.flightPaths.set(id, existingPath);
    }

    const sampleTs = Number.isFinite(data.ts) ? data.ts : Date.now();
    const samples = this.recordRecentSample(id, currentPosition, sampleTs);
    const observedGroundSpeed = this.calculateObservedGroundSpeedKts(samples);
    const etaObservedGroundSpeed =
      this.calculateEtaObservedGroundSpeedKts(samples);

    // Include flight path in the data
    const dataWithPath = {
      ...data,
      observedGroundSpeed,
      etaObservedGroundSpeed,
      flightPath: this.flightPaths.get(id) || [],
    };

    this.store.set(id, dataWithPath);
    this.notifySubscribers();
  }

  get(id: string) {
    return this.store.get(id);
  }

  has(id: string) {
    return this.store.has(id);
  }

  delete(id: string) {
    const existed = this.store.delete(id);
    this.flightPaths.delete(id);
    this.recentSamples.delete(id);
    if (existed) {
      this.notifySubscribers();
    }
    return existed;
  }

  clear() {
    this.store.clear();
    this.flightPaths.clear();
    this.recentSamples.clear();
    this.notifySubscribers();
  }

  entries() {
    return this.store.entries();
  }

  values() {
    return this.store.values();
  }

  subscribe(callback: Subscriber) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers() {
    // Throttle notifications using requestAnimationFrame to batch updates
    if (this.pendingNotification) return;

    this.pendingNotification = true;
    this.notificationFrame = requestAnimationFrame(() => {
      this.pendingNotification = false;
      this.notificationFrame = null;
      this.subscribers.forEach((callback) => callback(this.store));
    });
  }

  // Clean up animation frame on destroy
  destroy() {
    if (this.notificationFrame !== null) {
      cancelAnimationFrame(this.notificationFrame);
      this.notificationFrame = null;
    }
  }

  mergeFlightPath(id: string, flightPath: [number, number][]) {
    const existing = this.store.get(id);
    if (!existing || flightPath.length === 0) return;

    const currentPath = this.flightPaths.get(id) || [];
    if (flightPath.length <= currentPath.length) return;

    const nextPath = flightPath.map(([lat, lon]) => [lat, lon] as [number, number]);
    this.flightPaths.set(id, nextPath);
    this.store.set(id, {
      ...existing,
      flightPath: nextPath,
    });
    this.notifySubscribers();
  }

  getAll() {
    return Array.from(this.store.values());
  }

  private recordRecentSample(
    id: string,
    position: [number, number],
    ts: number,
  ): TimedPositionSample[] {
    const [lat, lon] = position;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(ts)) {
      return this.recentSamples.get(id) || [];
    }

    const existing = this.recentSamples.get(id) || [];
    const last = existing[existing.length - 1];
    let next = existing;

    if (!last) {
      next = [{ lat, lon, ts }];
    } else if (
      ts > last.ts &&
      (lat !== last.lat || lon !== last.lon)
    ) {
      next = [...existing, { lat, lon, ts }];
    }

    const minTs = ts - MAX_SPEED_SAMPLE_AGE_MS;
    next = next.filter((sample) => sample.ts >= minTs);

    if (next.length > MAX_SPEED_SAMPLE_POINTS) {
      next = next.slice(-MAX_SPEED_SAMPLE_POINTS);
    }

    this.recentSamples.set(id, next);
    return next;
  }
  private calculateObservedGroundSpeedKts(
    samples: TimedPositionSample[],
  ): number | undefined {
    if (samples.length < 2) return undefined;

    let totalDistanceNm = 0;
    let totalElapsedMs = 0;

    for (let index = 1; index < samples.length; index++) {
      const previous = samples[index - 1];
      const current = samples[index];
      if (!previous || !current || current.ts <= previous.ts) continue;

      const segmentDistanceNm = distanceNm(
        previous.lat,
        previous.lon,
        current.lat,
        current.lon,
      );
      const segmentElapsedMs = current.ts - previous.ts;
      const segmentSpeedKts =
        segmentDistanceNm / (segmentElapsedMs / 3_600_000);

      if (segmentSpeedKts > MAX_REASONABLE_OBSERVED_SPEED_KTS) continue;

      totalDistanceNm += segmentDistanceNm;
      totalElapsedMs += segmentElapsedMs;
    }

    if (totalElapsedMs < MIN_SPEED_SAMPLE_WINDOW_MS) return undefined;

    return totalDistanceNm / (totalElapsedMs / 3_600_000);
  }

  private calculateEtaObservedGroundSpeedKts(
    samples: TimedPositionSample[],
  ): number | undefined {
    if (samples.length < 2) return undefined;

    const newestTs = samples[samples.length - 1]?.ts;
    if (!newestTs) return undefined;

    let weightedSpeedSum = 0;
    let weightSum = 0;
    let totalElapsedMs = 0;

    for (let index = 1; index < samples.length; index++) {
      const previous = samples[index - 1];
      const current = samples[index];
      if (!previous || !current || current.ts <= previous.ts) continue;

      const segmentDistanceNm = distanceNm(
        previous.lat,
        previous.lon,
        current.lat,
        current.lon,
      );
      const segmentElapsedMs = current.ts - previous.ts;
      const segmentSpeedKts =
        segmentDistanceNm / (segmentElapsedMs / 3_600_000);

      if (segmentSpeedKts > MAX_REASONABLE_OBSERVED_SPEED_KTS) continue;

      totalElapsedMs += segmentElapsedMs;
      const ageMs = Math.max(0, newestTs - current.ts);
      const weight = Math.exp(
        (-Math.LN2 * ageMs) / ETA_SPEED_HALF_LIFE_MS,
      );

      weightedSpeedSum += segmentSpeedKts * weight;
      weightSum += weight;
    }

    if (totalElapsedMs < MIN_SPEED_SAMPLE_WINDOW_MS || weightSum <= 0) {
      return undefined;
    }

    return weightedSpeedSum / weightSum;
  }
}

export const activeAircraft = new AircraftStore();
