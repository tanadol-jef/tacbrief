export type AirportType =
  | "large_airport"
  | "medium_airport"
  | "small_airport";

export type Airport = {
  icao: string;
  iata: string | null;
  type: AirportType;
  name: string;
  municipality: string | null;
  lat: number;
  lon: number;
  elevFt: number | null;
};

export type RunwayEnd = {
  ident: string;
  lat: number;
  lon: number;
  hdgTrue: number | null;
};

export type Runway = {
  icao: string;
  lengthFt: number | null;
  widthFt: number | null;
  surface: string | null;
  le: RunwayEnd;
  he: RunwayEnd;
};

let airportsCache: Airport[] | null = null;
let runwaysCache: Runway[] | null = null;

async function loadJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
  return (await r.json()) as T;
}

export async function loadAirports(): Promise<Airport[]> {
  if (!airportsCache) {
    airportsCache = await loadJson<Airport[]>("/data/th_airports.json");
  }
  return airportsCache;
}

export async function loadRunways(): Promise<Runway[]> {
  if (!runwaysCache) {
    runwaysCache = await loadJson<Runway[]>("/data/th_runways.json");
  }
  return runwaysCache;
}

export function midpoint(rw: Runway): { lat: number; lon: number } {
  return {
    lat: (rw.le.lat + rw.he.lat) / 2,
    lon: (rw.le.lon + rw.he.lon) / 2,
  };
}
