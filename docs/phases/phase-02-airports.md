# Phase 2 — Thailand Airports & Base Selector

**Shipped:** 2026-05-17

## Goal

Show all Thai airports and runways on the map, with a base selector that places the selected aircraft on a chosen ICAO's runway with heading aligned to it.

## What landed

- Build-time script `scripts/build-airport-data.ts` that fetches OurAirports CSVs and filters to `iso_country=TH`. Outputs:
  - `public/data/th_airports.json` (106 entries)
  - `public/data/th_runways.json` (86 entries)
- `AirportLayer` on the map: dots scaled and coloured by type (large/medium/small), runway polylines, ICAO labels above zoom 7.
- `BaseSelector` dropdown in the top bar — RTAF priority list (Takhli VTBU, Korat VTUN, Surat Thani VTSB, etc.) at the top, full Thai list below.
- Selecting a base pans/zooms the map and snaps the selected aircraft to the runway midpoint with heading set to the runway's true heading converted to magnetic.

## Decisions

- Bundle the data into `public/` rather than fetching at runtime — keeps the container offline-friendly after first load.
- Filter `closed`, `heliport`, `seaplane_base` types in the build script.
- Use `gps_code` (ICAO) over the raw `ident` when available.

## Key files

- `scripts/build-airport-data.ts`
- `src/lib/airports.ts`
- `src/components/Map/AirportLayer.tsx`
- `src/components/BaseSelector.tsx`

## Operations

To refresh airport data when OurAirports updates:

```bash
npm run build:airports
```

Commit the regenerated JSON files.
