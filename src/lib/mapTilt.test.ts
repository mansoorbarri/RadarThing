import assert from "node:assert/strict";
import test from "node:test";
import { projectMapTilt, unprojectMapTilt } from "./mapTilt";

test("tilt keeps the map centre anchored and round-trips pointer coordinates", () => {
  for (const size of [
    { x: 1440, y: 900 },
    { x: 390, y: 844 },
  ]) {
    const center = { x: size.x / 2, y: size.y / 2 };
    assert.deepEqual(projectMapTilt(center, size), center);
    for (const point of [
      { x: 0, y: 0 },
      center,
      size,
      { x: size.x * 0.2, y: size.y * 0.75 },
    ]) {
      const result = unprojectMapTilt(projectMapTilt(point, size), size);
      assert.ok(Math.abs(result.x - point.x) < 1e-8);
      assert.ok(Math.abs(result.y - point.y) < 1e-8);
    }
  }
});
test("elevation rises above the same ground coordinate without a sideways offset at the centre", () => {
  const size = { x: 1440, y: 900 };
  const center = { x: 720, y: 450 };
  const raised = projectMapTilt(center, size, 140);
  assert.equal(raised.x, center.x);
  assert.ok(raised.y < center.y);
});
