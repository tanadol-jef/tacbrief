import { create } from "zustand";
import type {
  Aircraft,
  AircraftId,
  BankOrG,
  FormationMode,
  ManeuverStep,
  PresetId,
  Waypoint,
} from "../types";
import {
  slotsFor,
  type FormationPreset,
} from "../lib/formations";
import { FT_TO_NM } from "../lib/units";
import {
  loadLocal,
  saveLocal,
  type Scenario,
} from "../lib/persistence";
import { useSettings } from "./settingsStore";
import { snapshotAircraft, useRecording } from "./recordingStore";
import { AIRCRAFT_COLORS, AIRCRAFT_PRESETS } from "../presets/aircraft";
import {
  bankFromLoadFactor,
  loadFactorFromBank,
  turnRateDegPerSec,
} from "../lib/flightMath";
import { iasToTas } from "../lib/atmosphere";
import { magToTrue, trueToMag } from "../lib/magnetic";
import * as turf from "@turf/turf";
import { wrap360 } from "../lib/units";

const VTBU = { lat: 15.2774, lon: 100.2956 }; // Takhli RTAFB

function makeAircraft(id: AircraftId, presetId: PresetId): Aircraft {
  const preset = AIRCRAFT_PRESETS[presetId];
  return {
    id,
    callsign: `TAC${id}`,
    preset: presetId,
    color: AIRCRAFT_COLORS[id - 1],
    visible: true,
    locked: false,
    position: { ...VTBU },
    altitudeFt: preset.cruiseAltFt,
    speedKt: preset.cruiseKt,
    headingMagDeg: 90,
    bankDeg: 0,
    loadFactorG: 1,
    activeControl: "bank",
    turn: "straight",
    route: [],
    routeIndex: 0,
    trail: [],
    steps: [],
    stepIndex: 0,
    targetHeadingMagDeg: null,
  };
}

// Trail config is sourced from the settings store at tick time.

type ScenarioState = {
  aircraft: Aircraft[];
  selectedId: AircraftId;
  playing: boolean;
  simTime: number;
  initialAircraft: Aircraft[] | null;
  formationMode: FormationMode;
  formationPreset: FormationPreset;
  formationSpacingFt: number;
  formationStaggerFt: number;
  syncEdits: boolean;
  setSyncEdits: (on: boolean) => void;
  play: () => void;
  pause: () => void;
  resetSim: () => void;
  tick: (dtSeconds: number) => void;
  addAircraft: () => void;
  removeAircraft: (id: AircraftId) => void;
  select: (id: AircraftId) => void;
  update: (id: AircraftId, patch: Partial<Aircraft>) => void;
  setBank: (id: AircraftId, bankDeg: number) => void;
  setLoadFactor: (id: AircraftId, g: number) => void;
  setTargetHeading: (id: AircraftId, headingMagDeg: number | null) => void;
  setActiveControl: (id: AircraftId, control: BankOrG) => void;
  setPreset: (id: AircraftId, preset: PresetId) => void;
  setPosition: (id: AircraftId, lat: number, lon: number) => void;
  addWaypoint: (id: AircraftId, wp: Waypoint) => void;
  removeWaypoint: (id: AircraftId, index: number) => void;
  clearRoute: (id: AircraftId) => void;
  addStep: (id: AircraftId, step: ManeuverStep) => void;
  updateStep: (id: AircraftId, index: number, step: ManeuverStep) => void;
  removeStep: (id: AircraftId, index: number) => void;
  moveStep: (id: AircraftId, index: number, dir: -1 | 1) => void;
  clearSteps: (id: AircraftId) => void;
  setFormationMode: (mode: FormationMode) => void;
  setFormationPreset: (preset: FormationPreset) => void;
  setFormationSpacingFt: (ft: number) => void;
  setFormationStaggerFt: (ft: number) => void;
  toggleLock: (id: AircraftId) => void;
  syncFormation: () => void;
  loadScenario: (s: Scenario) => void;
};

