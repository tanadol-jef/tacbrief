import { create } from "zustand";

const STORAGE_KEY = "tacbrief.settings.v1";

type Settings = {
  trailSeconds: number;
  trailSampleHz: number;
  snapPx: number;
  showTurnCirclesInTurn: boolean;
  panelPositions: Partial<Record<PanelKey, PanelPos>>;
  defaultPanelPositions: Partial<Record<PanelKey, PanelPos>>;
  minimizedPanels: Partial<Record<PanelKey, boolean>>;
  sidebarHidden: boolean;
};

export type PanelKey =
  | "aircraftStatus"
  | "measurement"
  | "polygon"
  | "replayStatus"
  | "settings"
  | "mapStatus";

export type PanelPos = { x: number; y: number };

type SettingsState = Settings & {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setPanelPos: (key: PanelKey, pos: PanelPos) => void;
  resetPanelPos: (key: PanelKey) => void;
  resetAllPanelPositions: () => void;
  saveCurrentPanelPositionsAsDefault: () => void;
  clearDefaultPanelPositions: () => void;
  setPanelMinimized: (key: PanelKey, minimized: boolean) => void;
  toggleSidebar: () => void;
};

const DEFAULTS: Settings = {
  trailSeconds: 10,
  trailSampleHz: 5,
  snapPx: 22,
  showTurnCirclesInTurn: false,
  panelPositions: {},
  defaultPanelPositions: {},
  minimizedPanels: {},
  sidebarHidden: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULTS,
      ...parsed,
      panelPositions: { ...(parsed.panelPositions ?? {}) },
      defaultPanelPositions: { ...(parsed.defaultPanelPositions ?? {}) },
      minimizedPanels: { ...(parsed.minimizedPanels ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

function persistable(s: Settings): Settings {
  return {
    trailSeconds: s.trailSeconds,
    trailSampleHz: s.trailSampleHz,
    snapPx: s.snapPx,
    showTurnCirclesInTurn: s.showTurnCirclesInTurn,
    panelPositions: s.panelPositions,
    defaultPanelPositions: s.defaultPanelPositions,
    minimizedPanels: s.minimizedPanels,
    sidebarHidden: s.sidebarHidden,
  };
}

function save(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable(s)));
  } catch {
    /* ignore */
  }
}

export const useSettings = create<SettingsState>((setStore) => ({
  ...load(),
  set: (key, value) =>
    setStore((s) => {
      const next = { ...s, [key]: value };
      save(next);
      return next;
    }),
  setPanelPos: (key, pos) =>
    setStore((s) => {
      const next = {
        ...s,
        panelPositions: { ...s.panelPositions, [key]: pos },
      };
      save(next);
      return next;
    }),
  resetPanelPos: (key) =>
    setStore((s) => {
      const defaultPos = s.defaultPanelPositions[key];
      const panelPositions = { ...s.panelPositions };
      if (defaultPos) panelPositions[key] = defaultPos;
      else delete panelPositions[key];
      const next = { ...s, panelPositions };
      save(next);
      return next;
    }),
  resetAllPanelPositions: () =>
    setStore((s) => {
      const next = {
        ...s,
        panelPositions: { ...s.defaultPanelPositions },
        minimizedPanels: {},
      };
      save(next);
      return next;
    }),
  saveCurrentPanelPositionsAsDefault: () =>
    setStore((s) => {
      const next = {
        ...s,
        defaultPanelPositions: { ...s.panelPositions },
      };
      save(next);
      return next;
    }),
  clearDefaultPanelPositions: () =>
    setStore((s) => {
      const next = { ...s, defaultPanelPositions: {} };
      save(next);
      return next;
    }),
  setPanelMinimized: (key, minimized) =>
    setStore((s) => {
      const minimizedPanels = { ...s.minimizedPanels };
      if (minimized) minimizedPanels[key] = true;
      else delete minimizedPanels[key];
      const next = { ...s, minimizedPanels };
      save(next);
      return next;
    }),
  toggleSidebar: () =>
    setStore((s) => {
      const next = { ...s, sidebarHidden: !s.sidebarHidden };
      save(next);
      return next;
    }),
}));
