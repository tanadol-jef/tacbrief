import { useEffect } from "react";
import type maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Aircraft } from "../../types";

const SRC_LINES = "wp-lines";
const SRC_POINTS = "wp-points";
const LYR_LINES = "wp-lines";
const LYR_POINTS = "wp-points";
const LYR_LABELS = "wp-labels";

type Props = {
  map: maplibregl.Map | null;
  styleReady: number;
  aircraft: Aircraft[];
  selectedId: number;
};

export default function WaypointLayer({
  map,
  styleReady,
  aircraft,
  selectedId,
}: Props) {
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      ensure(map);
      write(map, aircraft, selectedId);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("styledata", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady]);

  useEffect(() => {
    if (!map || !map.getSource(SRC_POINTS)) return;
    write(map, aircraft, selectedId);
  }, [map, aircraft, selectedId]);

  return null;
}

function ensure(map: maplibregl.Map) {
  if (!map.getSource(SRC_LINES)) {
    map.addSource(SRC_LINES, { type: "geojson", data: empty() });
  }
  if (!map.getSource(SRC_POINTS)) {
    map.addSource(SRC_POINTS, { type: "geojson", data: empty() });
  }
  if (!map.getLayer(LYR_LINES)) {
    map.addLayer({
      id: LYR_LINES,
      type: "line",
      source: SRC_LINES,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 2,
        "line-dasharray": [4, 2],
        "line-opacity": 0.8,
      },
    });
  }
  if (!map.getLayer(LYR_POINTS)) {
    map.addLayer({
      id: LYR_POINTS,
      type: "circle",
      source: SRC_POINTS,
      paint: {
        "circle-radius": 4,
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#0b0f14",
        "circle-stroke-width": 1.5,
      },
    });
  }
  if (!map.getLayer(LYR_LABELS)) {
    map.addLayer({
      id: LYR_LABELS,
      type: "symbol",
      source: SRC_POINTS,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-offset": [0, -1.2],
        "text-anchor": "bottom",
        "text-font": ["Open Sans Regular"],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": ["get", "color"],
        "text-halo-color": "#0b0f14",
        "text-halo-width": 1.2,
      },
    });
  }
}

function write(
  map: maplibregl.Map,
  aircraft: Aircraft[],
  selectedId: number,
) {
  const lines: Feature<Geometry>[] = [];
  const pts: Feature<Geometry>[] = [];
  for (const a of aircraft) {
    if (!a.visible || a.route.length === 0) continue;
    const coords: [number, number][] = [
      [a.position.lon, a.position.lat],
      ...a.route.map((w) => [w.lon, w.lat] as [number, number]),
    ];
    lines.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: { color: a.color, aircraftId: a.id },
    });
    a.route.forEach((w, i) => {
      pts.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [w.lon, w.lat] },
        properties: {
          color: a.color,
          label: `${a.callsign}·${i + 1}`,
          aircraftId: a.id,
          waypointIndex: i,
          isSelectedAircraft: a.id === selectedId,
        },
      });
    });
  }
  (map.getSource(SRC_LINES) as maplibregl.GeoJSONSource).setData(fc(lines));
  (map.getSource(SRC_POINTS) as maplibregl.GeoJSONSource).setData(fc(pts));
}

function fc(features: Feature<Geometry>[]): FeatureCollection<Geometry> {
  return { type: "FeatureCollection", features };
}

function empty(): FeatureCollection<Geometry> {
  return { type: "FeatureCollection", features: [] };
}
