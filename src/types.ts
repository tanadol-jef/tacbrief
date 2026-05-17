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
