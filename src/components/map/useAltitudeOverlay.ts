import { useEffect, useRef } from "react";
import L from "leaflet";
import type { PositionUpdate } from "~/lib/aircraft-store";
import {
  ALTITUDE_RENDER_BANDS,
  getAltitudeBandIndex,
} from "~/lib/altitudeBands";
import {
  altitudeHeight,
  altitudeSegmentColor,
  type AltitudeTrack,
} from "~/lib/altitude3d";
import { AltitudeModeControl } from "./MapControls";
import { enableLeafletTilt } from "./leafletTilt";
import { createAircraftBillboards } from "./aircraftBillboards";
import { projectMapTilt } from "~/lib/mapTilt";

interface Props {
  map: React.MutableRefObject<L.Map | null>;
  ready: boolean;
  enabled: boolean;
  hideUi: boolean;
  revision: number;
  onToggle: () => void;
  tracks: AltitudeTrack[];
  aircrafts: PositionUpdate[];
  aircraftLayer: React.MutableRefObject<L.LayerGroup | null>;
  historyLayer: React.MutableRefObject<L.LayerGroup | null>;
  replayLayer: React.MutableRefObject<L.LayerGroup | null>;
  replayAltitude?: number;
}

/** An oblique altitude projection inside Leaflet; no second map or render loop. */
export function useAltitudeOverlay(props: Props) {
  const latest = useRef(props);
  const redraw = useRef<(() => void) | null>(null);
  const control = useRef<AltitudeModeControl | null>(null);

  useEffect(() => {
    latest.current = props;
    control.current?.updateState(
      props.enabled,
      props.tracks.some((track) => track.estimated),
    );
  });

  useEffect(() => {
    redraw.current?.();
  }, [props.tracks, props.aircrafts, props.replayAltitude]);

  useEffect(() => {
    const map = props.map.current;
    if (!map || !props.ready || props.hideUi) return;
    const button = new AltitudeModeControl({}, () => latest.current.onToggle());
    button.addTo(map);
    button.updateState(latest.current.enabled, false);
    control.current = button;
    return () => {
      button.remove();
      control.current = null;
    };
  }, [props.map, props.ready, props.hideUi, props.revision]);

  useEffect(() => {
    const map = props.map.current;
    if (!map || !props.ready || !props.enabled || props.hideUi) return;
    const container = map.getContainer();
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.pointerEvents = "none";
    canvas.style.position = "absolute";
    canvas.className = "altitude-curtain-canvas";
    canvas.style.zIndex = "450";
    canvas.style.inset = "0";
    container.appendChild(canvas);
    const context = canvas.getContext("2d");
    if (!context) {
      canvas.remove();
      return;
    }
    const restoreTilt = enableLeafletTilt(map);
    const billboards = createAircraftBillboards(map);
    const hidden = new Map<SVGElement, string>();
    let frame = 0;
    let zooming = false;

    const hideGroundPaths = (group: L.LayerGroup | null) =>
      group?.eachLayer((layer) => {
        if (!(layer instanceof L.Polyline)) return;
        const element = layer.getElement();
        if (!(element instanceof SVGElement)) return;
        if (!hidden.has(element)) hidden.set(element, element.style.visibility);
        element.style.visibility = "hidden";
      });
    const draw = () => {
      frame = 0;
      if (zooming) return;
      const {
        tracks,
        aircrafts,
        aircraftLayer,
        historyLayer,
        replayLayer,
        replayAltitude,
      } = latest.current;
      const byCallsign = new Map(
        aircrafts.map((aircraft) => [aircraft.callsign, aircraft]),
      );
      billboards.sync([
        {
          group: aircraftLayer.current,
          altitude: (marker) => {
            const aircraft = byCallsign.get(marker.options.title ?? "");
            return Number(aircraft?.altMSL ?? aircraft?.alt);
          },
        },
        { group: replayLayer.current, altitude: () => replayAltitude ?? 0 },
      ]);
      const size = map.getSize();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(size.x * ratio);
      const height = Math.round(size.y * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size.x, size.y);
      for (const element of hidden.keys())
        if (!element.isConnected) hidden.delete(element);
      hideGroundPaths(historyLayer.current);
      hideGroundPaths(replayLayer.current);
      const referenceLongitude = map.getCenter().lng;
      const project = (lat: number, lon: number, elevation = 0) => {
        const flat = map.latLngToContainerPoint([
          lat,
          lon + Math.round((referenceLongitude - lon) / 360) * 360,
        ]);
        const point = projectMapTilt(flat, size, elevation);
        return L.point(point.x, point.y);
      };
      // Paint curtains first, then their upper edges so crossings stay legible.
      const edges: {
        a: L.Point;
        b: L.Point;
        color: string;
        remaining: boolean;
      }[] = [];
      for (const track of tracks) {
        for (let index = 1; index < track.path.length; index++) {
          const previous = track.path[index - 1]!;
          const current = track.path[index]!;
          if (
            !previous.every(Number.isFinite) ||
            !current.every(Number.isFinite)
          )
            continue;
          const a = project(previous[0], previous[1]);
          const b = project(current[0], current[1]);
          // A date-line seam must not turn into a line spanning the map.
          if (Math.abs(a.x - b.x) > (256 * 2 ** map.getZoom()) / 2) continue;
          const firstAltitude = track.altitudes[index - 1]!;
          const secondAltitude = track.altitudes[index]!;
          const firstHeight = altitudeHeight(firstAltitude);
          const secondHeight = altitudeHeight(secondAltitude);
          const topA = project(previous[0], previous[1], firstHeight);
          const topB = project(current[0], current[1], secondHeight);
          if (
            Math.max(a.x, b.x, topA.x, topB.x) < 0 ||
            Math.min(a.x, b.x, topA.x, topB.x) > size.x ||
            Math.max(a.y, b.y) < 0 ||
            Math.min(topA.y, topB.y) > size.y
          )
            continue;
          const color = altitudeSegmentColor(firstAltitude, secondAltitude);
          context.globalAlpha = track.remaining ? 0.06 : 0.18;
          context.fillStyle = color;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(topA.x, topA.y);
          context.lineTo(topB.x, topB.y);
          context.lineTo(b.x, b.y);
          context.closePath();
          context.fill();
          edges.push({ a: topA, b: topB, color, remaining: !!track.remaining });
        }
      }
      context.lineWidth = 2.5;
      for (const edge of edges) {
        context.globalAlpha = edge.remaining ? 0.4 : 0.95;
        context.strokeStyle = edge.color;
        context.setLineDash(edge.remaining ? [6, 6] : []);
        context.beginPath();
        context.moveTo(edge.a.x, edge.a.y);
        context.lineTo(edge.b.x, edge.b.y);
        context.stroke();
      }
      context.setLineDash([]);
      aircraftLayer.current?.eachLayer((layer) => {
        if (!(layer instanceof L.Marker)) return;
        const aircraft = byCallsign.get(layer.options.title ?? "");
        if (!aircraft) return;
        const altitude = Number(aircraft.altMSL ?? aircraft.alt);
        const latLng = layer.getLatLng();
        const ground = project(latLng.lat, latLng.lng);
        const top = project(latLng.lat, latLng.lng, altitudeHeight(altitude));
        if (
          ground.x < -200 ||
          ground.x > size.x + 200 ||
          ground.y < 0 ||
          ground.y > size.y + 200
        )
          return;
        context.globalAlpha = 0.35;
        context.strokeStyle = Number.isFinite(altitude)
          ? ALTITUDE_RENDER_BANDS[getAltitudeBandIndex(altitude)]!.color
          : "#64748b";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(ground.x, ground.y);
        context.lineTo(top.x, top.y);
        context.stroke();
      });
      context.globalAlpha = 1;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onZoomStart = () => {
      zooming = true;
      canvas.style.visibility = "hidden";
    };
    const onZoomEnd = () => {
      zooming = false;
      canvas.style.visibility = "";
      schedule();
    };
    redraw.current = schedule;
    map.on("move resize viewreset", schedule);
    map.on("zoomstart", onZoomStart);
    map.on("zoomend", onZoomEnd);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      redraw.current = null;
      billboards.destroy();
      restoreTilt();
      map.off("move resize viewreset", schedule);
      map.off("zoomstart", onZoomStart);
      map.off("zoomend", onZoomEnd);
      for (const [element, visibility] of hidden)
        element.style.visibility = visibility;
      canvas.remove();
    };
  }, [props.map, props.ready, props.enabled, props.hideUi, props.revision]);
}
