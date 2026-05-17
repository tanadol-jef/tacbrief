import { useEffect } from "react";
import type maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { RecordingFile } from "../../store/recordingStore";

const SRC = "rec-tracks";
const LYR = "rec-tracks";

type Props = {
  map: maplibregl.Map | null;
  styleReady: number;
  imported: RecordingFile | null;
};

export default function RecordingLayer({ map, styleReady, imported }: Props) {
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      ensure(map);
      write(map, imported);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("styledata", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady]);

  useEffect(() => {
    if (!map || !map.getSource(SRC)) return;
    write(map, imported);
  }, [map, imported]);

  return null;
}

function ensure(map: maplibregl.Map) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: "geojson", data: empty() });
  }
  if (!map.getLayer(LYR)) {
    map.addLayer({
      id: LYR,
      type: "line",
      source: SRC,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.5,
        "line-opacity": 0.85,
        "line-dasharray": [3, 2],
      },
    });
  }
}

function write(map: maplibregl.Map, imported: RecordingFile | null) {
  if (!imported || imported.samples.length === 0) {
    (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(empty());
    return;
  }
  // Group samples by aircraft id → polyline per aircraft.
  const byId = new Map<
    number,
    { color: string; callsign: string; coords: [number, number][] }
  >();
  for (const s of imported.samples) {
    for (const ac of s.ac) {
      let entry = byId.get(ac.id);
      if (!entry) {
        entry = { color: ac.color, callsign: ac.callsign, coords: [] };
        byId.set(ac.id, entry);
      }
      entry.coords.push([ac.lon, ac.lat]);
    }
  }
  const features: Feature<Geometry>[] = [];
  for (const [id, e] of byId) {
    if (e.coords.length < 2) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: e.coords },
      properties: { color: e.color, callsign: e.callsign, aircraftId: id },
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
