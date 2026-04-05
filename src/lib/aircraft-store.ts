export interface PositionUpdate {
  id: string;
  googleId?: string;
  callsign: string;
  type: string;
  lat: number;
  lon: number;
  alt: number;
  altMSL: number;
  heading: number;
  speed: number;
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

class AircraftStore {
  private store = new Map<string, PositionUpdate>();
  private flightPaths = new Map<string, [number, number][]>();
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

    // Include flight path in the data
    const dataWithPath = {
      ...data,
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
    if (existed) {
      this.notifySubscribers();
    }
    return existed;
  }

  clear() {
    this.store.clear();
    this.flightPaths.clear();
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
}

export const activeAircraft = new AircraftStore();
