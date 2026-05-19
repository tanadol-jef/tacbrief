import { create } from "zustand";
import type {
  AircraftId,
  Measurement,
  MeasurementAnchor,
  MeasurementType,
} from "../types";

export type ToolId =
  | "select"
  | "waypoint"
  | "ruler"
  | "protractor";

const MEAS_COLORS = ["#fbbf24", "#a78bfa", "#22d3ee", "#fb7185", "#4ade80"];
let counter = 0;

function newId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}-${counter}`;
}

function defaultName(type: MeasurementType, idx: number): string {
  return type === "ruler" ? `Ruler ${idx}` : `Angle ${idx}`;
}

type ToolState = {
  tool: ToolId;
  measurements: Measurement[];
  activeId: string | null;
  setTool: (tool: ToolId) => void;
  startMeasurement: (type: MeasurementType) => string;
  addPoint: (point: MeasurementAnchor) => void;
  finishActive: () => void;
  setActive: (id: string | null) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
};

export const useTool = create<ToolState>((set, get) => ({
  tool: "select",
  measurements: [],
  activeId: null,

  setTool: (tool) =>
    set((s) => {
      // Entering a measurement tool starts a new one immediately so the next
      // click adds to it.
      if (tool === "ruler" || tool === "protractor") {
        const idx =
          s.measurements.filter((m) => m.type === tool).length + 1;
        const id = newId();
        const m: Measurement = {
          id,
          type: tool,
          name: defaultName(tool, idx),
          color: MEAS_COLORS[s.measurements.length % MEAS_COLORS.length],
          points: [],
          closed: false,
        };
        return { tool, measurements: [...s.measurements, m], activeId: id };
      }
      // Leaving a measurement tool finalises the active one (if any).
      return {
        tool,
        measurements: s.measurements.map((m) =>
          m.id === s.activeId ? { ...m, closed: true } : m,
        ),
        activeId: null,
      };
    }),

  startMeasurement: (type) => {
    const s = get();
    const idx = s.measurements.filter((m) => m.type === type).length + 1;
    const id = newId();
    const m: Measurement = {
      id,
      type,
      name: defaultName(type, idx),
      color: MEAS_COLORS[s.measurements.length % MEAS_COLORS.length],
      points: [],
      closed: false,
    };
    set({
      measurements: [...s.measurements, m],
      activeId: id,
      tool: type,
    });
    return id;
  },

  addPoint: (point) =>
    set((s) => {
      if (!s.activeId) return s;
      return {
        measurements: s.measurements.map((m) => {
          if (m.id !== s.activeId) return m;
          // Protractor caps at 3 points (vertex in middle).
          const next = [...m.points, point];
          if (m.type === "protractor" && next.length > 3) {
            return { ...m, points: next.slice(-3) };
          }
          return { ...m, points: next };
        }),
      };
    }),

  finishActive: () =>
    set((s) => ({
      measurements: s.measurements.map((m) =>
        m.id === s.activeId ? { ...m, closed: true } : m,
      ),
      activeId: null,
      tool: "select",
    })),

  setActive: (id) => set({ activeId: id }),

  rename: (id, name) =>
    set((s) => ({
      measurements: s.measurements.map((m) =>
        m.id === id ? { ...m, name } : m,
      ),
    })),

  remove: (id) =>
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    })),

  clearAll: () => set({ measurements: [], activeId: null }),
}));

export function resolveAnchor(
  anchor: MeasurementAnchor,
  aircraftLookup: Map<AircraftId, { lat: number; lon: number }>,
  replayLookup?: Map<AircraftId, { lat: number; lon: number }>,
): { lat: number; lon: number } | null {
  if (anchor.kind === "fixed") return { lat: anchor.lat, lon: anchor.lon };
  if (anchor.kind === "aircraft") {
    const ac = aircraftLookup.get(anchor.aircraftId);
    return ac ? { lat: ac.lat, lon: ac.lon } : null;
  }
  // replay-aircraft
  const ac = replayLookup?.get(anchor.aircraftId);
  return ac ? { lat: ac.lat, lon: ac.lon } : null;
}
