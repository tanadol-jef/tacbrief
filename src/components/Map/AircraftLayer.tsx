import { useEffect } from "react";
import type maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import * as turf from "@turf/turf";
import type { Aircraft } from "../../types";
import { summarizeTurn } from "../../lib/flightMath";
import { magToTrue } from "../../lib/magnetic";
import { useSettings } from "../../store/settingsStore";

const SRC_POINTS = "ac-points";
const SRC_HEADING = "ac-heading";
const SRC_CIRCLES = "ac-circles";
const SRC_TRAIL = "ac-trail";

const LYR_TRAIL = "ac-trail";
const LYR_CIRCLES_FILL = "ac-circles-fill";
const LYR_CIRCLES_LINE = "ac-circles-line";
const LYR_HEADING = "ac-heading";
const LYR_POINTS = "ac-points";
const LYR_LABELS = "ac-labels";

const ICON_ID = "tac-aircraft";
const ICON_SIZE = 64;

type Props = {
  map: maplibregl.Map | null;
  styleReady: number;
  aircraft: Aircraft[];
  selectedId: number;
};

export default function AircraftLayer({
  map,
  styleReady,
  aircraft,
  selectedId,
}: Props) {
  const showCirclesInTurn = useSettings((s) => s.showTurnCirclesInTurn);

  useEffect(() => {
    if (!map) return;
    const add = () => {
      ensureIcon(map);
      ensureSources(map);
      ensureLayers(map);
      writeData(map, aircraft, selectedId, showCirclesInTurn);
    };
    if (map.isStyleLoaded()) add();
    else map.once("styledata", add);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady]);

  useEffect(() => {
    if (!map || !map.getSource(SRC_POINTS)) return;
    writeData(map, aircraft, selectedId, showCirclesInTurn);
  }, [map, aircraft, selectedId, showCirclesInTurn]);

  return null;
}

function ensureIcon(map: maplibregl.Map) {
  if (map.hasImage(ICON_ID)) return;
  // Top-view aircraft silhouette. White so we can recolor with icon-color.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <g fill="#ffffff" stroke="#000" stroke-width="1.5" stroke-linejoin="round">
        <path d="M32 4 L34 26 L60 36 L60 42 L34 38 L34 52 L40 56 L40 60 L32 58 L24 60 L24 56 L30 52 L30 38 L4 42 L4 36 L30 26 Z"/>
      </g>
    </svg>`;
  const img = new Image(ICON_SIZE, ICON_SIZE);
  img.onload = () => {
    if (!map.hasImage(ICON_ID)) {
      map.addImage(ICON_ID, img, { sdf: true });
    }
  };
  img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
}

function ensureSources(map: maplibregl.Map) {
  for (const id of [SRC_POINTS, SRC_HEADING, SRC_CIRCLES, SRC_TRAIL]) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: "geojson", data: empty() });
    }
  }
}

function ensureLayers(map: maplibregl.Map) {
  if (!map.getLayer(LYR_TRAIL)) {
    map.addLayer({
      id: LYR_TRAIL,
      type: "line",
      source: SRC_TRAIL,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.5,
        "line-opacity": 0.65,
      },
    });
  }
  if (!map.getLayer(LYR_CIRCLES_FILL)) {
    map.addLayer({
      id: LYR_CIRCLES_FILL,
      type: "fill",
      source: SRC_CIRCLES,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.06,
      },
    });
  }
  if (!map.getLayer(LYR_CIRCLES_LINE)) {
    map.addLayer({
      id: LYR_CIRCLES_LINE,
      type: "line",
      source: SRC_CIRCLES,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1,
        "line-dasharray": [2, 2],
        "line-opacity": 0.5,
      },
    });
  }
  if (!map.getLayer(LYR_HEADING)) {
    map.addLayer({
      id: LYR_HEADING,
      type: "line",
      source: SRC_HEADING,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 2,
      },
    });
  }
  if (!map.getLayer(LYR_POINTS)) {
    map.addLayer({
      id: LYR_POINTS,
      type: "symbol",
      source: SRC_POINTS,
      layout: {
        "icon-image": ICON_ID,
        "icon-size": [
          "case",
          ["==", ["get", "selected"], true],
          0.45,
          0.36,
        ],
        "icon-rotate": ["get", "headingTrue"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-color": ["get", "color"],
        "icon-halo-color": "#0b0f14",
        "icon-halo-width": 1.2,
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
        "text-offset": [0, 2.0],
        "text-anchor": "top",
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

function writeData(
  map: maplibregl.Map,
  aircraft: Aircraft[],
  selectedId: number,
  showCirclesInTurn: boolean,
) {
  const pts: Feature<Geometry>[] = [];
  const hdg: Feature<Geometry>[] = [];
  const circ: Feature<Geometry>[] = [];
  const trails: Feature<Geometry>[] = [];

  for (const a of aircraft) {
    if (!a.visible) continue;
    const { lat, lon } = a.position;
    const trueDeg = magToTrue(a.headingMagDeg, lat, lon);
    const t = summarizeTurn(a.speedKt, a.altitudeFt, a.bankDeg);
    const turning = Math.abs(a.bankDeg) > 0.5;

    pts.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        aircraftId: a.id,
        color: a.color,
        selected: a.id === selectedId,
        headingTrue: trueDeg,
        label: `${a.callsign}\n${Math.round(a.speedKt)}kt  FL${Math.round(
          a.altitudeFt / 100,
        )}\n${Math.round(a.headingMagDeg).toString().padStart(3, "0")}°M`,
      },
    });

    // Heading vector — 5 nm
    const tip = turf.destination([lon, lat], 5, trueDeg, {
      units: "nauticalmiles",
    });
    hdg.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [lon, lat],
          tip.geometry.coordinates,
        ],
      },
      properties: { color: a.color },
    });

    // Turn circles — preview when wings-level (or always, if user opts in).
    const drawCircles =
      (!turning || showCirclesInTurn) &&
      Number.isFinite(t.radiusNm) &&
      t.radiusNm > 0;
    if (drawCircles) {
      const rightBrg = (trueDeg + 90) % 360;
      const leftBrg = (trueDeg + 270) % 360;
      for (const brg of [rightBrg, leftBrg]) {
        const center = turf.destination([lon, lat], t.radiusNm, brg, {
          units: "nauticalmiles",
        });
        const circle = turf.circle(center, t.radiusNm, {
          steps: 72,
          units: "nauticalmiles",
        });
        circle.properties = { color: a.color, radiusNm: t.radiusNm };
        circ.push(circle as Feature<Geometry>);
      }
    }

    const trail = a.trail ?? [];
    if (trail.length >= 2) {
      trails.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: trail.map((p) => [p.lon, p.lat]),
        },
        properties: { color: a.color, aircraftId: a.id },
      });
    }
  }

  (map.getSource(SRC_POINTS) as maplibregl.GeoJSONSource).setData(fc(pts));
  (map.getSource(SRC_HEADING) as maplibregl.GeoJSONSource).setData(fc(hdg));
  (map.getSource(SRC_CIRCLES) as maplibregl.GeoJSONSource).setData(fc(circ));
  (map.getSource(SRC_TRAIL) as maplibregl.GeoJSONSource).setData(fc(trails));
}

function fc(features: Feature<Geometry>[]): FeatureCollection<Geometry> {
  return { type: "FeatureCollection", features };
}

function empty(): FeatureCollection<Geometry> {
  return { type: "FeatureCollection", features: [] };
}
