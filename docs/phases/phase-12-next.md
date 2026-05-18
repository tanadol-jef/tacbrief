# Phase 12 — Next: Layout flexibility & type-specific aircraft icons

**Planned**, not started.

## Goals

1. **Collapsible / hideable sidebar** so the map can use full window width when needed.
2. **Movable floating panels** — drag the measurement panel, polygon panel, settings popover, recording controls, replay status panel around the screen.
3. **Per-aircraft-type top-view icons** — each preset (F-16, Gripen, T-50, F-5, L-39) gets its own silhouette rather than the single generic aircraft SVG used today.

## Detailed scope

### Sidebar hide/show

- Toggle button in top bar (icon: panel-left or chevron-left).
- When hidden, the side panel slides out; the map area expands to full width.
- Optional `Ctrl + B` hotkey to toggle.
- Hidden state persists in `settingsStore`.
- Consider a thin "peek" handle that stays visible to indicate the sidebar can be reopened.

### Movable floating panels

Candidates that need to move:

- `MeasurementPanel`
- `PolygonPanel`
- `ReplayStatusPanel`
- `SettingsPanel` popover

Approach options:

- **A. Simple drag handle** — each panel gets a title bar; mousedown on it begins a drag, releases on mouseup. Position stored in component-level state, persisted per panel in `settingsStore`.
- **B. Use a lightweight lib** — e.g. `react-rnd` or `re-resizable`. ~10 KB added; gives resize + drag for free.
- **C. Tabbed dock** — collect all panels into a single tabbed sidebar on the right. Simpler than draggable, but loses the "at-a-glance" multi-panel view.

Likely pick **A** for v1 (no new dep, full control). Promote to B if resizing becomes a need.

Position persistence schema:
```ts
panelPositions: {
  measurement: { x: number, y: number },
  polygon: { x: number, y: number },
  replayStatus: { x: number, y: number },
}
```

Snap-to-edge behaviour: if dropped within ~12 px of an edge, snap so it docks neatly.

### Per-type aircraft icons

Today: a single generic top-down aircraft SVG colored via SDF `icon-color`.

Plan:

- Add 5 SVGs in `src/assets/aircraft/` (or inline strings): `f16.svg`, `gripen.svg`, `t50.svg`, `f5.svg`, `l39.svg`.
- Each SDF, sized 64×64, normalized so the nose points up.
- Image id per preset: `tac-f16`, `tac-gripen`, etc.
- `AircraftLayer` registers each image on first add.
- Symbol layer's `icon-image` becomes a `["match", ["get", "preset"], "F-16A", "tac-f16", ...]` expression.
- `ReplayLayer` reads the saved preset from the recording sample (we already store `callsign` and `color` per sample — add `preset` to the snapshot so replays show the right silhouette).
- "Custom" preset falls back to the generic icon.

Reference shapes (rough idea):

- F-16: delta-ish wing, single vertical, blended chines.
- Gripen: double-delta canard, single vertical.
- T-50: small swept wing, twin tail-feel (single vertical actually, but slimmer).
- F-5: short straight-tapered wings, twin engines visible, single vertical.
- L-39: straight wing with tip tanks, T-tail look from top.

Doesn't need to be photorealistic — silhouettes ~16 px on screen need to be distinguishable at a glance.

## Possible follow-ons (not in this phase)

- Replace placeholder aircraft performance numbers with real squadron data (or mark them clearly as "approximate" in the UI).
- Polygon vertex editing.
- Time-of-day / sun-angle visualization for briefings.
- Animated wingtip vortex trails for high-G turns (cosmetic).
- Multi-user collaborative briefings.