const CAPTURE_NM = 0.3;
const DEFAULT_TURN_BANK_DEG = 30;
const HEADING_CAPTURE_DEG = 1.0;
const DEFAULT_CLIMB_FPM = 2000;
const SPEED_RAMP_KTPS = 8; // kt per second when set-speed step runs

function headingError(currentTrue: number, desiredTrue: number) {
  let err = desiredTrue - currentTrue;
  while (err > 180) err -= 360;
  while (err < -180) err += 360;
  return err;
}

function advanceAircraft(a: Aircraft, dt: number): Aircraft {
  let bankDeg = a.bankDeg;
  let speedKt = a.speedKt;
  let altitudeFt = a.altitudeFt;
  let stepIndex = a.stepIndex;
  let steps = a.steps;
  let targetHeadingMagDeg = a.targetHeadingMagDeg;

  const currentTrue = magToTrue(a.headingMagDeg, a.position.lat, a.position.lon);

  if (steps.length > 0 && stepIndex < steps.length) {
    const step = steps[stepIndex];
    let advance = false;
    if (step.kind === "waypoint") {
      const from: [number, number] = [a.position.lon, a.position.lat];
      const to: [number, number] = [step.lon, step.lat];
      const distNm = turf.distance(from, to, { units: "nauticalmiles" });
      if (distNm < CAPTURE_NM) {
        advance = true;
      } else {
        const desiredTrueBrg = (turf.bearing(from, to) + 360) % 360;
        const err = headingError(currentTrue, desiredTrueBrg);
        const cmdMag = Math.max(Math.abs(a.bankDeg), DEFAULT_TURN_BANK_DEG);
        bankDeg = Math.abs(err) < HEADING_CAPTURE_DEG ? 0 : Math.sign(err) * cmdMag;
      }
    } else if (step.kind === "turn-to") {
      const desiredTrue = magToTrue(step.headingMagDeg, a.position.lat, a.position.lon);
      const err = headingError(currentTrue, desiredTrue);
      if (Math.abs(err) < HEADING_CAPTURE_DEG) {
        bankDeg = 0;
        advance = true;
      } else {
        const cmdMag = step.bankDeg ?? Math.max(Math.abs(a.bankDeg), DEFAULT_TURN_BANK_DEG);
        bankDeg = Math.sign(err) * cmdMag;
      }
    } else if (step.kind === "set-speed") {
      const diff = step.speedKt - speedKt;
      const maxStep = SPEED_RAMP_KTPS * dt;
      if (Math.abs(diff) <= maxStep) {
        speedKt = step.speedKt;
        advance = true;
      } else {
        speedKt += Math.sign(diff) * maxStep;
      }
    } else if (step.kind === "set-altitude") {
      const rateFpm = step.climbRateFpm ?? DEFAULT_CLIMB_FPM;
      const maxStep = (rateFpm / 60) * dt;
      const diff = step.altFt - altitudeFt;
      if (Math.abs(diff) <= maxStep) {
        altitudeFt = step.altFt;
        advance = true;
      } else {
        altitudeFt += Math.sign(diff) * maxStep;
      }
    } else if (step.kind === "hold") {
      const remaining = (step.remaining ?? step.seconds) - dt;
      if (remaining <= 0) {
        advance = true;
        // reset countdown for re-runs
        steps = steps.map((sx, i) =>
          i === stepIndex && sx.kind === "hold"
            ? { ...sx, remaining: undefined }
            : sx,
        );
      } else {
        steps = steps.map((sx, i) =>
          i === stepIndex && sx.kind === "hold"
            ? { ...sx, remaining }
            : sx,
        );
      }
    }
    if (advance) stepIndex += 1;
  } else if (targetHeadingMagDeg != null) {
    // Ad-hoc rollout target. Turn toward target at the user's commanded bank
    // (or 30° if wings level), and roll out + clear target on capture.
    const desiredTrue = magToTrue(
      targetHeadingMagDeg,
      a.position.lat,
      a.position.lon,
    );
    const err = headingError(currentTrue, desiredTrue);
    if (Math.abs(err) < HEADING_CAPTURE_DEG) {
      bankDeg = 0;
      targetHeadingMagDeg = null;
    } else {
      const cmdMag = Math.max(Math.abs(a.bankDeg), DEFAULT_TURN_BANK_DEG);
      bankDeg = Math.sign(err) * cmdMag;
    }
  } else if (a.route.length > 0 && a.routeIndex < a.route.length) {
    // Back-compat: aircraft with classic waypoint route and no steps.
    const wp = a.route[a.routeIndex];
    const from: [number, number] = [a.position.lon, a.position.lat];
    const to: [number, number] = [wp.lon, wp.lat];
    const distNm = turf.distance(from, to, { units: "nauticalmiles" });
    if (distNm < CAPTURE_NM) {
      return { ...a, routeIndex: a.routeIndex + 1 };
    }
    const desiredTrueBrg = (turf.bearing(from, to) + 360) % 360;
    const err = headingError(currentTrue, desiredTrueBrg);
    const cmdMag = Math.max(Math.abs(a.bankDeg), DEFAULT_TURN_BANK_DEG);
    bankDeg = Math.abs(err) < HEADING_CAPTURE_DEG ? 0 : Math.sign(err) * cmdMag;
  }

  let omegaDeg = 0;
  if (Math.abs(bankDeg) > 0.5) {
    const tasForTurn = iasToTas(speedKt, altitudeFt);
    omegaDeg = turnRateDegPerSec(tasForTurn, bankDeg) * Math.sign(bankDeg);
  }
  const newTrueHeading = wrap360(currentTrue + omegaDeg * dt);

  const tas = iasToTas(speedKt, altitudeFt);
  const distNm = (tas * dt) / 3600;
  const dest = turf.destination(
    [a.position.lon, a.position.lat],
    distNm,
    newTrueHeading,
    { units: "nauticalmiles" },
  );
  const newLon = dest.geometry.coordinates[0];
  const newLat = dest.geometry.coordinates[1];

  return {
    ...a,
    position: { lat: newLat, lon: newLon },
    headingMagDeg: trueToMag(newTrueHeading, newLat, newLon),
    bankDeg,
    loadFactorG: loadFactorFromBank(bankDeg),
    speedKt,
    altitudeFt,
    steps,
    stepIndex,
    targetHeadingMagDeg,
    turn:
      bankDeg > 0.5 ? "right" : bankDeg < -0.5 ? "left" : "straight",
  };
}

