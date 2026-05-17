import { create } from "zustand";

const STORAGE_KEY = "tacbrief.settings.v1";

type Settings = {
  trailSeconds: number;
  trailSampleHz: number;
  snapPx: number;
  showTurnCirclesInTurn: boolean;
};

type SettingsState = Settings & {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

const DEFAULTS: Settings = {
  trailSeconds: 10,
  trailSampleHz: 5,
  snapPx: 22,
  showTurnCirclesInTurn: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function save(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const useSettings = create<SettingsState>((setStore) => ({
  ...load(),
  set: (key, value) =>
    setStore((s) => {
      const next = { ...s, [key]: value };
      save({
        trailSeconds: next.trailSeconds,
        trailSampleHz: next.trailSampleHz,
        snapPx: next.snapPx,
        showTurnCirclesInTurn: next.showTurnCirclesInTurn,
      });
      return next;
    }),
}));
