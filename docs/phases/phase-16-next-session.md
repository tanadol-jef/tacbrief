# Phase 16 - Next session

**Planned**, not started.

## Current handoff state

The working tree now represents TacBrief v1.0.3. Before starting a new feature,
verify the app with:

```powershell
npm run build
```

Known non-blocking warning: Vite still reports the large bundle warning because
MapLibre/Turf/React are bundled into the main app chunk.

## Good next candidates

### Remove formation link controls

Provision for simplifying the aircraft cards and formation workflow.

- Remove or redesign the per-aircraft formation link/break-link control.
- Keep a clear way to switch between independent aircraft and linked formation
  behavior.
- Verify existing saved scenarios still load when aircraft have old `locked`
  values.

### Per-aircraft-type top-view icons

Postponed from the earlier phase list.

- Add distinct map silhouettes for F-16, Gripen, T-50, F-5, and L-39 presets.
- Keep the existing generic icon as the fallback for custom aircraft and old
  recordings.
- Save aircraft preset data into recording samples so replay ghosts can use
  the same icon expression.

### Real squadron performance numbers

Postponed from the earlier phase list.

- Replace placeholder Vne / corner / cruise values in `AIRCRAFT_PRESETS` if
  real RTAF data is supplied.
- Otherwise mark the UI values clearly as approximate so they are not briefed
  as authoritative.

### Time-of-day / sun-angle visualization

- Add a sun puck on the map driven by date and UTC offset.
- Optional: shade an "out of sun" cone behind aircraft.

### Multi-aircraft route paste / mirror

- Build a route on aircraft 1.
- Mirror or offset it to lay down a coordinated flight plan for the formation.

### Briefing PDF export

- Render the current map view, aircraft state, and measurement readouts to a
  single-page briefing handout.

## Recent shipped context

- Scenario programs now use Start, Action, and Exit blocks.
- Route waypoints are authored separately and referenced from program actions.
- Start and exit conditions can wait on heading cross, block complete, waypoint
  capture, and vector pass events.
- Aircraft movement is direct drag-and-drop on the aircraft symbol.
- Floating aircraft parameters show live state, active block, and elapsed time.
- Floating map windows are draggable, minimizable to a top-left taskbar, and can
  save the current layout as the reset default.
