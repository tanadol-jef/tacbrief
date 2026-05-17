import { DEG, G_MS2, KT_TO_MS, M_TO_FT, M_TO_NM, RAD } from "./units";
import { iasToTas } from "./atmosphere";

export function bankFromLoadFactor(g: number): number {
  const n = Math.max(1, Math.abs(g));
  return Math.acos(1 / n) * RAD;
}

export function loadFactorFromBank(bankDeg: number): number {
  const cos = Math.cos(Math.abs(bankDeg) * DEG);
  if (cos <= 1e-6) return 99;
  return 1 / cos;
}

// R = V² / (g · tan φ), V in m/s, returns metres.
export function turnRadiusM(tasKt: number, bankDeg: number): number {
  const phi = Math.abs(bankDeg) * DEG;
  const tan = Math.tan(phi);
  if (tan < 1e-6) return Infinity;
  const v = tasKt * KT_TO_MS;
  return (v * v) / (G_MS2 * tan);
}

export function turnRadiusNm(tasKt: number, bankDeg: number): number {
  return turnRadiusM(tasKt, bankDeg) * M_TO_NM;
}

export function turnRadiusFt(tasKt: number, bankDeg: number): number {
  return turnRadiusM(tasKt, bankDeg) * M_TO_FT;
}

// ω = g · tan φ / V, deg/s.
export function turnRateDegPerSec(tasKt: number, bankDeg: number): number {
  const phi = Math.abs(bankDeg) * DEG;
  const v = tasKt * KT_TO_MS;
  if (v < 1e-3) return 0;
  return ((G_MS2 * Math.tan(phi)) / v) * RAD;
}

export type TurnSummary = {
  tasKt: number;
  radiusM: number;
  radiusNm: number;
  radiusFt: number;
  rateDegSec: number;
  loadFactorG: number;
};

export function summarizeTurn(
  iasKt: number,
  altFt: number,
  bankDeg: number,
): TurnSummary {
  const tas = iasToTas(iasKt, altFt);
  const radiusM = turnRadiusM(tas, bankDeg);
  return {
    tasKt: tas,
    radiusM,
    radiusNm: radiusM * M_TO_NM,
    radiusFt: radiusM * M_TO_FT,
    rateDegSec: turnRateDegPerSec(tas, bankDeg),
    loadFactorG: loadFactorFromBank(bankDeg),
  };
}