function deepClone(aircraft: Aircraft[]): Aircraft[] {
  return aircraft.map((a) => ({
    ...a,
    position: { ...a.position },
    route: a.route.map((w) => ({ ...w })),
  }));
}

/**
 * Place wingmen relative to the lead (aircraft[0] in sort order, or whichever
 * has id=1 if present). Wingmen with `locked: true` keep their current state.
 */
function applyFormation(
  aircraft: Aircraft[],
  preset: FormationPreset,
  spacingFt: number,
  staggerFt: number,
): Aircraft[] {
  if (aircraft.length < 2) return aircraft;
  const sorted = [...aircraft].sort((a, b) => a.id - b.id);
  const lead = sorted[0];
  const slots = slotsFor(preset);
  const spacingNm = spacingFt * FT_TO_NM;
  const staggerNm = staggerFt * FT_TO_NM;
  const leadTrue = magToTrue(
    lead.headingMagDeg,
    lead.position.lat,
    lead.position.lon,
  );

  const updated = new Map<number, Aircraft>();
  updated.set(lead.id, lead);

  for (let i = 1; i < sorted.length; i++) {
    const wing = sorted[i];
    if (wing.locked) {
      updated.set(wing.id, wing);
      continue;
    }
    const slot = slots[i - 1];
    if (!slot) {
      updated.set(wing.id, wing);
      continue;
    }
    // Convert (x right, y forward) to (distance, bearing-from-lead).
    const dx = slot.x * spacingNm;
    const dy = slot.y * staggerNm;
    const dist = Math.hypot(dx, dy);
    const relBrg = Math.atan2(dx, dy) * (180 / Math.PI); // 0=forward, +90=right
    const trueBrg = wrap360(leadTrue + relBrg);
    const dest =
      dist === 0
        ? { geometry: { coordinates: [lead.position.lon, lead.position.lat] } }
        : turf.destination(
            [lead.position.lon, lead.position.lat],
            dist,
            trueBrg,
            { units: "nauticalmiles" },
          );
    const newLon = dest.geometry.coordinates[0];
    const newLat = dest.geometry.coordinates[1];
    updated.set(wing.id, {
      ...wing,
      position: { lat: newLat, lon: newLon },
      headingMagDeg: trueToMag(leadTrue, newLat, newLon),
      altitudeFt: lead.altitudeFt + (slot.altOffsetFt ?? 0),
      speedKt: lead.speedKt,
    });
  }
  // Return in original order.
  return aircraft.map((a) => updated.get(a.id) ?? a);
}

