import { preparePathForWorldCopy } from "~/lib/map-utils";

interface FlightRouteMapProps {
  routeData: [number, number][];
  depICAO?: string;
  arrICAO?: string;
  width?: number;
  height?: number;
}

export function FlightRouteMap({
  routeData,
  depICAO,
  arrICAO,
  width = 560,
  height = 480,
}: FlightRouteMapProps) {
  if (routeData.length < 2) return null;

  const adjustedPoints = preparePathForWorldCopy(routeData);

  // Calculate bounding box with padding
  const lats = adjustedPoints.map((p) => p[0]);
  const adjLons = adjustedPoints.map((p) => p[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...adjLons);
  const maxLon = Math.max(...adjLons);

  const latRange = maxLat - minLat || 1;
  const lonRange = maxLon - minLon || 1;

  const padding = 0.15;
  const padLat = latRange * padding;
  const padLon = lonRange * padding;

  const bMinLat = minLat - padLat;
  const bMaxLat = maxLat + padLat;
  const bMinLon = minLon - padLon;
  const bMaxLon = maxLon + padLon;

  const totalLatRange = bMaxLat - bMinLat;
  const totalLonRange = bMaxLon - bMinLon;

  // Equirectangular projection
  const project = (lat: number, lon: number): [number, number] => {
    const x = ((lon - bMinLon) / totalLonRange) * width;
    const y = (1 - (lat - bMinLat) / totalLatRange) * height;
    return [x, y];
  };

  const projected = adjustedPoints.map(([lat, lon]) => project(lat, lon));
  const polylinePoints = projected.map(([x, y]) => `${x},${y}`).join(" ");

  const first = projected[0]!;
  const last = projected[projected.length - 1]!;

  return (
    <svg width={width} height={height} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow layer */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
        filter="url(#glow)"
      />

      {/* Main route line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Departure circle + label */}
      <circle cx={first[0]} cy={first[1]} r="6" fill="#22d3ee" opacity="0.8" />
      <circle cx={first[0]} cy={first[1]} r="3" fill="#ffffff" />
      {depICAO && (
        <text
          x={first[0]}
          y={first[1] + 20}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="13"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {depICAO}
        </text>
      )}

      {/* Arrival circle + label */}
      <circle cx={last[0]} cy={last[1]} r="6" fill="#22d3ee" opacity="0.8" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="#ffffff" />
      {arrICAO && (
        <text
          x={last[0]}
          y={last[1] + 20}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="13"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {arrICAO}
        </text>
      )}
    </svg>
  );
}
