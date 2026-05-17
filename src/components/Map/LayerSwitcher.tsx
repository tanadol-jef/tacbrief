import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "osm" | "dark" | "esri-imagery" | "opentopo";

export const BASEMAPS: { id: BasemapId; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "osm", label: "OSM" },
  { id: "esri-imagery", label: "Satellite" },
  { id: "opentopo", label: "Topo" },
];

export const OPENAIP_OVERLAY_ID = "openaip";

type RasterSource = {
  type: "raster";
  tiles: string[];
  tileSize: number;
  attribution: string;
  maxzoom?: number;
};

const SOURCES: Record<BasemapId, RasterSource> = {
  dark: {
    type: "raster",
    tiles: [
      "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    ],
    tileSize: 256,
    attribution: "© OpenStreetMap contributors © CARTO",
    maxzoom: 19,
  },
  osm: {
    type: "raster",
    tiles: [
      "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    ],
    tileSize: 256,
    attribution: "© OpenStreetMap contributors © CARTO",
    maxzoom: 19,
  },
  "esri-imagery": {
    type: "raster",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    tileSize: 256,
    attribution: "Tiles © Esri — World Imagery",
    maxzoom: 19,
  },
  opentopo: {
    type: "raster",
    tiles: [
      "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
    ],
    tileSize: 256,
    attribution: "© OpenTopoMap (CC-BY-SA)",
    maxzoom: 17,
  },
};

const OPENAIP_SOURCE: RasterSource = {
  type: "raster",
  tiles: [
    "https://a.tile.maps.openaip.net/geowebcache/service/tms/1.0.0/openaip_basemap@EPSG%3A900913@png/{z}/{x}/{y}.png",
    "https://b.tile.maps.openaip.net/geowebcache/service/tms/1.0.0/openaip_basemap@EPSG%3A900913@png/{z}/{x}/{y}.png",
  ],
  tileSize: 256,
  attribution: "© OpenAIP",
  maxzoom: 14,
};

export function buildStyle(
  basemap: BasemapId,
  overlay: boolean,
): StyleSpecification {
  const sources: StyleSpecification["sources"] = {
    base: SOURCES[basemap],
  };
  const layers: StyleSpecification["layers"] = [
    { id: "base", type: "raster", source: "base" },
  ];
  if (overlay) {
    sources.openaip = OPENAIP_SOURCE;
    layers.push({
      id: "openaip",
      type: "raster",
      source: "openaip",
      paint: { "raster-opacity": 0.75 },
    });
  }
  return {
    version: 8,
    sources,
    layers,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  };
}

type Props = {
  basemap: BasemapId;
  onBasemapChange: (id: BasemapId) => void;
  overlay: boolean;
  onOverlayChange: (on: boolean) => void;
};

export default function LayerSwitcher({
  basemap,
  onBasemapChange,
  overlay,
  onOverlayChange,
}: Props) {
  return (
    <div className="absolute right-2 top-2 flex flex-col gap-2 rounded bg-tac-panel/90 p-2 text-xs ring-1 ring-tac-border backdrop-blur">
      <div className="font-semibold uppercase tracking-wider text-slate-400">
        Basemap
      </div>
      <div className="flex flex-col gap-1">
        {BASEMAPS.map((b) => (
          <label
            key={b.id}
            className="flex cursor-pointer items-center gap-2 text-slate-200"
          >
            <input
              type="radio"
              name="basemap"
              checked={basemap === b.id}
              onChange={() => onBasemapChange(b.id)}
              className="accent-tac-accent"
            />
            {b.label}
          </label>
        ))}
      </div>
      <div className="mt-1 border-t border-tac-border pt-2 font-semibold uppercase tracking-wider text-slate-400">
        Overlays
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-slate-200">
        <input
          type="checkbox"
          checked={overlay}
          onChange={(e) => onOverlayChange(e.target.checked)}
          className="accent-tac-accent"
        />
        OpenAIP
      </label>
    </div>
  );
}
