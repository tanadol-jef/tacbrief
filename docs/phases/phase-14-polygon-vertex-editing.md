# Phase 14 - Polygon vertex editing & styling

**Shipped**

## Goal

Make imported and drawn polygon boundaries editable directly on the map, while
keeping KMZ export backed by the edited geometry.

## What landed

- The polygon panel has an explicit `Edit` toggle for vertex handles.
- In normal non-draw mode, completed polygons render as lines/fill only.
- In edit mode, each polygon outer boundary shows draggable vertex handles.
- Dragging a vertex updates the stored polygon geometry immediately.
- Edge midpoint handles insert a new vertex into the boundary.
- Right-clicking a vertex deletes it, with a minimum of three vertices enforced.
- General map click behavior ignores polygon edit handles so editing does not
  accidentally place aircraft, waypoints, or measurement points.
- Edited polygons persist through localStorage and KMZ export because the same
  `KmlPolygon.outer` data is updated in `polygonStore`.
- Polygon outline color and infill color are now separate.
- New polygons default to no infill. Imported/exported KML/KMZ styles preserve
  explicit fills when present, and no-fill exports as a disabled `PolyStyle`
  fill.
- The polygon panel exposes compact `Line`, `Fill`, and `None` controls without
  widening the panel row.

## Key files

- `src/store/polygonStore.ts` - `moveVertex`, `insertVertex`, and
  `deleteVertex` actions, plus outline/fill color actions.
- `src/components/Map/PolygonLayer.tsx` - vertex and midpoint GeoJSON sources
  and layers, plus separate fill styling.
- `src/components/Map/PolygonEditInteractions.tsx` - drag, insert, and delete
  map interactions.
- `src/components/Map/MapView.tsx` - edit interaction mount and click guard.
- `src/components/PolygonPanel.tsx` - compact polygon color controls.
- `src/lib/kmz.ts` - separate outline/fill KML style import/export.

## Notes

- Editing currently targets the outer polygon boundary. Imported holes still
  render and export, but do not expose edit handles in this phase.
- Aircraft type icons and real performance data are intentionally postponed to
  a later phase.
