# Phase 5 — Formations

**Shipped:** 2026-05-17

## Goal

Two formation modes: Independent (free flying), and Linked (lead drives the formation, wingmen follow geometrically).

## What landed

- `formations.ts` library with slot offsets for: Line Abreast, Trail, Wedge / Vic, Echelon L/R, Finger Four, Box.
- `FormationControls` panel at the bottom of the sidebar:
  - Mode toggle (Independent / Linked)
  - Preset dropdown
  - Spacing (ft) and Stagger (ft)
  - "Re-sync wingmen" button
- Wingmen positions are recomputed each tick when Linked. Lead is always aircraft id 1.
- Lock icon per wingman card to break the link individually while staying in Linked mode (the locked aircraft becomes free).

## Decisions

- Spacing scales side-to-side offsets in slot coords; stagger scales fore-aft.
- All formation math is in true bearings internally; magnetic conversion happens at the UI level only.
- Wingmen inherit lead's altitude and speed unless locked.

## Key files

- `src/lib/formations.ts`
- `src/store/scenarioStore.ts` (`applyFormation`, `setFormation*`)
- `src/components/Panel/FormationControls.tsx`
