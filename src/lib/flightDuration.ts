export interface FlightDurationLike {
  startTime?: number;
  endTime?: number;
  duration?: number;
}

export function getFlightDurationMs({
  startTime,
  endTime,
  duration,
}: FlightDurationLike): number | undefined {
  if (
    typeof startTime === "number" &&
    Number.isFinite(startTime) &&
    typeof endTime === "number" &&
    Number.isFinite(endTime) &&
    endTime > startTime
  ) {
    return endTime - startTime;
  }

  if (typeof duration === "number" && Number.isFinite(duration)) {
    return Math.max(0, duration);
  }

  return undefined;
}
