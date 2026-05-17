// Thin wrapper around the `geomagnetism` package.
// Exposes declination in degrees east-positive.
//
//   magBearing + declination = trueBearing
//   trueBearing - declination = magBearing
//
// All internal geometry is in true degrees; convert at the UI boundary.
//
// Note: the bundled `geomagnetism` model (WMM-2020) is valid 2019-12-10 to
// 2024-12-10. Past that date the lib throws. We pin the lookup to mid-2024
// so the math keeps working until the package ships a newer model — the
// declination drift in Thailand is ~0.05°/yr, immaterial for briefing math.

// @ts-expect-error — geomagnetism has no type declarations
import geomagnetism from "geomagnetism";

const PINNED_DATE = new Date("2024-06-01T00:00:00Z");

type Point = { decl: number; incl: number };
type Model = { point: (latLon: [number, number]) => Point };

let cachedModel: Model | null = null;
function model(): Model {
  if (!cachedModel) cachedModel = geomagnetism.model(PINNED_DATE) as Model;
  return cachedModel;
}

export function declinationDeg(lat: number, lon: number): number {
  return model().point([lat, lon]).decl;
}

export function magToTrue(magDeg: number, lat: number, lon: number): number {
  return wrap360(magDeg + declinationDeg(lat, lon));
}

export function trueToMag(trueDeg: number, lat: number, lon: number): number {
  return wrap360(trueDeg - declinationDeg(lat, lon));
}

function wrap360(deg: number) {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}
