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

import { airlineCodeFromFlightNo, getSizeCategoryFor, type FlightSizeCategory, type Incident } from "../../types/flight";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const EMERGENCY_SQUAWKS = new Set(["7700", "7600", "7500"]);

class AircraftStore {
  private store = new Map<string, PositionUpdate>();
  private subscribers = new Set<Subscriber>();
  private history = new Map<string, PositionUpdate[]>();
  private incidents: Incident[] = [];
  private airlineIndex = new Map<string, Set<string>>(); // airlineCode -> ids
  private routeIndex = new Map<string, Set<string>>(); // DEP-ARR -> ids
  private sizeIndex = new Map<FlightSizeCategory, Set<string>>();

  set(id: string, data: PositionUpdate) {
    // normalize timestamps
    const now = Date.now();
    const normalized: PositionUpdate = {
      ...data,
      ts: data.ts ?? now,
      lastSeen: now,
    };

    this.store.set(id, normalized);
    this.recordHistory(id, normalized);
    this.indexRecord(id, normalized);
    this.detectIncident(id, normalized);
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
      this.history.delete(id);
      for (const set of this.airlineIndex.values()) set.delete(id);
      for (const set of this.routeIndex.values()) set.delete(id);
      for (const set of this.sizeIndex.values()) set.delete(id);
    }
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

  // New APIs
  getRecentFlights(windowMs: number = THREE_HOURS_MS) {
    const cutoff = Date.now() - windowMs;
    return Array.from(this.store.values()).filter((v) => (v.lastSeen ?? v.ts) >= cutoff);
  }

  getIncidents(windowMs: number = THREE_HOURS_MS) {
    const cutoff = Date.now() - windowMs;
    return this.incidents.filter((i) => i.ts >= cutoff).sort((a, b) => b.ts - a.ts);
  }

  findByAirline(code: string) {
    const ids = this.airlineIndex.get(code.toUpperCase());
    return ids ? Array.from(ids).map((id) => this.store.get(id)!).filter(Boolean) : [];
  }

  findByRoute(dep: string, arr: string) {
    const key = `${(dep || "").toUpperCase()}-${(arr || "").toUpperCase()}`;
    const ids = this.routeIndex.get(key);
    return ids ? Array.from(ids).map((id) => this.store.get(id)!).filter(Boolean) : [];
  }

  findBySize(size: FlightSizeCategory) {
    const ids = this.sizeIndex.get(size);
    return ids ? Array.from(ids).map((id) => this.store.get(id)!).filter(Boolean) : [];
  }

  private recordHistory(id: string, data: PositionUpdate) {
    if (!this.history.has(id)) this.history.set(id, []);
    const arr = this.history.get(id)!;
    arr.push(data);
    // prune older than 3 hours
    const cutoff = Date.now() - THREE_HOURS_MS;
    while (arr.length > 0 && ((arr[0]!.ts ?? arr[0]!.lastSeen) < cutoff)) {
      arr.shift();
    }
  }

  private indexRecord(id: string, data: PositionUpdate) {
    const airline = airlineCodeFromFlightNo(data.flightNo);
    if (airline) {
      const set = this.airlineIndex.get(airline) ?? new Set<string>();
      set.add(id);
      this.airlineIndex.set(airline, set);
    }
    const key = `${(data.departure || "").toUpperCase()}-${(data.arrival || "").toUpperCase()}`;
    if (key !== "-") {
      const set = this.routeIndex.get(key) ?? new Set<string>();
      set.add(id);
      this.routeIndex.set(key, set);
    }
    const size = getSizeCategoryFor(data.type);
    const sizeSet = this.sizeIndex.get(size) ?? new Set<string>();
    sizeSet.add(id);
    this.sizeIndex.set(size, sizeSet);
  }

  private detectIncident(id: string, data: PositionUpdate) {
    if (data.squawk && EMERGENCY_SQUAWKS.has(data.squawk)) {
      this.incidents.push({
        id,
        callsign: data.callsign,
        flightNo: data.flightNo,
        squawk: data.squawk,
        ts: data.ts ?? Date.now(),
      });
      // prune incident list
      const cutoff = Date.now() - THREE_HOURS_MS;
      this.incidents = this.incidents.filter((i) => i.ts >= cutoff);
    }
  }
}

export const activeAircraft = new AircraftStore();