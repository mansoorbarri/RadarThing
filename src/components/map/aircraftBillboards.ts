import L from "leaflet";
import { projectMapTilt } from "~/lib/mapTilt";
import { altitudeHeight } from "~/lib/altitude3d";

// Preserve Leaflet's own marker element, events and icon anchor, but position it
// in screen space so its label stays upright instead of tilting with the tiles.
type BillboardMarker = L.Marker & {
  _setPos: (position: L.Point) => void;
  update: () => L.Marker;
};

export function createAircraftBillboards(map: L.Map) {
  const pane = document.createElement("div");
  pane.className = "leaflet-pane aircraft-billboard-pane";
  Object.assign(pane.style, {
    position: "absolute",
    inset: "0",
    zIndex: "600",
    pointerEvents: "none",
  });
  map.getContainer().appendChild(pane);
  const markers = new Map<BillboardMarker, BillboardMarker["_setPos"]>();
  const elevations = new Map<BillboardMarker, number>();
  const hidden = new Map<BillboardMarker, string>();
  const restoreVisibility = (marker: BillboardMarker) => {
    const visibility = hidden.get(marker);
    const element = marker.getElement();
    if (visibility !== undefined && element)
      element.style.visibility = visibility;
    hidden.delete(marker);
  };

  const restore = (
    marker: BillboardMarker,
    original: BillboardMarker["_setPos"],
  ) => {
    restoreVisibility(marker);
    marker._setPos = original;
    const element = marker.getElement();
    // Removed markers must not be reintroduced during cleanup.
    if (element?.parentNode === pane) marker.getPane()?.appendChild(element);
    marker.update();
  };

  return {
    sync(
      groups: {
        group: L.LayerGroup | null;
        altitude: (marker: L.Marker) => number;
      }[],
    ) {
      const active = new Set<BillboardMarker>();
      for (const { group, altitude } of groups)
        group?.eachLayer((layer) => {
          if (!(layer instanceof L.Marker)) return;
          const marker = layer as BillboardMarker;
          active.add(marker);
          elevations.set(marker, altitudeHeight(altitude(marker)));
          if (!markers.has(marker)) {
            const original = marker._setPos;
            markers.set(marker, original);
            marker._setPos = function (position) {
              const ground = map.layerPointToContainerPoint(position);
              // Use the curtain's elevation and camera while keeping the
              // original icon and tag upright at the top of the flown trail.
              const screen = projectMapTilt(
                ground,
                map.getSize(),
                elevations.get(this) ?? 0,
              );
              if (!screen) {
                const element = this.getElement();
                if (element) {
                  if (!hidden.has(this))
                    hidden.set(this, element.style.visibility);
                  element.style.visibility = "hidden";
                }
                return;
              }
              restoreVisibility(this);
              original.call(this, L.point(screen.x, screen.y));
            };
          }
          const element = marker.getElement();
          if (element && element.parentNode !== pane) pane.appendChild(element);
          marker.update();
        });
      for (const [marker, original] of markers) {
        if (!active.has(marker)) {
          restore(marker, original);
          markers.delete(marker);
          elevations.delete(marker);
        }
      }
    },
    destroy() {
      for (const [marker, original] of markers) restore(marker, original);
      markers.clear();
      elevations.clear();
      pane.remove();
    },
  };
}
