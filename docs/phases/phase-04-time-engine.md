# Phase 4 — Time Engine & Maneuver Sequence

**Shipped:** 2026-05-17

## Goal

Drive the sim forward in time with `requestAnimationFrame`, advance each aircraft via physics, and let the user pre-program a maneuver sequence (turn to heading, set speed, set altitude, hold, waypoint).

## What landed

### Time engine

- `src/lib/useSimulation.ts` runs an RAF loop with `dt` cap of 100 ms.
- `scenarioStore.tick(dt)` advances each aircraft via `advanceAircraft`:
  - Picks turn direction from heading error.
  - Applies commanded bank up to preset's max-G (where applicable).
  - Integrates heading via `ω = g·tan φ / V`, position via TAS · dt along true heading.
- Play / Pause / Reset (`PlayBar` component). `t+MM:SS` clock.
- Reset restores the snapshot taken at first Play, plus clears all trails and sequence indices.

### Maneuver sequence per aircraft

`ManeuverStep` discriminated union:

- `turn-to`: heading °M and bank °. Aircraft turns to the heading, rolls wings-level on capture, then advances to the next step.
- `set-speed`: ramps IAS at 8 kt/s.
- `set-altitude`: ramps at `climbRateFpm` (default 2000).
- `waypoint`: existing waypoint-capture logic, 0.3 nm tolerance.
- `hold`: countdown in seconds, ticks down each frame.

`ManeuverEditor` UI in the selected aircraft's card: add / reorder / delete / edit. Currently-running step glows green during playback.

### Trail

10-second history at 5 Hz (configurable in Settings) drawn as a fading polyline behind each aircraft.

## Decisions

- "Roll out at" target heading on the main card is a separate, simpler mechanism for ad-hoc turns; see phase 9.
- Sequence executes serially; no branching, no goto.
- Reset wipes step indices and trail samples, leaving everything else as configured.

## Key files

- `src/lib/useSimulation.ts`
- `src/components/PlayBar.tsx`
- `src/components/Panel/ManeuverEditor.tsx`
- `src/store/scenarioStore.ts` (`tick`, `advanceAircraft`)
- `src/types.ts` (`ManeuverStep`)
