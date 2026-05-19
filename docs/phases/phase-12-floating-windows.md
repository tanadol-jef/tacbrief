# Phase 12 - Floating windows

**Shipped:** v1.0.1

## Goal

Let map overlay panels move out of the way during brief construction while
keeping the v1.0 layout intact by default.

## What landed

- `MeasurementPanel`, `PolygonPanel`, `ReplayStatusPanel`, the settings
  popover, and the map status strip can be dragged by their title bars.
- The map status strip now owns the cursor coordinate, magnetic variation, and
  nautical scale readouts so they move together.
- Floating window positions persist in the existing `tacbrief.settings.v1`
  localStorage entry.
- Stored positions are clamped to the viewport and snap near screen edges so
  dropped panels remain visible and tidy.
- Buttons and form controls inside panel title areas do not start a drag.
- The settings popover includes a "Reset floating windows" action to restore
  all panels to their default anchored positions.
- The settings popover can save the current floating-window positions as the
  user's default layout. Reset restores that saved layout and un-minimizes
  hidden windows.
- Measurement, polygon, replay status, and map status windows can be hidden to
  a compact floating taskbar at the top-left, next to the map toolbar.
- The taskbar shows only hidden windows and restores each window in place.

## Key files

- `src/lib/useDraggablePanel.ts` - reusable drag, clamp, snap, and persistence
  hook.
- `src/store/settingsStore.ts` - persisted `panelPositions` state and reset
  actions.
- `src/components/MeasurementPanel.tsx`
- `src/components/PolygonPanel.tsx`
- `src/components/ReplayStatusPanel.tsx`
- `src/components/SettingsPanel.tsx`
- `src/components/Map/MapStatusPanel.tsx`
- `src/components/Map/FloatingTaskbar.tsx`

## Notes

- Settings popover positions are viewport based. Map overlay positions are map
  container based, so they stay correctly clamped when the sidebar is hidden or
  shown.
- Floating windows are a v1.0.1 point release. Type-specific aircraft icons
  remain a candidate for a later release.
