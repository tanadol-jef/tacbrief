export type AircraftId = 1 | 2 | 3 | 4;

export type PresetId =
  | "F-16A"
  | "Gripen-C"
  | "T-50TH"
  | "F-5E"
  | "L-39"
  | "Custom";

export type BankOrG = "bank" | "g";

export type TurnDirection = "left" | "right" | "straight";

export type LatLon = { lat: number; lon: number };

export type Waypoint = LatLon & {
  altFt?: number;
  speedKt?: number;
};

export type ManeuverStep =
  | { kind: "waypoint"; lat: number; lon: number; altFt?: number; speedKt?: number }
  | { kind: "turn-to"; headingMagDeg: number; bankDeg?: number }
  | { kind: "set-speed"; speedKt: number }
  | { kind: "set-altitude"; altFt: number; climbRateFpm?: number }
  | { kind: "hold"; seconds: number; remaining?: number };

export type ProgramEventCondition =
  | {
      kind: "headingCross";
      sourceAircraftId: AircraftId;
      headingMagDeg: number;
      toleranceDeg: number;
    }
  | {
      kind: "blockComplete";
      sourceAircraftId: AircraftId;
      blockId: string;
      toleranceDeg: number;
    }
  | {
      kind: "waypointCaptured";
      sourceAircraftId?: AircraftId;
      waypointIndex: number;
      toleranceDeg?: number;
    }
  | {
      kind: "vectorPass";
      sourceAircraftId: AircraftId;
      referenceAircraftId: AircraftId;
      toleranceDeg: number;
    };

export type ProgramStartCondition =
  | { kind: "immediate" }
  | { kind: "afterSeconds"; seconds: number }
  | ProgramEventCondition
  | { kind: "triggerFired"; triggerId: string };

export type ProgramExitCondition =
  | { kind: "actionComplete" }
  | { kind: "afterSeconds"; seconds: number }
  | { kind: "headingCaptured" }
  | ProgramEventCondition
  | { kind: "triggerFired"; triggerId: string };

export type ProgramHeadingLane =
  | {
      enabled: true;
      mode: "heading";
      targetHeadingMagDeg: number;
      loadFactorG: number;
      turnControl?: "g" | "bank";
      bankDeg?: number;
    }
  | {
      enabled: true;
      mode: "waypoint";
      waypointIndex: number;
      loadFactorG: number;
      turnControl?: "g" | "bank";
      bankDeg?: number;
    }
  | {
      enabled: true;
      mode: "aircraftHeading";
      referenceAircraftId: AircraftId;
      loadFactorG: number;
      turnControl?: "g" | "bank";
      bankDeg?: number;
    };

export type ProgramSpeedLane = {
  enabled: boolean;
  targetSpeedKt: number;
};

export type ProgramAltitudeLane = {
  enabled: boolean;
  mode?: "set" | "climb";
  targetAltFt: number;
  climbRateFpm: number;
};

export type ProgramHoldLane = {
  enabled: boolean;
};

export type ProgramBlock = {
  id: string;
  label: string;
  start: ProgramStartCondition;
  exit: ProgramExitCondition;
  lanes: {
    heading?: ProgramHeadingLane;
    speed?: ProgramSpeedLane;
    altitude?: ProgramAltitudeLane;
    hold?: ProgramHoldLane;
  };
};

export type ProgramTrigger =
  | {
      id: string;
      label: string;
      kind: "headingCross";
      sourceAircraftId: AircraftId;
      headingMagDeg: number;
      toleranceDeg: number;
    }
  | {
      id: string;
      label: string;
      kind: "blockComplete";
      sourceAircraftId: AircraftId;
      blockId: string;
      toleranceDeg: number;
    }
  | {
      id: string;
      label: string;
      kind: "vectorPass";
      sourceAircraftId: AircraftId;
      referenceAircraftId: AircraftId;
      toleranceDeg: number;
    }
  | {
      id: string;
      label: string;
      kind: "waypointCaptured";
      sourceAircraftId: AircraftId;
      waypointIndex: number;
      toleranceDeg: number;
    };

export type ProgramEventType =
  | "block-started"
  | "block-completed"
  | "trigger-armed"
  | "trigger-fired"
  | "route-waypoint-captured";

export type ProgramEvent = {
  id: string;
  time: number;
  aircraftId?: AircraftId;
  callsign?: string;
  type: ProgramEventType;
  detail: string;
};

export type AircraftProgramRuntime = {
  activeBlockIndex: number | null;
  blockStartedAt: number | null;
  waitingBlockIndex: number | null;
  waitingStartedAt: number | null;
  completedBlockIds: string[];
  resolvedHeadingMagDeg?: number;
};

export type ProgramRuntime = {
  aircraft: Record<number, AircraftProgramRuntime>;
  firedTriggerIds: string[];
  firedConditionKeys: string[];
  armedConditionKeys: string[];
  capturedWaypointKeys: string[];
};

export type FormationMode = "independent" | "linked";

export type TrailPoint = { lat: number; lon: number; t: number };

export type Aircraft = {
  id: AircraftId;
  callsign: string;
  preset: PresetId;
  color: string;
  visible: boolean;
  locked: boolean;

  position: LatLon;
  altitudeFt: number;
  speedKt: number; // IAS
  headingMagDeg: number; // 0-360 magnetic

  bankDeg: number; // -80..80, sign = direction
  loadFactorG: number; // derived from bank
  activeControl: BankOrG;
  turn: TurnDirection;

  route: Waypoint[];
  routeIndex: number;
  trail: TrailPoint[];
  steps: ManeuverStep[];
  stepIndex: number;
  programBlocks: ProgramBlock[];
  /** Target heading (°M) for ad-hoc turn rollout. Null = no target, keep turning. */
  targetHeadingMagDeg: number | null;
};

export type MeasurementType = "ruler" | "protractor";

export type MeasurementAnchor =
  | { kind: "fixed"; lat: number; lon: number }
  | { kind: "aircraft"; aircraftId: AircraftId }
  | { kind: "replay-aircraft"; aircraftId: AircraftId };

export type Measurement = {
  id: string;
  type: MeasurementType;
  name: string;
  color: string;
  points: MeasurementAnchor[];
  closed: boolean; // true once user finishes adding points
};

export type AircraftPreset = {
  id: PresetId;
  label: string;
  vneKt: number;
  cornerKt: number;
  maxG: number;
  cruiseKt: number;
  cruiseAltFt: number;
};
