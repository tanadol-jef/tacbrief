# Phase 9 — Waypoint Editor & Rollout Heading

**Shipped:** 2026-05-18

## Goal

Manage waypoints directly in the side panel (in addition to the map tool), and add a simple "turn to heading and roll out" without building a whole sequence.

## What landed

### WaypointEditor

- Renders in the selected aircraft's card under the Sequence section.
- Each row shows index, lat/lon in DD MM.MMM (click to edit inline), optional alt/spd override, up/down reorder, delete.
- "+ Add waypoint at current position" button as a quick add; the map waypoint tool (📍) still drops them by click.
- The currently-targeted waypoint glows green during playback.

### Rollout heading

- New `targetHeadingMagDeg: number | null` on `Aircraft`.
- New "Roll out at … °M" input on the aircraft card.
- Behavior in `advanceAircraft`:
  - If `targetHeadingMagDeg != null`, compute shortest heading-error to it.
  - Apply bank in the error's direction at the magnitude of the current bank (or 30° default if wings-level).
  - When error < 1°, bank → 0 and target is cleared.
- Sync mode broadcasts the rollout target the same way it does bank.

## Decisions

- Rollout is independent of the maneuver sequence; useful for ad-hoc one-off turns without programming.
- Inside the sequence, `turn-to` steps work the same way under the hood.
- Editing a waypoint's lat/lon accepts the flexible DD MM.MMM parser.

## Key files

- `src/components/Panel/WaypointEditor.tsx`
- `src/store/scenarioStore.ts` (`setTargetHeading`, advanceAircraft branch)
- `src/types.ts` (`targetHeadingMagDeg` field)
