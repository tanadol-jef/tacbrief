export const KT_TO_MS = 0.514444;
export const MS_TO_KT = 1 / KT_TO_MS;
export const FT_TO_M = 0.3048;
export const M_TO_FT = 1 / FT_TO_M;
export const M_TO_NM = 1 / 1852;
export const NM_TO_M = 1852;
export const FT_TO_NM = FT_TO_M * M_TO_NM;
export const NM_TO_FT = 1 / FT_TO_NM;
export const G_MS2 = 9.80665;
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function wrap360(deg: number) {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}
