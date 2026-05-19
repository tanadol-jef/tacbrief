import { create } from "zustand";
import type {
  Aircraft,
  AircraftId,
  BankOrG,
  FormationMode,
  ManeuverStep,
  PresetId,
  ProgramBlock,
  ProgramEventCondition,
  ProgramEvent,
  ProgramExitCondition,
  ProgramRuntime,
  ProgramStartCondition,
  ProgramTrigger,
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
import { clamp, wrap360 } from "../lib/units";

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
    programBlocks: [],
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
  programTriggers: ProgramTrigger[];
  programRuntime: ProgramRuntime;
  programEventLog: ProgramEvent[];
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
  addProgramBlock: (id: AircraftId) => void;
  updateProgramBlock: (
    id: AircraftId,
    index: number,
    patch: Partial<ProgramBlock>,
  ) => void;
  removeProgramBlock: (id: AircraftId, index: number) => void;
  moveProgramBlock: (id: AircraftId, index: number, dir: -1 | 1) => void;
  clearProgramBlocks: (id: AircraftId) => void;
  addProgramTrigger: (kind: ProgramTrigger["kind"]) => void;
  updateProgramTrigger: (trigger: ProgramTrigger) => void;
  removeProgramTrigger: (id: string) => void;
  clearEventLog: () => void;
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
const DEFAULT_PROGRAM_G = 4;
const TRIGGER_TOLERANCE_DEG = 2;
const HEADING_CAPTURE_DEG = 1.0;
const DEFAULT_CLIMB_FPM = 2000;
const SPEED_RAMP_KTPS = 8; // kt per second when set-speed step runs

let programIdCounter = 0;
let eventIdCounter = 0;

function newProgramId(prefix: string) {
  programIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${programIdCounter}`;
}

function newEvent(
  time: number,
  aircraft: Aircraft | undefined,
  type: ProgramEvent["type"],
  detail: string,
): ProgramEvent {
  eventIdCounter += 1;
  return {
    id: `evt-${Date.now().toString(36)}-${eventIdCounter}`,
    time,
    aircraftId: aircraft?.id,
    callsign: aircraft?.callsign,
    type,
    detail,
  };
}

function makeProgramRuntime(aircraft: Aircraft[]): ProgramRuntime {
  return {
    aircraft: Object.fromEntries(
      aircraft.map((a) => [
        a.id,
        {
          activeBlockIndex: null,
          blockStartedAt: null,
          waitingBlockIndex: null,
          waitingStartedAt: null,
          completedBlockIds: [],
          resolvedHeadingMagDeg: undefined,
        } satisfies ProgramRuntime["aircraft"][number],
      ]),
    ),
    firedTriggerIds: [],
    firedConditionKeys: [],
    armedConditionKeys: [],
    capturedWaypointKeys: [],
  };
}

function waypointCaptureKey(aircraftId: AircraftId, waypointIndex: number) {
  return `${aircraftId}:${waypointIndex}`;
}

function conditionKey(
  condition: ProgramEventCondition,
  ownerAircraftId: AircraftId,
  blockId: string,
  phase: "start" | "exit",
) {
  const sourceId = condition.sourceAircraftId ?? ownerAircraftId;
  if (condition.kind === "headingCross") {
    return `${ownerAircraftId}:${blockId}:${phase}:heading:${sourceId}:${wrap360(condition.headingMagDeg)}`;
  }
  if (condition.kind === "blockComplete") {
    return `${ownerAircraftId}:${blockId}:${phase}:block:${sourceId}:${condition.blockId}`;
  }
  if (condition.kind === "waypointCaptured") {
    return `${ownerAircraftId}:${blockId}:${phase}:waypoint:${sourceId}:${condition.waypointIndex}`;
  }
  return `${ownerAircraftId}:${blockId}:${phase}:vector:${condition.sourceAircraftId}:${condition.referenceAircraftId}`;
}

function isEventCondition(
  condition: ProgramStartCondition | ProgramExitCondition,
): condition is ProgramEventCondition {
  return (
    condition.kind === "headingCross" ||
    condition.kind === "blockComplete" ||
    condition.kind === "waypointCaptured" ||
    condition.kind === "vectorPass"
  );
}

function makeDefaultBlock(a: Aircraft, index: number): ProgramBlock {
  return {
    id: newProgramId("blk"),
    label: `Block ${index + 1}`,
    start: index === 0 ? { kind: "afterSeconds", seconds: 0 } : { kind: "immediate" },
    exit: { kind: "actionComplete" },
    lanes: {
      heading: {
        enabled: true,
        mode: "heading",
        targetHeadingMagDeg: Math.round(a.headingMagDeg),
        loadFactorG: Math.min(DEFAULT_PROGRAM_G, AIRCRAFT_PRESETS[a.preset].maxG),
      },
    },
  };
}

export function stepsToProgramBlocks(a: Aircraft): ProgramBlock[] {
  let waypointOffset = 0;
  return (a.steps ?? []).map((step, i) => {
    const start =
      i === 0 ? ({ kind: "afterSeconds", seconds: 0 } as const) : ({ kind: "immediate" } as const);
    if (step.kind === "turn-to") {
      return {
        id: newProgramId("blk"),
        label: `Turn ${Math.round(step.headingMagDeg).toString().padStart(3, "0")}M`,
        start,
        exit: { kind: "actionComplete" },
        lanes: {
          heading: {
            enabled: true,
            mode: "heading",
            targetHeadingMagDeg: wrap360(step.headingMagDeg),
            loadFactorG: Math.min(
              loadFactorFromBank(step.bankDeg ?? DEFAULT_TURN_BANK_DEG),
              AIRCRAFT_PRESETS[a.preset].maxG,
            ),
          },
        },
      };
    }
    if (step.kind === "waypoint") {
      const routeIndex = Math.max(0, a.route.length + waypointOffset);
      waypointOffset += 1;
      return {
        id: newProgramId("blk"),
        label: `Waypoint ${i + 1}`,
        start,
        exit: { kind: "actionComplete" },
        lanes: {
          heading: {
            enabled: true,
            mode: "waypoint",
            waypointIndex: routeIndex,
            loadFactorG: Math.min(DEFAULT_PROGRAM_G, AIRCRAFT_PRESETS[a.preset].maxG),
          },
        },
      };
    }
    if (step.kind === "set-speed") {
      const seconds = Math.max(1, Math.ceil(Math.abs(step.speedKt - a.speedKt) / SPEED_RAMP_KTPS));
      return {
        id: newProgramId("blk"),
        label: `Speed ${Math.round(step.speedKt)} kt`,
        start,
        exit: { kind: "afterSeconds", seconds },
        lanes: { speed: { enabled: true, targetSpeedKt: step.speedKt } },
      };
    }
    if (step.kind === "set-altitude") {
      const rate = step.climbRateFpm ?? DEFAULT_CLIMB_FPM;
      const seconds = Math.max(1, Math.ceil(Math.abs(step.altFt - a.altitudeFt) / (rate / 60)));
      return {
        id: newProgramId("blk"),
        label: `Altitude ${Math.round(step.altFt)} ft`,
        start,
        exit: { kind: "afterSeconds", seconds },
        lanes: {
          altitude: {
            enabled: true,
            targetAltFt: step.altFt,
            climbRateFpm: rate,
          },
        },
      };
    }
    return {
      id: newProgramId("blk"),
      label: `Hold ${step.seconds}s`,
      start,
      exit: { kind: "afterSeconds", seconds: step.seconds },
      lanes: { hold: { enabled: true } },
    };
  });
}

export function normalizeAircraftProgram(a: Aircraft): Aircraft {
  const hasProgramBlocksField = Object.prototype.hasOwnProperty.call(
    a,
    "programBlocks",
  );
  const baseRoute = Array.isArray(a.route) ? a.route : [];
  const migratingSteps = !hasProgramBlocksField && Array.isArray(a.steps);
  const route = migratingSteps
    ? [
        ...baseRoute,
        ...(a.steps ?? [])
          .filter((step): step is Extract<ManeuverStep, { kind: "waypoint" }> => step.kind === "waypoint")
          .map((step) => ({
            lat: step.lat,
            lon: step.lon,
            altFt: step.altFt,
            speedKt: step.speedKt,
          })),
      ]
    : baseRoute;
  const programBlocks = hasProgramBlocksField && Array.isArray(a.programBlocks)
    ? a.programBlocks
    : Array.isArray(a.steps) && a.steps.length > 0
      ? stepsToProgramBlocks(a)
      : [];
  return {
    ...a,
    route,
    routeIndex: typeof a.routeIndex === "number" ? a.routeIndex : 0,
    steps: Array.isArray(a.steps) ? a.steps : [],
    stepIndex: typeof a.stepIndex === "number" ? a.stepIndex : 0,
    programBlocks,
    trail: Array.isArray(a.trail) ? a.trail : [],
  };
}

function headingError(currentTrue: number, desiredTrue: number) {
  let err = desiredTrue - currentTrue;
  while (err > 180) err -= 360;
  while (err < -180) err += 360;
  return err;
}

function angularError(current: number, target: number) {
  let err = wrap360(target) - wrap360(current);
  while (err > 180) err -= 360;
  while (err < -180) err += 360;
  return err;
}

function waypointDistanceNm(a: Aircraft, waypointIndex: number): number {
  const wp = a.route[waypointIndex];
  if (!wp) return Infinity;
  return turf.distance(
    [a.position.lon, a.position.lat],
    [wp.lon, wp.lat],
    { units: "nauticalmiles" },
  );
}

function capturedWaypoints(
  previous: Aircraft,
  next: Aircraft,
  capturedKeys: string[],
): number[] {
  const captured: number[] = [];
  for (let i = 0; i < next.route.length; i++) {
    if (capturedKeys.includes(waypointCaptureKey(next.id, i))) continue;
    const prevDist = waypointDistanceNm(previous, i);
    const nextDist = waypointDistanceNm(next, i);
    if (prevDist > CAPTURE_NM && nextDist <= CAPTURE_NM) {
      captured.push(i);
    }
  }
  return captured;
}

function blockStartSatisfied(
  a: Aircraft,
  block: ProgramBlock,
  simTime: number,
  runtime: ProgramRuntime,
  aircraftRuntime: ProgramRuntime["aircraft"][number],
): boolean {
  if (block.start.kind === "immediate") return true;
  if (block.start.kind === "afterSeconds") {
    const waitingStartedAt = aircraftRuntime.waitingStartedAt ?? simTime;
    return simTime - waitingStartedAt >= block.start.seconds;
  }
  if (block.start.kind === "waypointCaptured") {
    return runtime.firedConditionKeys.includes(
      conditionKey(block.start, a.id, block.id, "start"),
    );
  }
  if (isEventCondition(block.start)) {
    return runtime.firedConditionKeys.includes(
      conditionKey(block.start, a.id, block.id, "start"),
    );
  }
  return runtime.firedTriggerIds.includes(block.start.triggerId);
}

function nextStartableBlockIndex(
  a: Aircraft,
  simTime: number,
  runtime: ProgramRuntime,
  aircraftRuntime: ProgramRuntime["aircraft"][number],
): number | null {
  const nextIndex = a.programBlocks.findIndex(
    (block) => !aircraftRuntime.completedBlockIds.includes(block.id),
  );
  if (nextIndex < 0) return null;
  return blockStartSatisfied(
    a,
    a.programBlocks[nextIndex],
    simTime,
    runtime,
    aircraftRuntime,
  )
    ? nextIndex
    : null;
}

function prepareWaitingRuntime(
  a: Aircraft,
  simTime: number,
  aircraftRuntime: ProgramRuntime["aircraft"][number],
): ProgramRuntime["aircraft"][number] {
  if (aircraftRuntime.activeBlockIndex != null) return aircraftRuntime;
  const nextIndex = a.programBlocks.findIndex(
    (block) => !aircraftRuntime.completedBlockIds.includes(block.id),
  );
  if (nextIndex < 0) {
    return {
      ...aircraftRuntime,
      waitingBlockIndex: null,
      waitingStartedAt: null,
    };
  }
  if (
    aircraftRuntime.waitingBlockIndex === nextIndex &&
    aircraftRuntime.waitingStartedAt != null
  ) {
    return aircraftRuntime;
  }
  return {
    ...aircraftRuntime,
    waitingBlockIndex: nextIndex,
    waitingStartedAt: simTime,
  };
}

function blockExitSatisfied(
  a: Aircraft,
  block: ProgramBlock,
  simTime: number,
  startedAt: number,
  runtime: ProgramRuntime,
  aircraftRuntime: ProgramRuntime["aircraft"][number],
): boolean {
  if (block.exit.kind === "actionComplete") {
    return actionComplete(a, block, aircraftRuntime.resolvedHeadingMagDeg);
  }
  if (block.exit.kind === "afterSeconds") {
    return simTime - startedAt >= block.exit.seconds;
  }
  if (block.exit.kind === "triggerFired") {
    return runtime.firedTriggerIds.includes(block.exit.triggerId);
  }
  if (isEventCondition(block.exit)) {
    return runtime.firedConditionKeys.includes(
      conditionKey(block.exit, a.id, block.id, "exit"),
    );
  }
  return headingActionComplete(a, block, aircraftRuntime.resolvedHeadingMagDeg);
}

function headingActionComplete(
  a: Aircraft,
  block: ProgramBlock,
  resolvedHeadingMagDeg?: number,
) {
  const heading = block.lanes.heading;
  if (!heading) return true;
  if (heading.mode === "heading" || heading.mode === "aircraftHeading") {
    const target =
      heading.mode === "heading"
        ? heading.targetHeadingMagDeg
        : resolvedHeadingMagDeg;
    if (target == null) return true;
    return Math.abs(angularError(a.headingMagDeg, target)) < HEADING_CAPTURE_DEG;
  }
  return waypointDistanceNm(a, heading.waypointIndex) < CAPTURE_NM;
}

function actionComplete(
  a: Aircraft,
  block: ProgramBlock,
  resolvedHeadingMagDeg?: number,
) {
  const headingDone = block.lanes.heading
    ? headingActionComplete(a, block, resolvedHeadingMagDeg)
    : true;
  const speedDone = block.lanes.speed?.enabled
    ? Math.abs(a.speedKt - block.lanes.speed.targetSpeedKt) <= 1
    : true;
  const altitudeDone = block.lanes.altitude?.enabled
    ? Math.abs(a.altitudeFt - block.lanes.altitude.targetAltFt) <= 50
    : true;
  return headingDone && speedDone && altitudeDone;
}

function resolvedHeadingForBlock(
  block: ProgramBlock,
  allAircraft: Aircraft[],
): number | undefined {
  const heading = block.lanes.heading;
  return heading?.mode === "aircraftHeading"
    ? allAircraft.find((other) => other.id === heading.referenceAircraftId)
        ?.headingMagDeg
    : undefined;
}

function settleCompletedAction(
  a: Aircraft,
  block: ProgramBlock,
  resolvedHeadingMagDeg?: number,
): Aircraft {
  const heading = block.lanes.heading;
  if (!heading) return a;
  if (heading.mode === "heading" || heading.mode === "aircraftHeading") {
    const target =
      heading.mode === "heading"
        ? heading.targetHeadingMagDeg
        : resolvedHeadingMagDeg;
    if (target == null) return a;
    return {
      ...a,
      headingMagDeg: wrap360(target),
      bankDeg: 0,
      loadFactorG: 1,
      turn: "straight",
      targetHeadingMagDeg: null,
    };
  }
  return {
    ...a,
    bankDeg: 0,
    loadFactorG: 1,
    turn: "straight",
    targetHeadingMagDeg: null,
  };
}

function advanceProgramAircraft(
  a: Aircraft,
  allAircraft: Aircraft[],
  dt: number,
  simTime: number,
  runtime: ProgramRuntime,
): {
  aircraft: Aircraft;
  runtime: ProgramRuntime["aircraft"][number];
  events: ProgramEvent[];
  completedBlockIds: string[];
} {
  const events: ProgramEvent[] = [];
  const completedBlockIds: string[] = [];
  let aircraftRuntime =
    runtime.aircraft[a.id] ?? makeProgramRuntime([a]).aircraft[a.id];

  if (aircraftRuntime.activeBlockIndex == null) {
    aircraftRuntime = prepareWaitingRuntime(a, simTime, aircraftRuntime);
    const startIndex = nextStartableBlockIndex(a, simTime, runtime, aircraftRuntime);
    if (startIndex != null) {
      const startBlock = a.programBlocks[startIndex];
      aircraftRuntime = {
        ...aircraftRuntime,
        activeBlockIndex: startIndex,
        blockStartedAt: simTime,
        waitingBlockIndex: null,
        waitingStartedAt: null,
        resolvedHeadingMagDeg: resolvedHeadingForBlock(startBlock, allAircraft),
      };
      events.push(
        newEvent(
          simTime,
          a,
          "block-started",
          `${a.programBlocks[startIndex].label} started`,
        ),
      );
    }
  }

  let bankDeg = a.bankDeg;
  let speedKt = a.speedKt;
  let altitudeFt = a.altitudeFt;
  let activeControl = a.activeControl;
  const block =
    aircraftRuntime.activeBlockIndex == null
      ? null
      : a.programBlocks[aircraftRuntime.activeBlockIndex];

  if (block) {
    const heading = block.lanes.heading;
    if (heading) {
      let desiredTrue: number | null = null;
      if (heading.mode === "heading" || heading.mode === "aircraftHeading") {
        const targetHeading =
          heading.mode === "heading"
            ? heading.targetHeadingMagDeg
            : aircraftRuntime.resolvedHeadingMagDeg;
        if (targetHeading != null) {
          desiredTrue = magToTrue(targetHeading, a.position.lat, a.position.lon);
        }
      } else {
        const wp = a.route[heading.waypointIndex];
        if (wp) {
          desiredTrue = (turf.bearing([a.position.lon, a.position.lat], [wp.lon, wp.lat]) + 360) % 360;
        }
      }
      if (desiredTrue != null) {
        const currentTrue = magToTrue(a.headingMagDeg, a.position.lat, a.position.lon);
        const err = headingError(currentTrue, desiredTrue);
        if (Math.abs(err) < HEADING_CAPTURE_DEG) {
          bankDeg = 0;
        } else {
          const maxG = AIRCRAFT_PRESETS[a.preset].maxG;
          const maxBank = bankFromLoadFactor(maxG);
          const commandedBank =
            heading.turnControl === "bank"
              ? Math.min(Math.abs(heading.bankDeg ?? 30), maxBank)
              : bankFromLoadFactor(clamp(heading.loadFactorG, 1, maxG));
          bankDeg = Math.sign(err) * commandedBank;
        }
        activeControl = heading.turnControl === "bank" ? "bank" : "g";
      }
    } else if (block.lanes.hold?.enabled) {
      bankDeg = 0;
    }

    const speedLane = block.lanes.speed;
    if (speedLane?.enabled) {
      const diff = speedLane.targetSpeedKt - speedKt;
      const maxStep = SPEED_RAMP_KTPS * dt;
      speedKt =
        Math.abs(diff) <= maxStep
          ? speedLane.targetSpeedKt
          : speedKt + Math.sign(diff) * maxStep;
    }

    const altitudeLane = block.lanes.altitude;
    if (altitudeLane?.enabled) {
      if (altitudeLane.mode === "set") {
        altitudeFt = altitudeLane.targetAltFt;
      } else {
      const rateFpm = altitudeLane.climbRateFpm || DEFAULT_CLIMB_FPM;
      const maxStep = (rateFpm / 60) * dt;
      const diff = altitudeLane.targetAltFt - altitudeFt;
      altitudeFt =
        Math.abs(diff) <= maxStep
          ? altitudeLane.targetAltFt
          : altitudeFt + Math.sign(diff) * maxStep;
      }
    }
  }

  let omegaDeg = 0;
  if (Math.abs(bankDeg) > 0.5) {
    const tasForTurn = iasToTas(speedKt, altitudeFt);
    omegaDeg = turnRateDegPerSec(tasForTurn, bankDeg) * Math.sign(bankDeg);
  }
  const currentTrue = magToTrue(a.headingMagDeg, a.position.lat, a.position.lon);
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

  let nextAircraft: Aircraft = {
    ...a,
    position: { lat: newLat, lon: newLon },
    headingMagDeg: trueToMag(newTrueHeading, newLat, newLon),
    bankDeg,
    loadFactorG: loadFactorFromBank(bankDeg),
    activeControl,
    speedKt,
    altitudeFt,
    turn: bankDeg > 0.5 ? "right" : bankDeg < -0.5 ? "left" : "straight",
  };

  if (
    block &&
    aircraftRuntime.activeBlockIndex != null &&
    aircraftRuntime.blockStartedAt != null &&
    blockExitSatisfied(
      nextAircraft,
      block,
      simTime,
      aircraftRuntime.blockStartedAt,
      runtime,
      aircraftRuntime,
    )
  ) {
    nextAircraft = settleCompletedAction(
      nextAircraft,
      block,
      aircraftRuntime.resolvedHeadingMagDeg,
    );
    const nextCompleted = [...aircraftRuntime.completedBlockIds, block.id];
    completedBlockIds.push(block.id);
    events.push(
      newEvent(simTime, nextAircraft, "block-completed", `${block.label} completed`),
    );
    if (block.exit.kind === "waypointCaptured") {
      events.push(
        newEvent(
          simTime,
          nextAircraft,
          "route-waypoint-captured",
          `${block.label} waypoint captured`,
        ),
      );
    }
    aircraftRuntime = {
      activeBlockIndex: null,
      blockStartedAt: null,
      waitingBlockIndex: null,
      waitingStartedAt: null,
      completedBlockIds: nextCompleted,
      resolvedHeadingMagDeg: undefined,
    };
  }

  return {
    aircraft: nextAircraft,
    runtime: aircraftRuntime,
    events,
    completedBlockIds,
  };
}

function crossedHeading(prev: number, next: number, target: number, tolerance: number) {
  const prevErr = angularError(prev, target);
  const nextErr = angularError(next, target);
  return (
    Math.abs(prevErr) <= tolerance ||
    Math.abs(nextErr) <= tolerance ||
    (Math.sign(prevErr) !== Math.sign(nextErr) &&
      Math.abs(prevErr) < 90 &&
      Math.abs(nextErr) < 90)
  );
}

function bearingMagBetween(source: Aircraft, reference: Aircraft) {
  const trueBearing =
    (turf.bearing(
      [source.position.lon, source.position.lat],
      [reference.position.lon, reference.position.lat],
    ) +
      360) %
    360;
  return trueToMag(trueBearing, source.position.lat, source.position.lon);
}

function detectFiredTriggers(
  triggers: ProgramTrigger[],
  previous: Aircraft[],
  next: Aircraft[],
  runtime: ProgramRuntime,
  completedByAircraft: Record<number, string[]>,
): ProgramTrigger[] {
  const previousById = new Map(previous.map((a) => [a.id, a]));
  const nextById = new Map(next.map((a) => [a.id, a]));
  return triggers.filter((trigger) => {
    if (runtime.firedTriggerIds.includes(trigger.id)) return false;
    if (trigger.kind === "blockComplete") {
      return (completedByAircraft[trigger.sourceAircraftId] ?? []).includes(trigger.blockId);
    }
    if (trigger.kind === "waypointCaptured") {
      return runtime.capturedWaypointKeys.includes(
        waypointCaptureKey(trigger.sourceAircraftId, trigger.waypointIndex),
      );
    }
    const prevSource = previousById.get(trigger.sourceAircraftId);
    const nextSource = nextById.get(trigger.sourceAircraftId);
    if (!prevSource || !nextSource) return false;
    if (trigger.kind === "headingCross") {
      return crossedHeading(
        prevSource.headingMagDeg,
        nextSource.headingMagDeg,
        trigger.headingMagDeg,
        trigger.toleranceDeg,
      );
    }
    const prevReference = previousById.get(trigger.referenceAircraftId);
    const nextReference = nextById.get(trigger.referenceAircraftId);
    if (!prevReference || !nextReference) return false;
    return crossedHeading(
      prevSource.headingMagDeg,
      nextSource.headingMagDeg,
      bearingMagBetween(nextSource, nextReference),
      trigger.toleranceDeg,
    );
  });
}

type FiredCondition = {
  key: string;
  owner: Aircraft;
  block: ProgramBlock;
  phase: "start" | "exit";
  condition: ProgramEventCondition;
};

function detectFiredConditionDetails(
  previous: Aircraft[],
  next: Aircraft[],
  runtime: ProgramRuntime,
  completedByAircraft: Record<number, string[]>,
): FiredCondition[] {
  const previousById = new Map(previous.map((a) => [a.id, a]));
  const nextById = new Map(next.map((a) => [a.id, a]));
  const fired: FiredCondition[] = [];
  const candidates = waitingConditionCandidates(next, runtime);

  for (const candidate of candidates) {
    const { condition, owner, key } = candidate;
    if (
      runtime.firedConditionKeys.includes(key) ||
      fired.some((item) => item.key === key)
    ) continue;

    const sourceId = condition.sourceAircraftId ?? owner.id;
    if (condition.kind === "blockComplete") {
      if ((completedByAircraft[sourceId] ?? []).includes(condition.blockId)) {
        fired.push(candidate);
      }
      continue;
    }

    if (condition.kind === "waypointCaptured") {
      if (
        runtime.capturedWaypointKeys.includes(
          waypointCaptureKey(sourceId, condition.waypointIndex),
        )
      ) {
        fired.push(candidate);
      }
      continue;
    }

    const prevSource = previousById.get(sourceId);
    const nextSource = nextById.get(sourceId);
    if (!prevSource || !nextSource) continue;

    if (condition.kind === "headingCross") {
      if (
        crossedHeading(
          prevSource.headingMagDeg,
          nextSource.headingMagDeg,
          condition.headingMagDeg,
          condition.toleranceDeg,
        )
      ) {
        fired.push(candidate);
      }
      continue;
    }

    const nextReference = nextById.get(condition.referenceAircraftId);
    if (!nextReference) continue;
    if (
      crossedHeading(
        prevSource.headingMagDeg,
        nextSource.headingMagDeg,
        bearingMagBetween(nextSource, nextReference),
        condition.toleranceDeg,
      )
    ) {
      fired.push(candidate);
    }
  }

  return fired;
}

function waitingConditionCandidates(
  aircraft: Aircraft[],
  runtime: ProgramRuntime,
): FiredCondition[] {
  const candidates: FiredCondition[] = [];
  for (const owner of aircraft) {
    const aircraftRuntime = runtime.aircraft[owner.id];
    if (!aircraftRuntime) continue;
    if (aircraftRuntime.activeBlockIndex == null) {
      const nextBlock = owner.programBlocks.find(
        (block) => !aircraftRuntime.completedBlockIds.includes(block.id),
      );
      if (nextBlock && isEventCondition(nextBlock.start)) {
        candidates.push({
          key: conditionKey(nextBlock.start, owner.id, nextBlock.id, "start"),
          owner,
          block: nextBlock,
          phase: "start",
          condition: nextBlock.start,
        });
      }
    } else {
      const block = owner.programBlocks[aircraftRuntime.activeBlockIndex];
      if (block && isEventCondition(block.exit)) {
        candidates.push({
          key: conditionKey(block.exit, owner.id, block.id, "exit"),
          owner,
          block,
          phase: "exit",
          condition: block.exit,
        });
      }
    }
  }
  return candidates;
}

function describeCondition(
  condition: ProgramEventCondition,
  aircraft: Aircraft[],
): string {
  const sourceId = condition.sourceAircraftId;
  const source = sourceId
    ? (aircraft.find((a) => a.id === sourceId)?.callsign ?? `No.${sourceId}`)
    : "ownship";
  if (condition.kind === "headingCross") {
    return `${source} heading crosses ${Math.round(condition.headingMagDeg)
      .toString()
      .padStart(3, "0")}M`;
  }
  if (condition.kind === "blockComplete") {
    return `${source} block complete`;
  }
  if (condition.kind === "waypointCaptured") {
    return `${source} captures WP ${condition.waypointIndex + 1}`;
  }
  const ref =
    aircraft.find((a) => a.id === condition.referenceAircraftId)?.callsign ??
    `No.${condition.referenceAircraftId}`;
  return `${source} vector passes ${ref}`;
}

function advanceLegacyAircraft(a: Aircraft, dt: number): Aircraft {
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
    programBlocks: a.programBlocks.map((block) => ({
      ...block,
      start: { ...block.start },
      exit: { ...block.exit },
      lanes: {
        heading: block.lanes.heading ? { ...block.lanes.heading } : undefined,
        speed: block.lanes.speed ? { ...block.lanes.speed } : undefined,
        altitude: block.lanes.altitude ? { ...block.lanes.altitude } : undefined,
        hold: block.lanes.hold ? { ...block.lanes.hold } : undefined,
      },
    })),
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
  programTriggers: [],
  programRuntime: makeProgramRuntime([makeAircraft(1, "F-16A")]),
  programEventLog: [],
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
            ...(s.initialAircraft
              ? {}
              : {
                  programRuntime: makeProgramRuntime(s.aircraft),
                  programEventLog: s.programTriggers.map((trigger) =>
                    newEvent(
                      s.simTime,
                      s.aircraft.find((a) => a.id === trigger.sourceAircraftId),
                      "trigger-armed",
                      `${trigger.label} armed`,
                    ),
                  ),
                }),
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
      programRuntime: makeProgramRuntime(s.initialAircraft ?? s.aircraft),
      programEventLog: [],
      initialAircraft: null,
    })),

  tick: (dt) =>
    set((s) => {
      const { trailSeconds, trailSampleHz } = useSettings.getState();
      const nextSimTime = s.simTime + dt;
      let programRuntime: ProgramRuntime = {
        aircraft: { ...s.programRuntime.aircraft },
        firedTriggerIds: [...s.programRuntime.firedTriggerIds],
        firedConditionKeys: [...(s.programRuntime.firedConditionKeys ?? [])],
        armedConditionKeys: [...(s.programRuntime.armedConditionKeys ?? [])],
        capturedWaypointKeys: [...(s.programRuntime.capturedWaypointKeys ?? [])],
      };
      const programEvents: ProgramEvent[] = [];
      const completedByAircraft: Record<number, string[]> = {};
      const stepped = s.aircraft.map((a) => {
        const aircraft = normalizeAircraftProgram(a);
        if (aircraft.programBlocks.length === 0) {
          const advanced = advanceLegacyAircraft(aircraft, dt);
          const captured = capturedWaypoints(
            aircraft,
            advanced,
            programRuntime.capturedWaypointKeys,
          );
          if (captured.length > 0) {
            programRuntime = {
              ...programRuntime,
              capturedWaypointKeys: [
                ...programRuntime.capturedWaypointKeys,
                ...captured.map((index) => waypointCaptureKey(advanced.id, index)),
              ],
            };
          }
          for (const index of captured) {
            programEvents.push(
              newEvent(
                nextSimTime,
                advanced,
                "route-waypoint-captured",
                `Waypoint ${index + 1} overflown`,
              ),
            );
          }
          return advanced;
        }
        const result = advanceProgramAircraft(
          aircraft,
          s.aircraft,
          dt,
          nextSimTime,
          programRuntime,
        );
        programRuntime = {
          ...programRuntime,
          aircraft: {
            ...programRuntime.aircraft,
            [aircraft.id]: result.runtime,
          },
        };
        completedByAircraft[aircraft.id] = result.completedBlockIds;
        programEvents.push(...result.events);
        const captured = capturedWaypoints(
          aircraft,
          result.aircraft,
          programRuntime.capturedWaypointKeys,
        );
        if (captured.length > 0) {
          programRuntime = {
            ...programRuntime,
            capturedWaypointKeys: [
              ...programRuntime.capturedWaypointKeys,
              ...captured.map((index) =>
                waypointCaptureKey(result.aircraft.id, index),
              ),
            ],
          };
          for (const index of captured) {
            programEvents.push(
              newEvent(
                nextSimTime,
                result.aircraft,
                "route-waypoint-captured",
                `Waypoint ${index + 1} overflown`,
              ),
            );
          }
        }
        return result.aircraft;
      });
      const firedTriggers = detectFiredTriggers(
        s.programTriggers,
        s.aircraft,
        stepped,
        programRuntime,
        completedByAircraft,
      );
      const firedConditions = detectFiredConditionDetails(
        s.aircraft,
        stepped,
        programRuntime,
        completedByAircraft,
      );
      const firedConditionKeys = firedConditions.map((item) => item.key);
      if (firedConditionKeys.length > 0) {
        programRuntime = {
          ...programRuntime,
          firedConditionKeys: [
            ...programRuntime.firedConditionKeys,
            ...firedConditionKeys,
          ],
        };
        for (const item of firedConditions) {
          programEvents.push(
            newEvent(
              nextSimTime,
              item.owner,
              "trigger-fired",
              `${item.block.label} ${item.phase} condition fired: ${describeCondition(item.condition, stepped)}`,
            ),
          );
        }
      }
      const armedConditions = waitingConditionCandidates(stepped, programRuntime)
        .filter(
          (item) =>
            !programRuntime.armedConditionKeys.includes(item.key) &&
            !programRuntime.firedConditionKeys.includes(item.key),
        );
      if (armedConditions.length > 0) {
        programRuntime = {
          ...programRuntime,
          armedConditionKeys: [
            ...programRuntime.armedConditionKeys,
            ...armedConditions.map((item) => item.key),
          ],
        };
        for (const item of armedConditions) {
          programEvents.push(
            newEvent(
              nextSimTime,
              item.owner,
              "trigger-armed",
              `${item.block.label} ${item.phase} waiting: ${describeCondition(item.condition, stepped)}`,
            ),
          );
        }
      }
      const startedAfterConditions: ProgramEvent[] = [];
      for (const a of stepped) {
        let aircraftRuntime = programRuntime.aircraft[a.id];
        if (!aircraftRuntime || aircraftRuntime.activeBlockIndex != null) continue;
        aircraftRuntime = prepareWaitingRuntime(a, nextSimTime, aircraftRuntime);
        programRuntime = {
          ...programRuntime,
          aircraft: {
            ...programRuntime.aircraft,
            [a.id]: aircraftRuntime,
          },
        };
        const startIndex = nextStartableBlockIndex(
          a,
          nextSimTime,
          programRuntime,
          aircraftRuntime,
        );
        if (startIndex == null) continue;
        programRuntime = {
          ...programRuntime,
          aircraft: {
            ...programRuntime.aircraft,
            [a.id]: {
              ...aircraftRuntime,
              activeBlockIndex: startIndex,
              blockStartedAt: nextSimTime,
              waitingBlockIndex: null,
              waitingStartedAt: null,
              resolvedHeadingMagDeg: resolvedHeadingForBlock(
                a.programBlocks[startIndex],
                stepped,
              ),
            },
          },
        };
        startedAfterConditions.push(
          newEvent(
            nextSimTime,
            a,
            "block-started",
            `${a.programBlocks[startIndex].label} started`,
          ),
        );
      }
      programEvents.push(...startedAfterConditions);
      if (firedTriggers.length > 0) {
        programRuntime = {
          ...programRuntime,
          firedTriggerIds: [
            ...programRuntime.firedTriggerIds,
            ...firedTriggers.map((trigger) => trigger.id),
          ],
        };
        for (const trigger of firedTriggers) {
          programEvents.push(
            newEvent(
              nextSimTime,
              stepped.find((a) => a.id === trigger.sourceAircraftId),
              "trigger-fired",
              `${trigger.label} fired`,
            ),
          );
        }
      }
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

      return {
        simTime: nextSimTime,
        aircraft: next,
        programRuntime,
        programEventLog:
          programEvents.length > 0
            ? [...s.programEventLog, ...programEvents].slice(-200)
            : s.programEventLog,
      };
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
      delete broadcastSafe.programBlocks;
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

  addProgramBlock: (id) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id
          ? {
              ...a,
              programBlocks: [
                ...a.programBlocks,
                makeDefaultBlock(a, a.programBlocks.length),
              ],
            }
          : a,
      ),
    })),

  updateProgramBlock: (id, index, patch) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id
          ? {
              ...a,
              programBlocks: a.programBlocks.map((block, i) =>
                i === index ? { ...block, ...patch } : block,
              ),
            }
          : a,
      ),
    })),

  removeProgramBlock: (id, index) =>
    set((s) => {
      const blockId = s.aircraft.find((a) => a.id === id)?.programBlocks[index]?.id;
      return {
        aircraft: s.aircraft.map((a) =>
          a.id === id
            ? {
                ...a,
                programBlocks: a.programBlocks.filter((_, i) => i !== index),
              }
            : a,
        ),
        programTriggers: blockId
          ? s.programTriggers.filter(
              (trigger) =>
                trigger.kind !== "blockComplete" || trigger.blockId !== blockId,
            )
          : s.programTriggers,
      };
    }),

  moveProgramBlock: (id, index, dir) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) => {
        if (a.id !== id) return a;
        const j = index + dir;
        if (j < 0 || j >= a.programBlocks.length) return a;
        const programBlocks = [...a.programBlocks];
        const [item] = programBlocks.splice(index, 1);
        programBlocks.splice(j, 0, item);
        return { ...a, programBlocks };
      }),
    })),

  clearProgramBlocks: (id) =>
    set((s) => ({
      aircraft: s.aircraft.map((a) =>
        a.id === id ? { ...a, programBlocks: [] } : a,
      ),
      programTriggers: s.programTriggers.filter(
        (trigger) =>
          trigger.kind !== "blockComplete" ||
          !s.aircraft
            .find((a) => a.id === id)
            ?.programBlocks.some((block) => block.id === trigger.blockId),
      ),
    })),

  addProgramTrigger: (kind) =>
    set((s) => {
      const source = s.aircraft.find((a) => a.id === s.selectedId) ?? s.aircraft[0];
      if (!source) return s;
      const id = newProgramId("trg");
      const firstBlock = source.programBlocks[0];
      const base = {
        id,
        label: `Trigger ${s.programTriggers.length + 1}`,
        sourceAircraftId: source.id,
        toleranceDeg: TRIGGER_TOLERANCE_DEG,
      };
      const trigger: ProgramTrigger =
        kind === "headingCross"
          ? {
              ...base,
              kind,
              headingMagDeg: Math.round(source.headingMagDeg),
            }
          : kind === "blockComplete"
            ? {
                ...base,
                kind,
                blockId: firstBlock?.id ?? "",
              }
            : kind === "waypointCaptured"
              ? {
                  ...base,
                  kind,
                  waypointIndex: 0,
                }
            : {
                ...base,
                kind,
                referenceAircraftId:
                  s.aircraft.find((a) => a.id !== source.id)?.id ?? source.id,
              };
      return { programTriggers: [...s.programTriggers, trigger] };
    }),

  updateProgramTrigger: (trigger) =>
    set((s) => ({
      programTriggers: s.programTriggers.map((t) =>
        t.id === trigger.id ? trigger : t,
      ),
    })),

  removeProgramTrigger: (id) =>
    set((s) => ({
      programTriggers: s.programTriggers.filter((trigger) => trigger.id !== id),
      programRuntime: {
        ...s.programRuntime,
        firedTriggerIds: s.programRuntime.firedTriggerIds.filter(
          (triggerId) => triggerId !== id,
        ),
      },
    })),

  clearEventLog: () => set({ programEventLog: [] }),

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
      aircraft: s.aircraft.map(normalizeAircraftProgram),
      programTriggers: s.programTriggers ?? [],
      programRuntime: makeProgramRuntime(s.aircraft.map(normalizeAircraftProgram)),
      programEventLog: [],
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
  const aircraft = hydrated.aircraft.map(normalizeAircraftProgram);
  useScenario.setState({
    aircraft,
    selectedId: hydrated.selectedId as AircraftId,
    programTriggers: hydrated.programTriggers ?? [],
    programRuntime: makeProgramRuntime(aircraft),
    programEventLog: [],
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
      aircraft: state.aircraft.map(normalizeAircraftProgram),
      programTriggers: state.programTriggers,
      selectedId: state.selectedId,
      formationMode: state.formationMode,
      formationPreset: state.formationPreset,
      formationSpacingFt: state.formationSpacingFt,
      formationStaggerFt: state.formationStaggerFt,
    });
  }, 400);
});
