export interface PositionUpdate {
  id: string;
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
  flightPlan: string;
  vspeed: string;
  nextWaypoint: string;
  ts: number;
  lastSeen: number;
}

type Subscriber = (aircraft: Map<string, PositionUpdate>) => void;

class AircraftStore {
  private store = new Map<string, PositionUpdate>();
  private subscribers = new Set<Subscriber>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  set(id: string, data: PositionUpdate) {
    this.store.set(id, data);
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
    if (existed) {
      this.notifySubscribers();
    }
    return existed;
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
    this.subscribers.forEach((callback) => callback(this.store));
  }

  getAll() {
    return Array.from(this.store.values());
  }

  private startCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 10000;
      let removed = false;

      for (const [id, data] of this.store.entries()) {
        if (now - data.lastSeen > timeout) {
          this.store.delete(id);
          console.log(`[ATC-API] Removed stale aircraft: ${id}`);
          removed = true;
        }
      }

      if (removed) {
        this.notifySubscribers();
      }
    }, 5000);
  }

  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const activeAircraft = new AircraftStore();
