# Phase 15 - Scenario programming workflow

**Shipped:** v1.0.3

## Goal

Replace the embedded per-aircraft sequence editor with a practical scenario
programming workflow that can coordinate multiple aircraft with starts, actions,
exits, route waypoints, and cross-aircraft event conditions.

## What landed

- Added a sidebar Program tab with Aircraft Program and Route subtabs.
- Moved waypoint authoring into Program -> Route; route waypoints are now source
  data that program actions can reference.
- Removed the old embedded maneuver and waypoint editors from aircraft cards.
- Added block-based programs with Start, Action, and Exit rows.
- Added actions for turn to heading, turn to waypoint, turn to another
  aircraft's heading at block start, set speed/altitude, and climb to altitude.
- Turn actions support G-primary and bank-angle control. Completed heading turns
  roll out at the commanded heading.
- Added start and exit conditions for immediate, after seconds, action complete,
  heading cross, block complete, waypoint captured, and vector pass.
- Waypoint capture is based on aircraft overflight and fires once per playback
  run.
- Added event logging for block start/completion, waiting conditions, fired
  conditions, and waypoint captures.
- Reset clears runtime program state, fired conditions, captured waypoints,
  trails, and event log while preserving the authored scenario.
- Added direct aircraft dragging on the map with cursor feedback.
- Added a floating aircraft parameters window with compact live heading, speed,
  altitude, bank, G, active block, and elapsed time.
- Preserved old saved scenarios by migrating legacy `steps` into program blocks
  on load.

## Key files

- `src/store/scenarioStore.ts` - program runtime, block execution, event
  detection, waypoint capture, migration, and reset behavior.
- `src/types.ts` - program block, action lane, condition, event, and runtime
  types.
- `src/components/Panel/ProgramPanel.tsx` - Program tab authoring UI.
- `src/components/Panel/SidePanel.tsx` - Aircraft / Program tab switcher.
- `src/components/AircraftStatusPanel.tsx` - compact live aircraft readout.
- `src/components/Map/AircraftDragInteractions.tsx` - map aircraft drag logic.
- `src/components/Map/MapView.tsx` - program route placement and floating panel
  mounts.

## Verification

```powershell
npm run build
```

Known non-blocking warning: Vite still reports the large bundle warning because
MapLibre/Turf/React are bundled into the main app chunk.
