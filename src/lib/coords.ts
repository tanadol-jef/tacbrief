// DD MM.MMM formatting with hemisphere letters.
// Storage: signed decimal degrees. UI: this module.

export function formatLatDDM(lat: number): string {
  return ddm(lat, true);
}

export function formatLonDDM(lon: number): string {
  return ddm(lon, false);
}

export function formatDDM(lat: number, lon: number): string {
  return `${formatLatDDM(lat)}  ${formatLonDDM(lon)}`;
}

function ddm(value: number, isLat: boolean): string {
  if (!Number.isFinite(value)) return "—";
  const hemi = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  let min = (abs - deg) * 60;
  // guard against rounding 59.9995 → 60.000
  if (min >= 59.9995) {
    min = 0;
    deg += 1;
  }
  const degStr = isLat
    ? String(deg).padStart(2, "0")
    : String(deg).padStart(3, "0");
  const minStr = min.toFixed(3).padStart(6, "0");
  return `${hemi} ${degStr}° ${minStr}'`;
}

// Best-effort parser: accepts forms like
//   "N1354.567 E10036.234"
//   "13 54.567 N 100 36.234 E"
//   "13°54.567'N 100°36.234'E"
// Returns null on failure.
const LAT_RE = /([NS])?\s*(\d{1,2})\s*[°\s]\s*(\d{1,2}(?:\.\d+)?)\s*['′]?\s*([NS])?/i;
const LON_RE = /([EW])?\s*(\d{1,3})\s*[°\s]\s*(\d{1,2}(?:\.\d+)?)\s*['′]?\s*([EW])?/i;

export function parseDDM(input: string): { lat: number; lon: number } | null {
  if (!input) return null;
  const clean = input.replace(/\s+/g, " ").trim();
  const latMatch = clean.match(LAT_RE);
  if (!latMatch) return null;
  const afterLat = clean.slice(latMatch.index! + latMatch[0].length);
  const lonMatch = afterLat.match(LON_RE);
  if (!lonMatch) return null;

  const lat = toDecimal(
    latMatch[1] ?? latMatch[4],
    latMatch[2],
    latMatch[3],
    true,
  );
  const lon = toDecimal(
    lonMatch[1] ?? lonMatch[4],
    lonMatch[2],
    lonMatch[3],
    false,
  );
  if (lat === null || lon === null) return null;
  return { lat, lon };
}

function toDecimal(
  hemi: string | undefined,
  degStr: string,
  minStr: string,
  isLat: boolean,
): number | null {
  if (!hemi) return null;
  const deg = parseInt(degStr, 10);
  const min = parseFloat(minStr);
  if (!Number.isFinite(deg) || !Number.isFinite(min)) return null;
  if (isLat && (deg > 90 || min >= 60)) return null;
  if (!isLat && (deg > 180 || min >= 60)) return null;
  const sign = /[SW]/i.test(hemi) ? -1 : 1;
  return sign * (deg + min / 60);
}
