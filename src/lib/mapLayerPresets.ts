export type MapBaseLayer = "satellite" | "radar" | "osm";

export interface MapLayerPresetState {
  baseLayer: MapBaseLayer;
  openAIP: boolean;
  precipitation: boolean;
  airmets: boolean;
  sigmets: boolean;
  conflicts: boolean;
}

export interface MapLayerPreset extends MapLayerPresetState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "radarthing.map-layer-presets";

function createPresetId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isMapBaseLayer(value: unknown): value is MapBaseLayer {
  return value === "satellite" || value === "radar" || value === "osm";
}

function isMapLayerPreset(value: unknown): value is MapLayerPreset {
  if (!value || typeof value !== "object") return false;

  const preset = value as Record<string, unknown>;
  return (
    typeof preset.id === "string" &&
    typeof preset.name === "string" &&
    typeof preset.createdAt === "number" &&
    typeof preset.updatedAt === "number" &&
    isMapBaseLayer(preset.baseLayer) &&
    typeof preset.openAIP === "boolean" &&
    typeof preset.precipitation === "boolean" &&
    typeof preset.airmets === "boolean" &&
    typeof preset.sigmets === "boolean" &&
    typeof preset.conflicts === "boolean"
  );
}

export function getStoredMapLayerPresets(): MapLayerPreset[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isMapLayerPreset);
  } catch {
    return [];
  }
}

export function setStoredMapLayerPresets(presets: MapLayerPreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function createMapLayerPreset(
  name: string,
  state: MapLayerPresetState,
): MapLayerPreset {
  const now = Date.now();
  return {
    id: createPresetId(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    ...state,
  };
}

export function mapLayerPresetStateEquals(
  left: MapLayerPresetState,
  right: MapLayerPresetState,
) {
  return (
    left.baseLayer === right.baseLayer &&
    left.openAIP === right.openAIP &&
    left.precipitation === right.precipitation &&
    left.airmets === right.airmets &&
    left.sigmets === right.sigmets &&
    left.conflicts === right.conflicts
  );
}
