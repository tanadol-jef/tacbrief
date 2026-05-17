import type { AircraftPreset, PresetId } from "../types";

export const AIRCRAFT_PRESETS: Record<PresetId, AircraftPreset> = {
  "F-16A": {
    id: "F-16A",
    label: "F-16A/B ADF",
    vneKt: 700,
    cornerKt: 440,
    maxG: 9.0,
    cruiseKt: 350,
    cruiseAltFt: 25000,
  },
  "Gripen-C": {
    id: "Gripen-C",
    label: "Gripen C/D",
    vneKt: 700,
    cornerKt: 430,
    maxG: 9.0,
    cruiseKt: 350,
    cruiseAltFt: 30000,
  },
  "T-50TH": {
    id: "T-50TH",
    label: "T-50TH Golden Eagle",
    vneKt: 600,
    cornerKt: 400,
    maxG: 8.0,
    cruiseKt: 320,
    cruiseAltFt: 25000,
  },
  "F-5E": {
    id: "F-5E",
    label: "F-5E/F Tiger II",
    vneKt: 600,
    cornerKt: 410,
    maxG: 7.3,
    cruiseKt: 300,
    cruiseAltFt: 20000,
  },
  "L-39": {
    id: "L-39",
    label: "L-39 Albatros",
    vneKt: 380,
    cornerKt: 250,
    maxG: 6.0,
    cruiseKt: 220,
    cruiseAltFt: 15000,
  },
  Custom: {
    id: "Custom",
    label: "Custom",
    vneKt: 600,
    cornerKt: 400,
    maxG: 7,
    cruiseKt: 300,
    cruiseAltFt: 20000,
  },
};

export const AIRCRAFT_COLORS = [
  "#34d399", // emerald
  "#60a5fa", // blue
  "#f472b6", // pink
  "#fbbf24", // amber
];
