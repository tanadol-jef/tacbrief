/*
 * Fetches OurAirports CSV and emits Thailand-only JSON bundles.
 * Run: npm run build:airports
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AIRPORTS_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";
const RUNWAYS_URL =
  "https://davidmegginson.github.io/ourairports-data/runways.csv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "public", "data");

type AirportRow = {
  id: string;
  ident: string;
  type: string;
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  elevation_ft: string;
  iso_country: string;
  iso_region: string;
  municipality: string;
  gps_code: string;
  iata_code: string;
};

type RunwayRow = {
  airport_ident: string;
  length_ft: string;
  width_ft: string;
  surface: string;
  le_ident: string;
  le_latitude_deg: string;
  le_longitude_deg: string;
  le_heading_degT: string;
  le_displaced_threshold_ft: string;
  he_ident: string;
  he_latitude_deg: string;
  he_longitude_deg: string;
  he_heading_degT: string;
  he_displaced_threshold_ft: string;
  closed: string;
};

function parseCSV<T extends Record<string, string>>(text: string): T[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (ch === "\r") {
        /* skip */
      } else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, idx) => (o[h] = r[idx] ?? ""));
    return o as T;
  });
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

async function main() {
  console.log("Fetching OurAirports data…");
  const [airportsCsv, runwaysCsv] = await Promise.all([
    fetchText(AIRPORTS_URL),
    fetchText(RUNWAYS_URL),
  ]);

  const airports = parseCSV<AirportRow>(airportsCsv).filter(
    (a) =>
      a.iso_country === "TH" &&
      a.type !== "closed" &&
      a.type !== "heliport" &&
      a.type !== "seaplane_base",
  );
  const airportIdents = new Set(airports.map((a) => a.ident));
  const runways = parseCSV<RunwayRow>(runwaysCsv).filter(
    (r) => airportIdents.has(r.airport_ident) && r.closed !== "1",
  );

  const airportsOut = airports.map((a) => ({
    icao: a.gps_code || a.ident,
    iata: a.iata_code || null,
    type: a.type, // small_airport | medium_airport | large_airport
    name: a.name,
    municipality: a.municipality || null,
    lat: parseFloat(a.latitude_deg),
    lon: parseFloat(a.longitude_deg),
    elevFt: a.elevation_ft ? parseInt(a.elevation_ft, 10) : null,
  }));

  const runwaysOut = runways.map((r) => ({
    icao:
      airports.find((a) => a.ident === r.airport_ident)?.gps_code ||
      r.airport_ident,
    lengthFt: r.length_ft ? parseInt(r.length_ft, 10) : null,
    widthFt: r.width_ft ? parseInt(r.width_ft, 10) : null,
    surface: r.surface || null,
    le: {
      ident: r.le_ident,
      lat: parseFloat(r.le_latitude_deg),
      lon: parseFloat(r.le_longitude_deg),
      hdgTrue: r.le_heading_degT ? parseFloat(r.le_heading_degT) : null,
    },
    he: {
      ident: r.he_ident,
      lat: parseFloat(r.he_latitude_deg),
      lon: parseFloat(r.he_longitude_deg),
      hdgTrue: r.he_heading_degT ? parseFloat(r.he_heading_degT) : null,
    },
  }));

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(OUT_DIR, "th_airports.json"),
    JSON.stringify(airportsOut, null, 0),
  );
  await fs.writeFile(
    path.join(OUT_DIR, "th_runways.json"),
    JSON.stringify(runwaysOut, null, 0),
  );

  console.log(
    `Wrote ${airportsOut.length} airports and ${runwaysOut.length} runways to ${OUT_DIR}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
