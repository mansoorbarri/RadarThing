import assert from "node:assert/strict";
import test from "node:test";
import {
  projectMapTilt,
  unprojectMapTilt,
  cameraDistance,
  MAP_PITCH,
} from "./mapTilt";

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
      const projected = projectMapTilt(point, size);
      assert.ok(projected);
      const result = unprojectMapTilt(projected, size);
      assert.ok(Math.abs(result.x - point.x) < 1e-8);
      assert.ok(Math.abs(result.y - point.y) < 1e-8);
    }
  }
});
test("elevation rises above the same ground coordinate without a sideways offset at the centre", () => {
  const size = { x: 1440, y: 900 };
  const center = { x: 720, y: 450 };
  const raised = projectMapTilt(center, size, 140);
  assert.ok(raised);
  assert.equal(raised.x, center.x);
  assert.ok(raised.y < center.y);
});

test("points on, behind, or numerically near the camera plane are invalid", () => {
  for (const size of [
    { x: 1440, y: 900 },
    { x: 1e9, y: 1e9 },
  ]) {
    const distance = cameraDistance(size);
    const sine = Math.sin((MAP_PITCH * Math.PI) / 180);
    for (const denominator of [0, -distance, distance * 5e-7]) {
      const point = {
        x: size.x / 2,
        y: size.y / 2 + (distance - denominator) / sine,
      };
      assert.equal(projectMapTilt(point, size), null);
    }
    assert.ok(projectMapTilt({ x: size.x / 2, y: size.y / 2 }, size));
  }
});

test("non-finite inputs and overflowing output coordinates are invalid", () => {
  const size = { x: 1440, y: 900 };
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(projectMapTilt({ x: value, y: 450 }, size), null);
    assert.equal(projectMapTilt({ x: 720, y: value }, size), null);
    assert.equal(projectMapTilt({ x: 720, y: 450 }, size, value), null);
  }
  assert.equal(projectMapTilt({ x: Number.MAX_VALUE, y: 2000 }, size), null);
  assert.equal(projectMapTilt({ x: 720, y: 450 }, size, 1e8), null);
});
