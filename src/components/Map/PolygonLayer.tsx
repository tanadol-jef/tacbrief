import { useEffect } from "react";
import type maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { KmlPolygon, PolygonRing } from "../../lib/kmz";

const SRC_FILL = "poly-fill";
const SRC_LINE = "poly-line";
const SRC_DRAFT = "poly-draft";
const SRC_DRAFT_PTS = "poly-draft-pts";
const SRC_EDIT_VERTICES = "poly-edit-vertices";
const SRC_EDIT_MIDPOINTS = "poly-edit-midpoints";

const LYR_FILL = "poly-fill";
const LYR_LINE = "poly-line";
const LYR_LABEL = "poly-label";
const LYR_DRAFT_LINE = "poly-draft-line";
const LYR_DRAFT_PTS = "poly-draft-pts";
export const LYR_POLY_EDIT_VERTICES = "poly-edit-vertices";
export const LYR_POLY_EDIT_MIDPOINTS = "poly-edit-midpoints";

type Props = {
  map: maplibregl.Map | null;
  styleReady: number;
  polygons: KmlPolygon[];
  draftPoints: PolygonRing;
  drawing: boolean;
  editing: boolean;
};

export default function PolygonLayer({
  map,
  styleReady,
  polygons,
  draftPoints,
  drawing,
  editing,
}: Props) {
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      ensure(map);
      write(map, polygons, draftPoints, drawing, editing);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("styledata", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady]);

  useEffect(() => {
    if (!map || !map.getSource(SRC_FILL)) return;
    write(map, polygons, draftPoints, drawing, editing);
  }, [map, polygons, draftPoints, drawing, editing]);

  return null;
}

function ensure(map: maplibregl.Map) {
  for (const id of [
    SRC_FILL,
    SRC_LINE,
    SRC_DRAFT,
    SRC_DRAFT_PTS,
    SRC_EDIT_VERTICES,
    SRC_EDIT_MIDPOINTS,
  ]) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: "geojson", data: empty() });
    }
  }
  if (!map.getLayer(LYR_FILL)) {
    map.addLayer({
      id: LYR_FILL,
      type: "fill",
      source: SRC_FILL,
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": ["get", "fillOpacity"],
      },
    });
  }
  if (!map.getLayer(LYR_LINE)) {
    map.addLayer({
      id: LYR_LINE,
      type: "line",
      source: SRC_LINE,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 2,
      },
    });
  }
  if (!map.getLayer(LYR_LABEL)) {
    map.addLayer({
      id: LYR_LABEL,
      type: "symbol",
      source: SRC_LINE,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-font": ["Open Sans Regular"],
        "symbol-placement": "line",
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": ["get", "color"],
        "text-halo-color": "#0b0f14",
        "text-halo-width": 1.2,
      },
    });
  }
  if (!map.getLayer(LYR_DRAFT_LINE)) {
    map.addLayer({
      id: LYR_DRAFT_LINE,
      type: "line",
      source: SRC_DRAFT,
      paint: {
        "line-color": "#fbbf24",
        "line-width": 2,
        "line-dasharray": [2, 2],
      },
    });
  }
  if (!map.getLayer(LYR_DRAFT_PTS)) {
    map.addLayer({
      id: LYR_DRAFT_PTS,
      type: "circle",
      source: SRC_DRAFT_PTS,
      paint: {
        "circle-radius": 4,
        "circle-color": "#fbbf24",
        "circle-stroke-color": "#0b0f14",
        "circle-stroke-width": 1.5,
      },
    });
  }
  if (!map.getLayer(LYR_POLY_EDIT_MIDPOINTS)) {
    map.addLayer({
      id: LYR_POLY_EDIT_MIDPOINTS,
      type: "circle",
      source: SRC_EDIT_MIDPOINTS,
      paint: {
        "circle-radius": 3.5,
        "circle-color": "#0b0f14",
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.95,
      },
    });
  }
  if (!map.getLayer(LYR_POLY_EDIT_VERTICES)) {
    map.addLayer({
      id: LYR_POLY_EDIT_VERTICES,
      type: "circle",
      source: SRC_EDIT_VERTICES,
      paint: {
        "circle-radius": 5,
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#0b0f14",
        "circle-stroke-width": 2,
      },
    });
  }
}

