"use client";

export type ChartRotation = 0 | 90 | 180 | 270;

const STORAGE_KEY = "radarthing-chart-rotations-v1";

const rotationCache = new Map<string, ChartRotation>();
let storedRotations: Record<string, ChartRotation> | null = null;

function normalizeRotation(value: number): ChartRotation {
  const normalized = ((Math.round(value / 90) * 90) % 360 + 360) % 360;
  if (
    normalized === 0 ||
    normalized === 90 ||
    normalized === 180 ||
    normalized === 270
  ) {
    return normalized;
  }
  return 0;
}

function loadStoredRotations(): Record<string, ChartRotation> {
  if (storedRotations) return storedRotations;
  if (typeof window === "undefined") {
    storedRotations = {};
    return storedRotations;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      storedRotations = {};
      return storedRotations;
    }

    const parsed = JSON.parse(raw) as Record<string, number>;
    storedRotations = Object.fromEntries(
      Object.entries(parsed).map(([chartUrl, rotation]) => [
        chartUrl,
        normalizeRotation(rotation),
      ]),
    );
  } catch {
    storedRotations = {};
  }

  return storedRotations;
}

function persistStoredRotations(rotations: Record<string, ChartRotation>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rotations));
}

export function getChartRotation(chartUrl: string): ChartRotation {
  const cached = rotationCache.get(chartUrl);
  if (cached !== undefined) return cached;

  const rotations = loadStoredRotations();
  const rotation = rotations[chartUrl] ?? 0;
  rotationCache.set(chartUrl, rotation);
  return rotation;
}

export function setChartRotation(chartUrl: string, rotation: number) {
  const normalized = normalizeRotation(rotation);
  const rotations = loadStoredRotations();

  if (normalized === 0) {
    delete rotations[chartUrl];
    rotationCache.delete(chartUrl);
  } else {
    rotations[chartUrl] = normalized;
    rotationCache.set(chartUrl, normalized);
  }

  persistStoredRotations(rotations);
}

export function getNextChartRotation(rotation: number): ChartRotation {
  return normalizeRotation(rotation + 90);
}

export function getRotatedFrameTransform(
  rotation: number,
  width: number,
  height: number,
): string {
  if (rotation % 180 === 0) {
    return `rotate(${rotation}deg)`;
  }

  const scale =
    width > 0 && height > 0 ? Math.min(width / height, height / width) : 1;

  return `rotate(${rotation}deg) scale(${scale})`;
}
