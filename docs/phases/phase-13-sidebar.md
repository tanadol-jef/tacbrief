# Phase 13 - Collapsible sidebar & map UI polish

**Shipped**

## Goal

Let the map use the full available width on demand while keeping the v1.0
sidebar layout unchanged when visible, and bring the remaining native map
controls into the TacBrief UI style.

## What landed

- Top-bar sidebar toggle using `PanelLeft` / `PanelLeftClose` icons.
- `Ctrl+B` / `Cmd+B` hotkey to show or hide the sidebar.
- Sidebar hidden state persists in `tacbrief.settings.v1` via
  `settingsStore.sidebarHidden`.
- When hidden, `SidePanel` is unmounted so the map expands to full width.
- Sidebar aircraft-list scrollbar is now compact and themed.
- Scrollbar styling is scoped to the aircraft list only, so it does not resize
  aircraft cards or status readouts elsewhere.
- Replaced the native MapLibre zoom/north widget with themed
  `MapNavControls`.
- Moved the layer switcher to the bottom-right so it does not collide with the
  zoom/north control.
- Removed the old place-aircraft toolbar mode. Aircraft are repositioned by
  dragging their map symbols directly.

## Key files

- `src/App.tsx`
- `src/components/TopBar.tsx`
- `src/lib/useHotkeys.ts`
- `src/store/settingsStore.ts`
- `src/components/Panel/SidePanel.tsx`
- `src/index.css`
- `src/components/Map/MapNavControls.tsx`
- `src/components/Map/LayerSwitcher.tsx`
- `src/components/Map/AircraftDragInteractions.tsx`
