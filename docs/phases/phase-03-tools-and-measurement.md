# Phase 3 — Map Toolbar & Measurements

**Shipped:** 2026-05-17 (toolbar + first ruler/protractor) + **2026-05-17** rebuild (multi-measurement, anchor, realtime).

## Goal

Map tools for dropping waypoints, measuring distance/bearing, and measuring
angles. Aircraft are repositioned by dragging their symbols directly. Multiple
measurements coexist and stay live as aircraft move.

## What landed

### Toolbar (left side of map)

Modes: **Select/Pan, Add waypoint, Ruler, Protractor**. Esc returns to Select.

v1.0.1 follow-up: aircraft placement moved out of the toolbar. Drag the
aircraft symbol directly on the map to reposition it.

### Measurement system

- `toolStore` holds an array of `Measurement`s (no longer simple point arrays). Each has a type, name, color, points, and a `closed` flag.
- Each point is a `MeasurementAnchor`:
  - `{ kind: "fixed", lat, lon }`
  - `{ kind: "aircraft", aircraftId }` — follows live aircraft
  - `{ kind: "replay-aircraft", aircraftId }` — follows ghost replay aircraft
- Floating `MeasurementPanel` (bottom-right): lists all measurements, shows live readout, rename / edit / delete / clear.
- Ruler: per-leg `nm  km  °M` labels on the map plus total `Σ nm`.
- Protractor: 3 points, vertex angle.

### Snap-to-aircraft

- Click within snap radius (default 22 px, configurable in Settings) of a live or replay aircraft anchors the point to it.
- Anchored points get a white-ringed marker; live aircraft show as `✈N`, replay as `RN` badges in the panel.

### Coordinates

- DD MM.MMM with hemisphere letters everywhere (`N 13° 54.567'  E 100° 36.234'`).
- `src/lib/coords.ts` has `formatDDM` and a flexible `parseDDM` that accepts multiple delimiters.

## Decisions

- Anchored measurements re-resolve every frame, so a ruler between two aircraft updates live during sim playback and replay scrubbing.
- Switching to Ruler/Protractor auto-starts a fresh measurement so users don't accidentally extend an old one.

## Key files

- `src/store/toolStore.ts`
- `src/components/Map/Toolbar.tsx`, `MeasurementLayer.tsx`
- `src/components/Map/AircraftDragInteractions.tsx`
- `src/components/MeasurementPanel.tsx`
- `src/lib/coords.ts`

## Known caveats

- Snap range is global, not per-tool. Settings tweaks it for both ruler and protractor.
