# Phase 8 — Polygons & KMZ

**Shipped:** 2026-05-18

## Goal

Draw and persist polygons (training areas, MOAs, restricted zones) and exchange them with Google Earth / Foreflight via KMZ.

## What landed

- `src/lib/kmz.ts`:
  - `readKmzOrKml(file)`: unzips KMZ (via JSZip) or reads KML; parses `<Polygon>` placemarks with outer + inner rings; extracts KML AABBGGRR colors.
  - `buildKmz(polygons)`: emits KML with `LineStyle` / `PolyStyle` and packages into a KMZ blob.
  - `downloadKmz(blob, name)`.
- `polygonStore`: in-memory + localStorage; supports drawing draft, finishing draft, and arbitrary import.
- `PolygonLayer` on the map renders polygons with fill+outline+name label.
- `PolygonPanel` (top-left, next to toolbar):
  - **Draw** mode: clicks add vertices, double-click or Finish closes (≥3 points required).
  - **Upload** KMZ/KML, **Download** all current polygons as one KMZ.
  - Per-polygon list with rename, vertex count, delete.

## Decisions

- Single doc.kml inside the KMZ; styles inlined per placemark by index.
- KML alpha is 0x88 (slightly transparent) for fill, fully opaque for outline.
- Local polygons persist across reloads independently from the scenario.

## Key files

- `src/lib/kmz.ts`
- `src/store/polygonStore.ts`
- `src/components/Map/PolygonLayer.tsx`
- `src/components/PolygonPanel.tsx`

## Known caveats

- Drawing tool uses double-click to finish; clicking polygon vertices in quick succession can fire the dblclick. Workaround: use the Finish button.
- No editing of polygon vertices after creation yet — only rename/delete.
