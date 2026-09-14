import L from "leaflet";
import { cameraDistance, MAP_PITCH, unprojectMapTilt } from "~/lib/mapTilt";

// Leaflet 1.9 exposes neither a pitched camera nor a tile-frustum hook. Keep
// these two narrow adapters together and restore them when the toggle is off.
type TiltGrid = L.GridLayer & {
  _getTiledPixelBounds: (center: L.LatLng) => L.Bounds;
  _tileZoom?: number;
  _update: () => void;
};
type TiltDraggable = L.Draggable & {
  _startPoint: L.Point;
  _startPos: L.Point;
  _newPos: L.Point;
  _parentScale: { x: number; y: number };
};

export function enableLeafletTilt(map: L.Map) {
  const container = map.getContainer();
  const mapPane = map.getPane("mapPane")!;
  const stage = document.createElement("div");
  stage.className = "leaflet-tilted-stage";
  Object.assign(stage.style, {
    position: "absolute",
    inset: "0",
    zIndex: "400",
    transformOrigin: "50% 50%",
  });
  container.insertBefore(stage, mapPane);
  stage.appendChild(mapPane);
  const resize = () => {
    stage.style.transform = `perspective(${cameraDistance(map.getSize())}px) rotateX(${MAP_PITCH}deg)`;
  };
  resize();
  map.on("resize", resize);

  // Preserve the original method for cleanup; invocation below binds map explicitly.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalMousePoint = map.mouseEventToContainerPoint;
  const inverse = (point: L.Point) => {
    const result = unprojectMapTilt(point, map.getSize());
    return L.point(result.x, result.y);
  };
  map.mouseEventToContainerPoint = (event) =>
    inverse(originalMousePoint.call(map, event));

  const grids = new Map<TiltGrid, TiltGrid["_getTiledPixelBounds"]>();
  const extendTiles = (layer: L.Layer) => {
    if (!(layer instanceof L.GridLayer)) return;
    const grid = layer as TiltGrid;
    if (grids.has(grid)) return;
    const original = grid._getTiledPixelBounds;
    grids.set(grid, original);
    grid._getTiledPixelBounds = function (center) {
      const bounds = original.call(this, center);
      const size = map.getSize();
      const corners = [
        inverse(L.point(0, 0)),
        inverse(L.point(size.x, 0)),
        inverse(size),
        inverse(L.point(0, size.y)),
      ];
      const scale = 2 ** ((this._tileZoom ?? map.getZoom()) - map.getZoom());
      const padding = L.point(
        Math.max(0, ...corners.map((p) => Math.max(-p.x, p.x - size.x))),
        Math.max(0, ...corners.map((p) => Math.max(-p.y, p.y - size.y))),
      ).multiplyBy(scale);
      return L.bounds(bounds.min!.subtract(padding), bounds.max!.add(padding));
    };
    grid._update();
  };
  map.eachLayer(extendTiles);
  const onLayerAdd = (event: L.LayerEvent) => extendTiles(event.layer);
  map.on("layeradd", onLayerAdd);

  const draggable = (map.dragging as L.Handler & { _draggable?: TiltDraggable })
    ._draggable;
  const beforeDrag = () => {
    if (!draggable) return;
    const rect = container.getBoundingClientRect();
    const start = draggable._startPoint.subtract([rect.left, rect.top]);
    const scaledDelta = draggable._newPos.subtract(draggable._startPos);
    const screenDelta = L.point(
      scaledDelta.x * draggable._parentScale.x,
      scaledDelta.y * draggable._parentScale.y,
    );
    draggable._newPos = draggable._startPos.add(
      inverse(start.add(screenDelta)).subtract(inverse(start)),
    );
  };
  draggable?.on("predrag", beforeDrag);

  // Native wheel zoom uses mouseEventToContainerPoint. Pinch zoom reads touch
  // coordinates directly, so keep its geographical anchor with the same inverse.
  const touchZoomEnabled = map.touchZoom.enabled();
  map.touchZoom.disable();
  let pinch: { distance: number; zoom: number; anchor: L.LatLng } | null = null;
  const touchPoint = (touch: Touch) => {
    const rect = container.getBoundingClientRect();
    return L.point(touch.clientX - rect.left, touch.clientY - rect.top);
  };
  const onTouch = (event: TouchEvent) => {
    if (!touchZoomEnabled || event.touches.length !== 2) {
      pinch = null;
      return;
    }
    if ((event.target as Element).closest(".leaflet-control")) return;
    event.preventDefault();
    const first = touchPoint(event.touches[0]!);
    const second = touchPoint(event.touches[1]!);
    const midpoint = first.add(second).divideBy(2);
    const distance = first.distanceTo(second);
    if (!pinch) {
      pinch = {
        distance: Math.max(1, distance),
        zoom: map.getZoom(),
        anchor: map.containerPointToLatLng(inverse(midpoint)),
      };
      return;
    }
    const zoom = Math.max(
      map.getMinZoom(),
      Math.min(
        map.getMaxZoom(),
        pinch.zoom + Math.log2(Math.max(1, distance) / pinch.distance),
      ),
    );
    const center = map.unproject(
      map
        .project(pinch.anchor, zoom)
        .subtract(inverse(midpoint).subtract(map.getSize().divideBy(2))),
      zoom,
    );
    map.setView(center, zoom, { animate: false });
  };
  container.addEventListener("touchstart", onTouch, { passive: false });
  container.addEventListener("touchmove", onTouch, { passive: false });
  container.addEventListener("touchend", onTouch);
  container.addEventListener("touchcancel", onTouch);

  return () => {
    map.off("resize", resize);
    map.off("layeradd", onLayerAdd);
    draggable?.off("predrag", beforeDrag);
    map.mouseEventToContainerPoint = originalMousePoint;
    container.removeEventListener("touchstart", onTouch);
    container.removeEventListener("touchmove", onTouch);
    container.removeEventListener("touchend", onTouch);
    container.removeEventListener("touchcancel", onTouch);
    if (touchZoomEnabled) map.touchZoom.enable();
    for (const [grid, original] of grids) grid._getTiledPixelBounds = original;
    if (stage.parentNode && mapPane.parentNode === stage)
      stage.parentNode.insertBefore(mapPane, stage);
    stage.remove();
  };
}
