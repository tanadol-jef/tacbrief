import { useEffect, useState } from "react";
import type maplibregl from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import {
  loadAirports,
  loadRunways,
  type Airport,
  type Runway,
} from "../../lib/airports";

const SRC_AP = "ap-points";
const SRC_RW = "ap-runways";
const LYR_RW = "ap-runways";
const LYR_AP_DOT = "ap-dot";
const LYR_AP_LABEL = "ap-label";

type Props = {
  map: maplibregl.Map | null;
  styleReady: number;
};

export default function AirportLayer({ map, styleReady }: Props) {
  const [data, setData] = useState<{
    airports: Airport[];
    runways: Runway[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadAirports(), loadRunways()]).then(
      ([airports, runways]) => {
        if (!cancelled) setData({ airports, runways });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!map || !data) return;
    const apply = () => {
      ensureSources(map, data.airports, data.runways);
      ensureLayers(map);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("styledata", apply);
  }, [map, styleReady, data]);

  return null;
}

function ensureSources(
  map: maplibregl.Map,
  airports: Airport[],
  runways: Runway[],
) {
  const apFC: FeatureCollection<Geometry> = {
    type: "FeatureCollection",
    features: airports.map((a) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [a.lon, a.lat] },
      properties: {
        icao: a.icao,
        type: a.type,
        name: a.name,
      },
    })),
  };
  const rwFC: FeatureCollection<Geometry> = {
    type: "FeatureCollection",
    features: runways
      .filter(
        (r) =>
          Number.isFinite(r.le.lat) &&
          Number.isFinite(r.le.lon) &&
          Number.isFinite(r.he.lat) &&
          Number.isFinite(r.he.lon),
      )
      .map((r) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [r.le.lon, r.le.lat],
            [r.he.lon, r.he.lat],
          ],
        },
        properties: { icao: r.icao, length: r.lengthFt },
      })),
  };

  const apSrc = map.getSource(SRC_AP) as maplibregl.GeoJSONSource | undefined;
  if (apSrc) apSrc.setData(apFC);
  else map.addSource(SRC_AP, { type: "geojson", data: apFC });

  const rwSrc = map.getSource(SRC_RW) as maplibregl.GeoJSONSource | undefined;
  if (rwSrc) rwSrc.setData(rwFC);
  else map.addSource(SRC_RW, { type: "geojson", data: rwFC });
}

function ensureLayers(map: maplibregl.Map) {
  if (!map.getLayer(LYR_RW)) {
    map.addLayer({
      id: LYR_RW,
      type: "line",
      source: SRC_RW,
      minzoom: 9,
      paint: {
        "line-color": "#94a3b8",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          9,
          1,
          14,
          4,
        ],
      },
    });
  }
  if (!map.getLayer(LYR_AP_DOT)) {
    map.addLayer({
      id: LYR_AP_DOT,
      type: "circle",
      source: SRC_AP,
      paint: {
        "circle-radius": [
          "match",
          ["get", "type"],
          "large_airport",
          5,
          "medium_airport",
          4,
          3,
        ],
        "circle-color": [
          "match",
          ["get", "type"],
          "large_airport",
          "#fbbf24",
          "medium_airport",
          "#cbd5e1",
          "#64748b",
        ],
        "circle-stroke-color": "#0b0f14",
        "circle-stroke-width": 1,
      },
    });
  }
  if (!map.getLayer(LYR_AP_LABEL)) {
    map.addLayer({
      id: LYR_AP_LABEL,
      type: "symbol",
      source: SRC_AP,
      minzoom: 7,
      layout: {
        "text-field": ["get", "icao"],
        "text-size": [
          "match",
          ["get", "type"],
          "large_airport",
          12,
          "medium_airport",
          11,
          10,
        ],
        "text-offset": [0, 0.9],
        "text-anchor": "top",
        "text-font": ["Open Sans Regular"],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#cbd5e1",
        "text-halo-color": "#0b0f14",
        "text-halo-width": 1.2,
      },
    });
  }
}
