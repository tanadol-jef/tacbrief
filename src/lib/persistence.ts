import type { Aircraft, FormationMode } from "../types";
import type { FormationPreset } from "./formations";

const STORAGE_KEY = "tacbrief.scenario.v1";
const FILE_VERSION = 1;

export type Scenario = {
  version: number;
  savedAt: string;
  aircraft: Aircraft[];
  selectedId: number;
  formationMode: FormationMode;
  formationPreset: FormationPreset;
  formationSpacingFt: number;
  formationStaggerFt: number;
};

export function saveLocal(s: Omit<Scenario, "version" | "savedAt">) {
  const payload: Scenario = {
    ...s,
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / disabled — ignore */
  }
}

export function loadLocal(): Scenario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Scenario;
    if (parsed.version !== FILE_VERSION) return null;
    return migrate(parsed);
  } catch {
    return null;
  }
}

// Fill in fields that older saves are missing so the rest of the app can
// safely assume they're always present.
function migrate(s: Scenario): Scenario {
  return {
    ...s,
    aircraft: s.aircraft.map((a) => ({
      ...a,
      trail: Array.isArray(a.trail) ? a.trail : [],
      route: Array.isArray(a.route) ? a.route : [],
      routeIndex: typeof a.routeIndex === "number" ? a.routeIndex : 0,
      steps: Array.isArray(a.steps) ? a.steps : [],
      stepIndex: typeof a.stepIndex === "number" ? a.stepIndex : 0,
      targetHeadingMagDeg:
        typeof a.targetHeadingMagDeg === "number" || a.targetHeadingMagDeg === null
          ? a.targetHeadingMagDeg
          : null,
      locked: typeof a.locked === "boolean" ? a.locked : false,
      visible: typeof a.visible === "boolean" ? a.visible : true,
    })),
  };
}

export function exportScenarioFile(s: Omit<Scenario, "version" | "savedAt">) {
  const payload: Scenario = {
    ...s,
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/T/, "_")
    .slice(0, 16);
  a.href = url;
  a.download = `tacbrief-scenario-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importScenarioFile(file: File): Promise<Scenario | null> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Scenario;
    if (parsed.version !== FILE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}
