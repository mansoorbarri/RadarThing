// src/types/leaflet-marker-rotation.d.ts

import * as L from "leaflet";

declare module "leaflet" {
  interface MarkerOptions {
    /**
     * The angle of rotation for the marker icon in degrees.
     * Added by the 'leaflet-marker-rotation' plugin.
     */
    rotationAngle?: number;

    /**
     * The rotation origin (e.g., 'bottom center').
     * Added by the 'leaflet-marker-rotation' plugin.
     */
    rotationOrigin?: string;
    transparent?: boolean;
  }
  interface TileLayerOptions {
    transparent?: boolean;
  }
  // Note: Some versions of the plugin might require extending L.Marker,
  // but extending MarkerOptions is usually enough for the constructor.
}
