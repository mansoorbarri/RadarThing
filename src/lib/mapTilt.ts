/** The same perspective projection used by the map's CSS camera. */
export const MAP_PITCH = 50;
const radians = (MAP_PITCH * Math.PI) / 180;
const sin = Math.sin(radians);
const cos = Math.cos(radians);
interface Point {
  x: number;
  y: number;
}
export const cameraDistance = (size: Point) => Math.max(1600, size.y * 2.5);

export function projectMapTilt(
  point: Point,
  size: Point,
  elevation = 0,
): Point | null {
  const x = point.x - size.x / 2;
  const y = point.y - size.y / 2;
  const distance = cameraDistance(size);
  const denominator = distance - y * sin - elevation * cos;
  // Reject the camera plane and near-plane cancellation before division.
  const epsilon =
    1e-6 *
    Math.max(
      1,
      Math.abs(distance),
      Math.abs(y * sin),
      Math.abs(elevation * cos),
    );
  if (!Number.isFinite(denominator) || denominator <= epsilon) return null;
  const perspective = distance / denominator;
  const projected = {
    x: size.x / 2 + x * perspective,
    y: size.y / 2 + (y * cos - elevation * sin) * perspective,
  };
  return Number.isFinite(projected.x) && Number.isFinite(projected.y)
    ? projected
    : null;
}

export function unprojectMapTilt(point: Point, size: Point): Point {
  const x = point.x - size.x / 2;
  const y = point.y - size.y / 2;
  const distance = cameraDistance(size);
  const groundY = (y * distance) / (distance * cos + y * sin);
  return {
    x: size.x / 2 + (x * (distance - groundY * sin)) / distance,
    y: size.y / 2 + groundY,
  };
}
