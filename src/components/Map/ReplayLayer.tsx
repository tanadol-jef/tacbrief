import { useEffect } from "react";
import type maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { frameAt, type RecordingFile } from "../../store/recordingStore";
import { magToTrue } from "../../lib/magnetic";

const SRC = "replay-ghosts";
const LYR_ICON = "replay-ghost-icon";
const LYR_LABEL = "replay-ghost-label";

const ICON_ID = "tac-aircraft"; // shared with AircraftLayer

type Props = {
  map: maplibregl.Map | null;
  styleReady: number;
  imported: RecordingFile | null;
  replayMode: boolean;
  replayTime: number;
};

export default function ReplayLayer({
  map,
  styleReady,
  imported,
  replayMode,
  replayTime,
}: Props) {
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      ensure(map);
      write(map, imported, replayMode, replayTime);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("styledata", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady]);

  useEffect(() => {
    if (!map || !map.getSource(SRC)) return;
    write(map, imported, replayMode, replayTime);
  }, [map, imported, replayMode, replayTime]);

  return null;
}

function ensure(map: maplibregl.Map) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: "geojson", data: empty() });
  }
  if (!map.getLayer(LYR_ICON)) {
    map.addLayer({
      id: LYR_ICON,
      type: "symbol",
      source: SRC,
      layout: {
        "icon-image": ICON_ID,
        "icon-size": 0.36,
        "icon-rotate": ["get", "headingTrue"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-color": ["get", "color"],
        "icon-halo-color": "#0b0f14",
        "icon-halo-width": 1.2,
        "icon-opacity": 0.85,
      },
    });
  }
  if (!map.getLayer(LYR_LABEL)) {
    map.addLayer({
      id: LYR_LABEL,
      type: "symbol",
      source: SRC,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 10,
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

function write(
  map: maplibregl.Map,
  imported: RecordingFile | null,
  replayMode: boolean,
  replayTime: number,
) {
  if (!replayMode || !imported) {
    (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(empty());
    return;
  }
  const frame = frameAt(imported, replayTime);
  const features: Feature<Geometry>[] = [];
  for (const ac of frame.values()) {
    const trueDeg = magToTrue(ac.headingMagDeg, ac.lat, ac.lon);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [ac.lon, ac.lat] },
      properties: {
        color: ac.color,
        headingTrue: trueDeg,
        label: `${ac.callsign}·R\n${Math.round(ac.speedKt)}kt FL${Math.round(
          ac.altFt / 100,
        )}\n${Math.round(ac.headingMagDeg).toString().padStart(3, "0")}°M`,
      },
    });
  }
  (map.getSource(SRC) as maplibregl.GeoJSONSource).setData({
    type: "FeatureCollection",
    features,
  });
}

function empty(): FeatureCollection<Geometry> {
  return { type: "FeatureCollection", features: [] };
}
