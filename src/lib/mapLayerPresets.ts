export type MapBaseLayer = "satellite" | "radar" | "osm";
export type MapRenderer = "flat" | "globe";

export interface MapLayerPresetState {
  baseLayer: MapBaseLayer;
  mapRenderer?: MapRenderer;
  openAIP: boolean;
  runwayCenterlines?: boolean;
  waypoints?: boolean;
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

function isMapRenderer(value: unknown): value is MapRenderer {
  return value === "flat" || value === "globe";
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
    (preset.mapRenderer === undefined || isMapRenderer(preset.mapRenderer)) &&
    typeof preset.openAIP === "boolean" &&
    (preset.runwayCenterlines === undefined ||
      typeof preset.runwayCenterlines === "boolean") &&
    (preset.waypoints === undefined || typeof preset.waypoints === "boolean") &&
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
  options?: {
    allowLegacyRendererMatch?: boolean;
  },
) {
  const rendererMatches =
    options?.allowLegacyRendererMatch &&
    (left.mapRenderer === undefined || right.mapRenderer === undefined)
      ? true
      : left.mapRenderer === right.mapRenderer;

  return (
    left.baseLayer === right.baseLayer &&
    rendererMatches &&
    left.openAIP === right.openAIP &&
    (left.runwayCenterlines ?? false) ===
      (right.runwayCenterlines ?? false) &&
    (left.waypoints ?? false) === (right.waypoints ?? false) &&
    left.precipitation === right.precipitation &&
    left.airmets === right.airmets &&
    left.sigmets === right.sigmets &&
    left.conflicts === right.conflicts
  );
}
