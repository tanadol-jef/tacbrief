# Phase 10 — Record & Replay

**Shipped:** 2026-05-18

## Goal

Record a flown scenario and replay it later with a scrubber, ghost aircraft, and snap-able anchors.

## What landed

### Recording

- `recordingStore` with `recording`, `samples`, `imported`, `replayMode`, `replayPlaying`, `replayTime`.
- Record button (red ●) in the top bar. While playing+recording, each tick appends a sample at the configured trail sample rate.
- Each sample stores per-aircraft `{id, callsign, color, lat, lon, altFt, speedKt, headingMagDeg, bankDeg}`.
- Save recording → `tacbrief-recording-<ts>.json`. Load recording → imports as a separate "imported" track without touching the live scenario.

### Replay

- Imported track is rendered as a dashed colored polyline per aircraft (full historical path).
- **Replay mode** toggle (Film icon). In replay mode:
  - Dedicated **▶ / ⏸ Play/Pause** for the replay clock.
  - **⟲** rewinds replay to t=0.
  - Scrubber slider drives `replayTime`; ghost aircraft snap to the interpolated frame instantly.
- `ReplayLayer` draws ghost aircraft at interpolated positions (same SVG icon, slightly translucent, `·R` suffix on labels).
- `ReplayStatusPanel` (bottom-left of map) shows live params for each ghost aircraft: speed kt, alt ft, heading °M, bank °, G.

### Measurement integration

- New anchor kind: `{kind: "replay-aircraft", aircraftId}`. Rulers/protractors can snap to ghosts and stay attached as the replay scrubs.
- Anchor badge in the measurement panel uses `RN` for replay vs `✈N` for live.

## Decisions

- Replay has its own play state to keep sim and replay clocks independent — you can run live sim and watch a replay simultaneously.
- Interpolation uses linear position + correct angle-wrap for headings and longitudes.
- Replay never overwrites live aircraft state.

## Key files

- `src/store/recordingStore.ts`
- `src/components/RecordingControls.tsx`
- `src/components/Map/RecordingLayer.tsx`, `ReplayLayer.tsx`
- `src/components/ReplayStatusPanel.tsx`
- `src/lib/useSimulation.ts` (dispatches replay vs sim tick)