function maybeApplyFormation(s: ScenarioState, aircraft: Aircraft[]): Aircraft[] {
  if (s.formationMode !== "linked") return aircraft;
  return applyFormation(
    aircraft,
    s.formationPreset,
    s.formationSpacingFt,
    s.formationStaggerFt,
  );
}

export const useScenario = create<ScenarioState>((set) => ({
  aircraft: [makeAircraft(1, "F-16A")],
  selectedId: 1,
  playing: false,
  simTime: 0,
  initialAircraft: null,
  formationMode: "independent",
  formationPreset: "finger-four",
  formationSpacingFt: 1500,
  formationStaggerFt: 500,
  syncEdits: false,

  setSyncEdits: (on) => set({ syncEdits: on }),

  play: () =>
    set((s) =>
      s.playing
        ? s
        : {
            playing: true,
            initialAircraft: s.initialAircraft ?? deepClone(s.aircraft),
          },
    ),

  pause: () => set({ playing: false }),

  resetSim: () =>
    set((s) => ({
      playing: false,
      simTime: 0,
      aircraft: (s.initialAircraft
        ? deepClone(s.initialAircraft)
        : s.aircraft
      ).map((a) => ({
        ...a,
        routeIndex: 0,
        stepIndex: 0,
        steps: a.steps.map((sx) =>
          sx.kind === "hold" ? { ...sx, remaining: undefined } : sx,
        ),
        trail: [] as Aircraft["trail"],
      })),
      initialAircraft: null,
    })),

  tick: (dt) =>
    set((s) => {
      const { trailSeconds, trailSampleHz } = useSettings.getState();
      const nextSimTime = s.simTime + dt;
      const stepped = s.aircraft.map((a) => advanceAircraft(a, dt));
      const next = maybeApplyFormation(s, stepped).map((a) => {
        const prev = a.trail ?? [];
        const last = prev[prev.length - 1];
        const interval = 1 / Math.max(1, trailSampleHz);
        const shouldSample = !last || nextSimTime - last.t >= interval;
        const pruned = prev.filter((p) => nextSimTime - p.t <= trailSeconds);
        const trail = shouldSample
          ? [
              ...pruned,
              { lat: a.position.lat, lon: a.position.lon, t: nextSimTime },
            ]
          : pruned;
        return { ...a, trail };
      });

      const rec = useRecording.getState();
      if (rec.recording) {
        rec.appendSample(snapshotAircraft(nextSimTime, next), trailSampleHz);
      }

      return { simTime: nextSimTime, aircraft: next };
    }),

  addAircraft: () =>
    set((s) => {
      if (s.aircraft.length >= 4) return s;
      const usedIds = new Set(s.aircraft.map((a) => a.id));
      const nextId = ([1, 2, 3, 4] as AircraftId[]).find(
        (n) => !usedIds.has(n),
      )!;
      const presetOrder: PresetId[] = ["F-16A", "Gripen-C", "T-50TH", "F-5E"];
      return {
        aircraft: [
          ...s.aircraft,
          makeAircraft(nextId, presetOrder[nextId - 1]),
        ],
        selectedId: nextId,
      };
    }),

  removeAircraft: (id) =>
    set((s) => {
      const filtered = s.aircraft.filter((a) => a.id !== id);
      const selectedId = filtered[0]?.id ?? s.selectedId;
      return { aircraft: filtered, selectedId };
    }),

  select: (id) => set({ selectedId: id }),

  update: (id, patch) =>
    set((s) => {
      // Position / heading-derived state never broadcasts — they're per-aircraft.
      const broadcastSafe = { ...patch } as Partial<Aircraft>;
      delete broadcastSafe.position;
      delete broadcastSafe.callsign;
      delete broadcastSafe.color;
      delete broadcastSafe.id;
      delete broadcastSafe.route;
      delete broadcastSafe.routeIndex;
      delete broadcastSafe.trail;
      return {
        aircraft: s.aircraft.map((a) =>
          a.id === id
            ? { ...a, ...patch }
            : s.syncEdits
              ? { ...a, ...broadcastSafe }
              : a,
        ),
      };
    }),

  setBank: (id, bankDeg) =>
    set((s) => {
      const applyBank = (a: Aircraft) => ({
        ...a,
        bankDeg,
        loadFactorG: loadFactorFromBank(bankDeg),
        activeControl: "bank" as const,
        turn:
          bankDeg > 0.5
            ? ("right" as const)
            : bankDeg < -0.5
              ? ("left" as const)
              : ("straight" as const),
      });
      return {
        aircraft: s.aircraft.map((a) =>
          a.id === id ? applyBank(a) : s.syncEdits ? applyBank(a) : a,
        ),
      };
    }),

  setLoadFactor: (id, g) =>
    set((s) => {
      const applyG = (a: Aircraft) => {
        const mag = bankFromLoadFactor(g);
        const sign = a.bankDeg < 0 ? -1 : 1;
        const bankDeg = sign * mag;
        return {
          ...a,
          bankDeg,
          loadFactorG: g,
          activeControl: "g" as const,
          turn:
            bankDeg > 0.5
              ? ("right" as const)
              : bankDeg < -0.5
                ? ("left" as const)
                : ("straight" as const),
        };
      };
      return {
        aircraft: s.aircraft.map((a) =>
          a.id === id ? applyG(a) : s.syncEdits ? applyG(a) : a,
        ),
      };
    }),

  setActiveControl: (id, control) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id ? { ...a, activeControl: control } : a,
      ),
    })),

  setTargetHeading: (id, headingMagDeg) =>
    set((s) => {
      const apply = (a: Aircraft) => ({
        ...a,
        targetHeadingMagDeg: headingMagDeg,
      });
      return {
        aircraft: s.aircraft.map((a) =>
          a.id === id ? apply(a) : s.syncEdits ? apply(a) : a,
        ),
      };
    }),

  setPreset: (id, presetId) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) => {
        if (a.id !== id) return a;
        const preset = AIRCRAFT_PRESETS[presetId];
        return {
          ...a,
          preset: presetId,
          speedKt: Math.min(a.speedKt, preset.vneKt),
          loadFactorG: Math.min(a.loadFactorG, preset.maxG),
        };
      }),
    })),

  setPosition: (id, lat, lon) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id ? { ...a, position: { lat, lon } } : a,
      ),
    })),

  addWaypoint: (id, wp) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id ? { ...a, route: [...a.route, wp] } : a,
      ),
    })),

  removeWaypoint: (id, index) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id
          ? {
              ...a,
              route: a.route.filter((_, i) => i !== index),
              routeIndex: Math.min(
                a.routeIndex,
                Math.max(0, a.route.length - 2),
              ),
            }
          : a,
      ),
    })),

  clearRoute: (id) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id ? { ...a, route: [], routeIndex: 0 } : a,
      ),
    })),

  addStep: (id, step) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id ? { ...a, steps: [...a.steps, step] } : a,
      ),
    })),

  updateStep: (id, index, step) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id
          ? {
              ...a,
              steps: a.steps.map((sx, i) => (i === index ? step : sx)),
            }
          : a,
      ),
    })),

  removeStep: (id, index) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id
          ? {
              ...a,
              steps: a.steps.filter((_, i) => i !== index),
              stepIndex: Math.min(a.stepIndex, Math.max(0, a.steps.length - 2)),
            }
          : a,
      ),
    })),

  moveStep: (id, index, dir) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) => {
        if (a.id !== id) return a;
        const j = index + dir;
        if (j < 0 || j >= a.steps.length) return a;
        const steps = [...a.steps];
        const [item] = steps.splice(index, 1);
        steps.splice(j, 0, item);
        return { ...a, steps };
      }),
    })),

  clearSteps: (id) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id ? { ...a, steps: [], stepIndex: 0 } : a,
      ),
    })),

  setFormationMode: (mode) =>
    set((s) => ({
      formationMode: mode,
      aircraft:
        mode === "linked"
          ? applyFormation(
              s.aircraft,
              s.formationPreset,
              s.formationSpacingFt,
              s.formationStaggerFt,
            )
          : s.aircraft,
    })),

  setFormationPreset: (preset) =>
    set((s) => ({
      formationPreset: preset,
      aircraft:
        s.formationMode === "linked"
          ? applyFormation(
              s.aircraft,
              preset,
              s.formationSpacingFt,
              s.formationStaggerFt,
            )
          : s.aircraft,
    })),

  setFormationSpacingFt: (ft) =>
    set((s) => ({
      formationSpacingFt: ft,
      aircraft:
        s.formationMode === "linked"
          ? applyFormation(
              s.aircraft,
              s.formationPreset,
              ft,
              s.formationStaggerFt,
            )
          : s.aircraft,
    })),

  setFormationStaggerFt: (ft) =>
    set((s) => ({
      formationStaggerFt: ft,
      aircraft:
        s.formationMode === "linked"
          ? applyFormation(
              s.aircraft,
              s.formationPreset,
              s.formationSpacingFt,
              ft,
            )
          : s.aircraft,
    })),

  toggleLock: (id) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id ? { ...a, locked: !a.locked } : a,
      ),
    })),

  syncFormation: () =>
    set((s) => ({
      aircraft:
        s.formationMode === "linked"
          ? applyFormation(
              s.aircraft,
              s.formationPreset,
              s.formationSpacingFt,
              s.formationStaggerFt,
            )
          : s.aircraft,
    })),

  loadScenario: (s: Scenario) =>
    set({
      aircraft: s.aircraft,
      selectedId: s.selectedId as AircraftId,
      formationMode: s.formationMode,
      formationPreset: s.formationPreset,
      formationSpacingFt: s.formationSpacingFt,
      formationStaggerFt: s.formationStaggerFt,
      playing: false,
      simTime: 0,
      initialAircraft: null,
    }),
}));

// Hydrate from localStorage once on module load.
const hydrated = loadLocal();
if (hydrated) {
  useScenario.setState({
    aircraft: hydrated.aircraft,
    selectedId: hydrated.selectedId as AircraftId,
    formationMode: hydrated.formationMode,
    formationPreset: hydrated.formationPreset,
    formationSpacingFt: hydrated.formationSpacingFt,
    formationStaggerFt: hydrated.formationStaggerFt,
  });
}

// Autosave: persist any change to scenario-shape fields.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useScenario.subscribe((state) => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveLocal({
      aircraft: state.aircraft,
      selectedId: state.selectedId,
      formationMode: state.formationMode,
      formationPreset: state.formationPreset,
      formationSpacingFt: state.formationSpacingFt,
      formationStaggerFt: state.formationStaggerFt,
    });
  }, 400);
});
