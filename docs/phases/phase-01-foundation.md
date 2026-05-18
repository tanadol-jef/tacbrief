# Phase 1 — Foundation

**Shipped:** 2026-05-17

## Goal

Stand up the app skeleton: Vite/React/TS scaffold, MapLibre with a layer switcher, the core aircraft data model, and the turn-circle / magnetic-heading math.

## What landed

- Vite 6 + React 19 + TypeScript skeleton, Tailwind v4 via `@tailwindcss/vite`, Zustand for state.
- MapLibre GL JS 5 mounted in `src/components/Map/MapView.tsx`, centred on Thailand.
- Layer switcher with Dark / OSM / Esri Satellite / OpenTopo basemaps + an OpenAIP overlay toggle.
- Aircraft data model (`src/types.ts`) and Zustand store `scenarioStore` with up to 4 aircraft.
- RTAF preset library in `src/presets/aircraft.ts` (F-16A, Gripen C, T-50TH, F-5E, L-39, Custom).
  - **Caveat:** numbers are public-domain approximations, not authoritative. See README/phase-12 for replacement plan.
- Side-panel `AircraftCard` with sliders for speed, alt, heading, bank, G; numeric inputs editable.
- Flight math (`src/lib/flightMath.ts`): TAS via ISA, turn radius `R = V²/(g·tan φ)`, turn rate, bank↔G.
- Magnetic declination via `geomagnetism` npm (WMM 2020 model pinned to 2024-06-01).
- Aircraft rendered as map symbol with heading vector and left/right turn circles (preview only when wings-level).

## Decisions

- **Magnetic headings everywhere in UI**, true geometry internally. Conversion at the boundary in `lib/magnetic.ts`.
- **Dual bank/G control**: both shown, the last-touched one is "active" (dot indicator). Other is derived.
- **WMM pinned date**: bundled lib only valid to 2024-12. Pinning to mid-2024 limits Thailand declination error to ~0.05°/yr — invisible at briefing scale through 2026.
- 4 aircraft cap is deliberate; ids are fixed 1..4 so formation slot math is simple.

## Key files

- `src/App.tsx`, `src/main.tsx`, `src/index.css`
- `src/components/Map/MapView.tsx`, `LayerSwitcher.tsx`, `AircraftLayer.tsx`, `DeclinationIndicator.tsx`
- `src/components/Panel/SidePanel.tsx`, `AircraftCard.tsx`, `Slider.tsx`
- `src/store/scenarioStore.ts`, `mapStore.ts`
- `src/lib/flightMath.ts`, `atmosphere.ts`, `magnetic.ts`, `units.ts`, `coords.ts`
- `src/types.ts`, `src/presets/aircraft.ts`

## Known caveats

- Aircraft performance numbers are placeholders.
- WMM model expires; would need replacement when geomagnetism ships WMM-2025.
