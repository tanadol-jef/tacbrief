import { create } from "zustand";
import type { Aircraft, AircraftId } from "../types";

const FILE_VERSION = 1;

export type RecordingSample = {
  t: number;
  ac: {
    id: AircraftId;
    callsign: string;
    color: string;
    lat: number;
    lon: number;
    altFt: number;
    speedKt: number;
    headingMagDeg: number;
    bankDeg: number;
  }[];
};

export type RecordingFile = {
  version: number;
  savedAt: string;
  name: string;
  durationSec: number;
  samples: RecordingSample[];
};

type RecordingState = {
  recording: boolean;
  samples: RecordingSample[];
  recordingName: string;
  lastSampleT: number;
  imported: RecordingFile | null;

  /** Replay-mode UI state. Driven by its own play state, not the sim's. */
  replayMode: boolean;
  replayPlaying: boolean;
  replayTime: number; // seconds from start of recording

  startRecording: (name?: string) => void;
  stopRecording: () => void;
  clearRecording: () => void;
  appendSample: (s: RecordingSample, sampleHz: number) => void;
  exportFile: () => void;
  importFromFile: (file: File) => Promise<boolean>;
  clearImported: () => void;

  setReplayMode: (on: boolean) => void;
  playReplay: () => void;
  pauseReplay: () => void;
  toggleReplay: () => void;
  seekReplay: (t: number) => void;
  advanceReplay: (dt: number) => void;
};

export function replayBounds(file: RecordingFile | null): {
  t0: number;
  t1: number;
  duration: number;
} {
  if (!file || file.samples.length === 0)
    return { t0: 0, t1: 0, duration: 0 };
  const t0 = file.samples[0].t;
  const t1 = file.samples[file.samples.length - 1].t;
  return { t0, t1, duration: t1 - t0 };
}

/** Interpolated snapshot at absolute replayTime (seconds from sample[0].t). */
export function frameAt(
  file: RecordingFile,
  replayTime: number,
): Map<number, RecordingSample["ac"][number]> {
  const map = new Map<number, RecordingSample["ac"][number]>();
  if (file.samples.length === 0) return map;
  const { t0 } = replayBounds(file);
  const target = t0 + replayTime;
  // Binary search for the sample at or just before target.
  const samples = file.samples;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid].t <= target) lo = mid;
    else hi = mid - 1;
  }
  const a = samples[lo];
  const b = samples[Math.min(samples.length - 1, lo + 1)];
  const span = Math.max(1e-6, b.t - a.t);
  const u = Math.min(1, Math.max(0, (target - a.t) / span));
  const byB = new Map(b.ac.map((x) => [x.id, x] as const));
  for (const ac of a.ac) {
    const bb = byB.get(ac.id);
    if (!bb) {
      map.set(ac.id, ac);
      continue;
    }
    map.set(ac.id, {
      id: ac.id,
      callsign: ac.callsign,
      color: ac.color,
      lat: lerp(ac.lat, bb.lat, u),
      lon: lerpLon(ac.lon, bb.lon, u),
      altFt: lerp(ac.altFt, bb.altFt, u),
      speedKt: lerp(ac.speedKt, bb.speedKt, u),
      headingMagDeg: lerpAngle(ac.headingMagDeg, bb.headingMagDeg, u),
      bankDeg: lerp(ac.bankDeg, bb.bankDeg, u),
    });
  }
  return map;
}

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}
function lerpLon(a: number, b: number, u: number) {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  else if (diff < -180) diff += 360;
  let r = a + diff * u;
  if (r > 180) r -= 360;
  else if (r < -180) r += 360;
  return r;
}
function lerpAngle(a: number, b: number, u: number) {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  let r = a + diff * u;
  while (r >= 360) r -= 360;
  while (r < 0) r += 360;
  return r;
}

export const useRecording = create<RecordingState>((set, get) => ({
  recording: false,
  samples: [],
  recordingName: "",
  lastSampleT: -Infinity,
  imported: null,
  replayMode: false,
  replayPlaying: false,
  replayTime: 0,

  startRecording: (name) =>
    set({
      recording: true,
      samples: [],
      lastSampleT: -Infinity,
      recordingName: name ?? `Recording ${new Date().toISOString().slice(0, 16)}`,
    }),

  stopRecording: () => set({ recording: false }),

  clearRecording: () =>
    set({ samples: [], recording: false, lastSampleT: -Infinity }),

  appendSample: (s, sampleHz) =>
    set((state) => {
      const interval = 1 / Math.max(1, sampleHz);
      if (s.t - state.lastSampleT < interval) return state;
      return { samples: [...state.samples, s], lastSampleT: s.t };
    }),

  exportFile: () => {
    const s = get();
    const payload: RecordingFile = {
      version: FILE_VERSION,
      savedAt: new Date().toISOString(),
      name: s.recordingName || "Recording",
      durationSec: s.samples.length
        ? s.samples[s.samples.length - 1].t - s.samples[0].t
        : 0,
      samples: s.samples,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 16);
    a.href = url;
    a.download = `tacbrief-recording-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  importFromFile: async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as RecordingFile;
      if (parsed.version !== FILE_VERSION) return false;
      if (!Array.isArray(parsed.samples)) return false;
      set({ imported: parsed });
      return true;
    } catch {
      return false;
    }
  },

  clearImported: () =>
    set({
      imported: null,
      replayMode: false,
      replayPlaying: false,
      replayTime: 0,
    }),

  setReplayMode: (on) =>
    set((s) => {
      if (on && !s.imported) return s;
      return {
        replayMode: on,
        replayPlaying: false,
        replayTime: on ? 0 : s.replayTime,
      };
    }),

  playReplay: () =>
    set((s) => {
      if (!s.imported || !s.replayMode) return s;
      const { duration } = replayBounds(s.imported);
      // If at the end, rewind to start on play.
      return {
        replayPlaying: true,
        replayTime: s.replayTime >= duration ? 0 : s.replayTime,
      };
    }),

  pauseReplay: () => set({ replayPlaying: false }),

  toggleReplay: () =>
    set((s) => {
      if (!s.imported || !s.replayMode) return s;
      const { duration } = replayBounds(s.imported);
      if (s.replayPlaying) return { replayPlaying: false };
      return {
        replayPlaying: true,
        replayTime: s.replayTime >= duration ? 0 : s.replayTime,
      };
    }),

  seekReplay: (t) =>
    set((s) => {
      const { duration } = replayBounds(s.imported);
      return { replayTime: Math.max(0, Math.min(duration, t)) };
    }),

  advanceReplay: (dt) =>
    set((s) => {
      const { duration } = replayBounds(s.imported);
      const next = s.replayTime + dt;
      if (next >= duration) {
        return { replayTime: duration, replayPlaying: false };
      }
      return { replayTime: next };
    }),
}));

// Helper used by the simulation tick to snapshot live aircraft state.
export function snapshotAircraft(simT: number, aircraft: Aircraft[]): RecordingSample {
  return {
    t: simT,
    ac: aircraft.map((a) => ({
      id: a.id,
      callsign: a.callsign,
      color: a.color,
      lat: a.position.lat,
      lon: a.position.lon,
      altFt: a.altitudeFt,
      speedKt: a.speedKt,
      headingMagDeg: a.headingMagDeg,
      bankDeg: a.bankDeg,
    })),
  };
}
