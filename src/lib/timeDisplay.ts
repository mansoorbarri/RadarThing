export type TimeDisplayMode = "utc" | "local";

function formatTime(
  date: Date,
  mode: TimeDisplayMode,
  includeSeconds = false,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: mode === "utc" ? "UTC" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(date);
}

export function getTimeZoneLabel(date: Date, mode: TimeDisplayMode): string {
  if (mode === "utc") return "UTC";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "short",
  }).formatToParts(date);
  const zoneName = parts.find((part) => part.type === "timeZoneName")?.value;

  return zoneName?.trim() || "LOCAL";
}

export function formatClockParts(
  date: Date,
  mode: TimeDisplayMode,
): { time: string; zoneLabel: string } {
  return {
    time: formatTime(date, mode, true),
    zoneLabel: getTimeZoneLabel(date, mode),
  };
}

export function formatRadarTime(
  timestamp: number | null | undefined,
  mode: TimeDisplayMode,
): string {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "---";
  }

  const date = new Date(timestamp);
  const time = formatTime(date, mode, false);

  if (mode === "utc") {
    return `${time}Z`;
  }

  return `${time} ${getTimeZoneLabel(date, mode)}`;
}