function write(
  map: maplibregl.Map,
  polygons: KmlPolygon[],
  draftPoints: PolygonRing,
  drawing: boolean,
  editing: boolean,
) {
  const fills: Feature<Geometry>[] = [];
  const lines: Feature<Geometry>[] = [];
  const vertices: Feature<Geometry>[] = [];
  const midpoints: Feature<Geometry>[] = [];

  for (const p of polygons) {
    if (p.outer.length < 3) continue;
    const ring = [...p.outer.map((pt) => [pt.lon, pt.lat] as [number, number])];
    if (
      ring.length > 0 &&
      (ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1])
    ) {
      ring.push(ring[0]);
    }
    const holes = p.holes.map((h) => {
      const r = h.map((pt) => [pt.lon, pt.lat] as [number, number]);
      if (
        r.length > 0 &&
        (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])
      ) {
        r.push(r[0]);
      }
      return r;
    });
    fills.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring, ...holes] },
      properties: {
        color: p.color,
        fillColor: p.fillColor ?? p.color,
        fillOpacity: p.fillColor ? 0.18 : 0,
        name: p.name,
        polyId: p.id,
      },
    });
    lines.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: ring },
      properties: { color: p.color, name: p.name, polyId: p.id },
    });

    if (editing && !drawing) {
      for (let i = 0; i < p.outer.length; i++) {
        const pt = p.outer[i];
        vertices.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [pt.lon, pt.lat] },
          properties: { color: p.color, polyId: p.id, index: i },
        });

        const next = p.outer[(i + 1) % p.outer.length];
        midpoints.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [(pt.lon + next.lon) / 2, (pt.lat + next.lat) / 2],
          },
          properties: { color: p.color, polyId: p.id, index: i },
        });
      }
    }
  }

  (map.getSource(SRC_FILL) as maplibregl.GeoJSONSource).setData(fc(fills));
  (map.getSource(SRC_LINE) as maplibregl.GeoJSONSource).setData(fc(lines));
  (map.getSource(SRC_EDIT_VERTICES) as maplibregl.GeoJSONSource).setData(
    fc(vertices),
  );
  (map.getSource(SRC_EDIT_MIDPOINTS) as maplibregl.GeoJSONSource).setData(
    fc(midpoints),
  );

  if (drawing && draftPoints.length > 0) {
    const coords = draftPoints.map((p) => [p.lon, p.lat] as [number, number]);
    const draftLine: Feature<Geometry>[] =
      coords.length >= 2
        ? [
            {
              type: "Feature",
              geometry: { type: "LineString", coordinates: coords },
              properties: {},
            },
          ]
        : [];
    const draftPts: Feature<Geometry>[] = coords.map((c) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: c },
      properties: {},
    }));
    (map.getSource(SRC_DRAFT) as maplibregl.GeoJSONSource).setData(
      fc(draftLine),
    );
    (map.getSource(SRC_DRAFT_PTS) as maplibregl.GeoJSONSource).setData(
      fc(draftPts),
    );
  } else {
    (map.getSource(SRC_DRAFT) as maplibregl.GeoJSONSource).setData(empty());
    (map.getSource(SRC_DRAFT_PTS) as maplibregl.GeoJSONSource).setData(empty());
  }
}

function fc(features: Feature<Geometry>[]): FeatureCollection<Geometry> {
  return { type: "FeatureCollection", features };
}

function empty(): FeatureCollection<Geometry> {
  return { type: "FeatureCollection", features: [] };
}
