# TacBrief — Project Plan

Tactical briefing visualizer for fighter formations operating from Thai airbases. Self-hosted on TrueNAS via Dockge. Vite + React + MapLibre + TypeScript.

This file is the **index**. Each phase lives in [`docs/phases/`](docs/phases/) with detailed goals, design decisions, and a changelog.

## Status

| Phase | Theme | State |
|---|---|---|
| 1 | [Foundation — scaffold, map, aircraft model, turn math](docs/phases/phase-01-foundation.md) | ✅ Shipped |
| 2 | [Thailand airports & base selector](docs/phases/phase-02-airports.md) | ✅ Shipped |
| 3 | [Map toolbar & measurements](docs/phases/phase-03-tools-and-measurement.md) | ✅ Shipped |
| 4 | [Time engine & maneuver sequence](docs/phases/phase-04-time-engine.md) | ✅ Shipped |
| 5 | [Formations](docs/phases/phase-05-formations.md) | ✅ Shipped |
| 6 | [Persistence — JSON / localStorage](docs/phases/phase-06-persistence.md) | ✅ Shipped |
| 7 | [UX polish — theme, icon, trails, settings, sync](docs/phases/phase-07-ux-polish.md) | ✅ Shipped |
| 8 | [Polygons & KMZ import/export](docs/phases/phase-08-polygons-kmz.md) | ✅ Shipped |
| 9 | [Waypoint editor & rollout heading](docs/phases/phase-09-waypoints-rollout.md) | ✅ Shipped |
| 10 | [Record & replay](docs/phases/phase-10-record-replay.md) | ✅ Shipped |
| 11 | [Deployment — Docker, GitHub, TrueNAS/Dockge](docs/phases/phase-11-deployment.md) | ✅ Shipped |
| 12 | [Floating windows, minimizable taskbar & saved layouts](docs/phases/phase-12-floating-windows.md) | ✅ Shipped |
| 13 | [Collapsible sidebar & map UI polish](docs/phases/phase-13-sidebar.md) | ✅ Shipped |
| 14 | [Polygon vertex editing & styling](docs/phases/phase-14-polygon-vertex-editing.md) | ✅ Shipped |
| 15 | [Scenario programming workflow & aircraft status window](docs/phases/phase-15-scenario-programming.md) | ✅ Shipped |
| 16 | [**Next session** — provisions and postponed refinements](docs/phases/phase-16-next-session.md) | 🟡 Planned |

## Quick reference

- Stack: Vite 6, React 19, TypeScript, Zustand, Tailwind v4, MapLibre GL JS 5, Turf.js, geomagnetism, JSZip, Lucide icons.
- Map: dark CARTO basemap by default. Layers: Dark / OSM / Satellite / Topo + OpenAIP overlay.
- Units: kt / ft / nm / °M. Coordinates: DD MM.MMM with hemisphere letter.
- Math: TAS turn radius `R = V²/(g·tan φ)`. Magnetic declination via WMM 2020, pinned to 2024-06 (good enough for Thailand through 2026).
- Persistence: localStorage for scenario, settings, polygons. Recording is JSON download/upload.
- Deployment: nginx:alpine static SPA inside a multi-stage Docker build, fronted by Dockge on TrueNAS at host port **8090**.

## Conventions

- All flight headings are **magnetic** (°M) in the UI; internal geo math is true; conversion happens via `lib/magnetic.ts`.
- Aircraft IDs are fixed `1..4`. Lead is always id 1 for linked formations.
- New non-trivial features get a phase file under `docs/phases/`. Update this index when you ship one.
- Bug fixes during a phase land in that same phase file's changelog section.

## How to update

When a new phase starts, copy [`docs/phases/phase-16-next-session.md`](docs/phases/phase-16-next-session.md) into a fresh `phase-NN-<topic>.md`, add an entry to the table above, and start writing.
