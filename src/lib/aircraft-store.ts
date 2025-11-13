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
}

export const activeAircraft = new Map<string, PositionUpdate & { lastSeen: number }>();

let cleanupInterval: NodeJS.Timeout | null = null;

if (!cleanupInterval) {
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const timeout = 30000;
    for (const [id, data] of activeAircraft.entries()) {
      if (now - data.lastSeen > timeout) {
        activeAircraft.delete(id);
        console.log(`[ATC-API] Removed stale aircraft: ${id}`);
      }
    }
  }, 5000);
}