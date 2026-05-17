import { FT_TO_M } from "./units";

// ISA constants
const T0 = 288.15; // K at sea level
const P0 = 101325; // Pa
const L = 0.0065; // K/m troposphere lapse rate
const R = 287.05287; // J/(kg·K) dry air
const RHO0 = P0 / (R * T0); // ≈ 1.225 kg/m³
const TROPOPAUSE_M = 11000;
const T_TROPO = T0 - L * TROPOPAUSE_M; // ≈ 216.65 K
const P_TROPO = P0 * Math.pow(T_TROPO / T0, 9.80665 / (R * L));

export type AtmosphericState = {
  pressurePa: number;
  temperatureK: number;
  densityKgM3: number;
  densityRatio: number; // ρ / ρ0
};

export function isaAt(altFt: number): AtmosphericState {
  const h = altFt * FT_TO_M;
  let T: number;
  let P: number;
  if (h < TROPOPAUSE_M) {
    T = T0 - L * h;
    P = P0 * Math.pow(T / T0, 9.80665 / (R * L));
  } else {
    T = T_TROPO;
    P = P_TROPO * Math.exp((-9.80665 * (h - TROPOPAUSE_M)) / (R * T_TROPO));
  }
  const rho = P / (R * T);
  return {
    pressurePa: P,
    temperatureK: T,
    densityKgM3: rho,
    densityRatio: rho / RHO0,
  };
}

// Simple incompressible IAS→TAS: TAS = IAS / sqrt(σ).
// Good enough below ~M0.5 for briefing-room math.
export function iasToTas(iasKt: number, altFt: number): number {
  const { densityRatio } = isaAt(altFt);
  return iasKt / Math.sqrt(densityRatio);
}
