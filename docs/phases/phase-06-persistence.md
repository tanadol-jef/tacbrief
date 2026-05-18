# Phase 6 — Persistence

**Shipped:** 2026-05-17

## Goal

Scenarios survive reloads and can be shared as JSON files.

## What landed

- `src/lib/persistence.ts` with versioned (`v1`) Scenario schema.
- `scenarioStore` autosaves on every change (debounced 400 ms) to `localStorage` under `tacbrief.scenario.v1`.
- `ImportExport` component (top bar):
  - **Download**: writes `tacbrief-scenario-<timestamp>.json`.
  - **Upload**: loads a scenario file and replaces current state.
- A `migrate()` step fills in missing fields when loading older saves, so the app keeps working when the schema grows.
- Settings autosave under `tacbrief.settings.v1`.
- Polygons autosave under `tacbrief.polygons.v1`.

## Decisions

- Three independent localStorage keys keep scenario / settings / polygons separable.
- Imported scenarios cause a full replace, not a merge.
- Recording files (see phase 10) are a separate concept and never auto-saved — they're explicit downloads only.

## Key files

- `src/lib/persistence.ts`
- `src/store/settingsStore.ts`, `polygonStore.ts`
- `src/components/ImportExport.tsx`
