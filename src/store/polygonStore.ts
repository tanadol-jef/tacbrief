import { create } from "zustand";
import type { KmlPolygon, PolygonRing } from "../lib/kmz";

const STORAGE_KEY = "tacbrief.polygons.v1";

type PolygonState = {
  polygons: KmlPolygon[];
  draftPoints: PolygonRing;
  drawing: boolean;
  startDrawing: () => void;
  addDraftPoint: (p: { lat: number; lon: number }) => void;
  finishDraft: () => void;
  cancelDraft: () => void;
  addPolygons: (polys: KmlPolygon[]) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
};

function load(): KmlPolygon[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as KmlPolygon[];
  } catch {
    return [];
  }
}

function save(polys: KmlPolygon[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(polys));
  } catch {
    /* ignore */
  }
}

const DRAW_COLORS = ["#fbbf24", "#a78bfa", "#22d3ee", "#34d399", "#fb7185"];

export const usePolygons = create<PolygonState>((set, get) => ({
  polygons: load(),
  draftPoints: [],
  drawing: false,

  startDrawing: () => set({ drawing: true, draftPoints: [] }),

  addDraftPoint: (p) =>
    set((s) => ({ draftPoints: [...s.draftPoints, p] })),

  finishDraft: () => {
    const s = get();
    if (s.draftPoints.length >= 3) {
      const id = `p-${Date.now().toString(36)}-${s.polygons.length}`;
      const poly: KmlPolygon = {
        id,
        name: `Polygon ${s.polygons.length + 1}`,
        color: DRAW_COLORS[s.polygons.length % DRAW_COLORS.length],
        outer: s.draftPoints,
        holes: [],
      };
      const polygons = [...s.polygons, poly];
      save(polygons);
      set({ polygons, drawing: false, draftPoints: [] });
    } else {
      set({ drawing: false, draftPoints: [] });
    }
  },

  cancelDraft: () => set({ drawing: false, draftPoints: [] }),

  addPolygons: (polys) =>
    set((s) => {
      const polygons = [...s.polygons, ...polys];
      save(polygons);
      return { polygons };
    }),

  rename: (id, name) =>
    set((s) => {
      const polygons = s.polygons.map((p) =>
        p.id === id ? { ...p, name } : p,
      );
      save(polygons);
      return { polygons };
    }),

  remove: (id) =>
    set((s) => {
      const polygons = s.polygons.filter((p) => p.id !== id);
      save(polygons);
      return { polygons };
    }),

  clearAll: () => {
    save([]);
    set({ polygons: [], draftPoints: [], drawing: false });
  },
}));
