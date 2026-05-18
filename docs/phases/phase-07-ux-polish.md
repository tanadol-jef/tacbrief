# Phase 7 — UX Polish

**Shipped:** 2026-05-17 → 2026-05-18 (incremental)

## Goal

Make the day-to-day workflow comfortable: better defaults, fewer foot-guns, sensible visuals.

## What landed

- **Dark CARTO basemap** as default (was OSM voyager). Pure black-grey base reads well behind colored aircraft.
- **Top-view aircraft icon** as an SVG SDF image, rotated by true heading, recolored per aircraft.
- **10-second trail** per aircraft (sampled at 5 Hz by default). Decays after the configured window.
- **Hide turn circles during turns**: while wings-level the dashed circles show as planning preview; once bank goes non-zero they disappear unless overridden in Settings.
- **Typeable values everywhere**: every slider has a number input above the bar (Enter commits, Esc cancels, blur commits).
- **Sync edits toggle** in the sidebar header: when on, parameter edits (speed, alt, heading, bank, G, preset, rollout heading) apply to all aircraft. Per-aircraft identity fields (callsign, position, route, trail, color) never broadcast.
- **Hotkeys**: Esc → Select tool, 1–4 → select aircraft, Space → play/pause.
- **Settings popover** (gear in top bar): trail seconds, sample Hz, snap radius px, "keep turn circles in turn" toggle.
- **Side-panel fit**: short preset codes (F-16A, Gripen-C, …) in the dropdown, narrower callsign input, shrink-0 on action buttons so the × can't get pushed off.
- **Layout**: measurement panel docked bottom-right; declination indicator merged into the bottom-left coord readout to keep corners uncluttered; toolbar fixed top-left.

## Decisions

- Settings live in their own store and localStorage key so they survive scenario imports.
- Trail config flows from settings into the sim tick (no constants in scenarioStore).
- Tailwind v4 `@theme` block defines `tac-*` palette tokens used across all UI panels.

## Key files

- `src/store/settingsStore.ts`
- `src/components/SettingsPanel.tsx`
- `src/components/Map/AircraftLayer.tsx` (SDF icon, trail layer)
- `src/components/Panel/Slider.tsx` (typeable values)
- `src/lib/useHotkeys.ts`
