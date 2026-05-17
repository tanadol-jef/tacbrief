import { useEffect, useMemo } from "react";
import type maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import * as turf from "@turf/turf";
import type { Aircraft, AircraftId, Measurement } from "../../types";
import { trueToMag } from "../../lib/magnetic";
import { resolveAnchor } from "../../store/toolStore";
import { frameAt, useRecording } from "../../store/recordingStore";

const SRC_LINE = "meas-lines";
const SRC_POINTS = "meas-points";
const SRC_LABELS = "meas-labels";
const LYR_LINE = "meas-lines";
const LYR_POINTS = "meas-points";
const LYR_LABELS = "meas-labels";

type Props = {
  map: maplibregl.Map | null;
  styleReady: number;
  measurements: Measurement[];
  aircraft: Aircraft[];
  activeId: string | null;
};

export default function MeasurementLayer({
  map,
  styleReady,
  measurements,
  aircraft,
  activeId,
}: Props) {
  const aircraftLookup = useMemo(() => {
    const m = new Map<AircraftId, { lat: number; lon: number }>();
    for (const a of aircraft) m.set(a.id, a.position);
    return m;
  }, [aircraft]);

  const imported = useRecording((s) => s.imported);
  const replayMode = useRecording((s) => s.replayMode);
  const replayTime = useRecording((s) => s.replayTime);

  const replayLookup = useMemo(() => {
    const m = new Map<AircraftId, { lat: number; lon: number }>();
    if (!replayMode || !imported) return m;
    const frame = frameAt(imported, replayTime);
    for (const [id, ac] of frame) {
      m.set(id as AircraftId, { lat: ac.lat, lon: ac.lon });
    }
    return m;
  }, [imported, replayMode, replayTime]);

  useEffect(() => {
    if (!map) return;
    const apply = () => {
      ensure(map);
      write(map, measurements, aircraftLookup, replayLookup, activeId);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("styledata", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady]);

  useEffect(() => {
    if (!map || !map.getSource(SRC_LINE)) return;
    write(map, measurements, aircraftLookup, replayLookup, activeId);
  }, [map, measurements, aircraftLookup, replayLookup, activeId]);

  return null;
}

function ensure(map: maplibregl.Map) {
  for (const id of [SRC_LINE, SRC_POINTS, SRC_LABELS]) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: "geojson", data: empty() });
    }
  }
  if (!map.getLayer(LYR_LINE)) {
    map.addLayer({
      id: LYR_LINE,
      type: "line",
      source: SRC_LINE,
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["case", ["==", ["get", "active"], true], 2.5, 2],
        "line-dasharray": [2, 2],
      },
    });
  }
  if (!map.getLayer(LYR_POINTS)) {
    map.addLayer({
      id: LYR_POINTS,
      type: "circle",
      source: SRC_POINTS,
      paint: {
        "circle-radius": [
          "case",
          ["==", ["get", "anchored"], true],
          5,
          4,
        ],
        "circle-color": ["get", "color"],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "anchored"], true],
          "#ffffff",
          "#0b0f14",
        ],
        "circle-stroke-width": [
          "case",
          ["==", ["get", "anchored"], true],
          2,
          1.5,
        ],
      },
    });
  }
  if (!map.getLayer(LYR_LABELS)) {
    map.addLayer({
      id: LYR_LABELS,
      type: "symbol",
      source: SRC_LABELS,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-offset": [0, 0],
        "text-anchor": "center",
        "text-font": ["Open Sans Regular"],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": ["get", "color"],
        "text-halo-color": "#0b0f14",
        "text-halo-width": 1.4,
      },
    });
  }
}

function write(
  map: maplibregl.Map,
  measurements: Measurement[],
  aircraftLookup: Map<AircraftId, { lat: number; lon: number }>,
  replayLookup: Map<AircraftId, { lat: number; lon: number }>,
  activeId: string | null,
) {
  const lines: Feature<Geometry>[] = [];
  const points: Feature<Geometry>[] = [];
  const labels: Feature<Geometry>[] = [];

  for (const m of measurements) {
    const resolved = m.points
      .map((p) => ({
        anchor: p,
        latlon: resolveAnchor(p, aircraftLookup, replayLookup),
      }))
      .filter(
        (p): p is { anchor: typeof p.anchor; latlon: { lat: number; lon: number } } =>
          p.latlon !== null,
      );

    for (const r of resolved) {
      points.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.latlon.lon, r.latlon.lat] },
        properties: {
          color: m.color,
          anchored:
            r.anchor.kind === "aircraft" || r.anchor.kind === "replay-aircraft",
          measurementId: m.id,
        },
      });
    }

    if (resolved.length < 2) continue;
    lines.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: resolved.map((r) => [r.latlon.lon, r.latlon.lat]),
      },
      properties: { color: m.color, active: m.id === activeId },
    });

    if (m.type === "ruler") {
      let total = 0;
      for (let i = 0; i < resolved.length - 1; i++) {
        const from: [number, number] = [
          resolved[i].latlon.lon,
          resolved[i].latlon.lat,
        ];
        const to: [number, number] = [
          resolved[i + 1].latlon.lon,
          resolved[i + 1].latlon.lat,
        ];
        const dnm = turf.distance(from, to, { units: "nauticalmiles" });
        const dkm = dnm * 1.852;
        const brgT = (turf.bearing(from, to) + 360) % 360;
        const brgM = trueToMag(brgT, resolved[i].latlon.lat, resolved[i].latlon.lon);
        total += dnm;
        const mid: [number, number] = [
          (from[0] + to[0]) / 2,
          (from[1] + to[1]) / 2,
        ];
        labels.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: mid },
          properties: {
            color: m.color,
            label: `${dnm.toFixed(2)} nm  ${dkm.toFixed(2)} km  ${brgM
              .toFixed(0)
              .padStart(3, "0")}°M`,
          },
        });
      }
      if (resolved.length > 2) {
        const last = resolved[resolved.length - 1].latlon;
        labels.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [last.lon, last.lat] },
          properties: { color: m.color, label: `Σ ${total.toFixed(2)} nm` },
        });
      }
    }

    if (m.type === "protractor" && resolved.length === 3) {
      const [a, b, c] = resolved.map((r) => r.latlon);
      const brg1 = turf.bearing([b.lon, b.lat], [a.lon, a.lat]);
      const brg2 = turf.bearing([b.lon, b.lat], [c.lon, c.lat]);
      let diff = Math.abs(brg1 - brg2);
      if (diff > 180) diff = 360 - diff;
      labels.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [b.lon, b.lat] },
        properties: { color: m.color, label: `Δ ${diff.toFixed(1)}°` },
      });
    }
  }

  (map.getSource(SRC_LINE) as maplibregl.GeoJSONSource).setData(fc(lines));
  (map.getSource(SRC_POINTS) as maplibregl.GeoJSONSource).setData(fc(points));
  (map.getSource(SRC_LABELS) as maplibregl.GeoJSONSource).setData(fc(labels));
}

function fc(features: Feature<Geometry>[]): FeatureCollection<Geometry> {
  return { type: "FeatureCollection", features };
}

function empty(): FeatureCollection<Geometry> {
  return { type: "FeatureCollection", features: [] };
}
