import { useMemo } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import * as turf from "@turf/turf";
import { useTool, resolveAnchor } from "../store/toolStore";
import { useScenario } from "../store/scenarioStore";
import { frameAt, useRecording } from "../store/recordingStore";
import type { AircraftId, Measurement } from "../types";
import { trueToMag } from "../lib/magnetic";

export default function MeasurementPanel() {
  const {
    measurements,
    activeId,
    startMeasurement,
    finishActive,
    setActive,
    rename,
    remove,
    clearAll,
  } = useTool();
  const aircraft = useScenario((s) => s.aircraft);

  const lookup = useMemo(() => {
    const m = new Map<AircraftId, { lat: number; lon: number }>();
    for (const a of aircraft) m.set(a.id, a.position);
    return m;
  }, [aircraft]);

  const imported = useRecording((s) => s.imported);
  const replayMode = useRecording((s) => s.replayMode);
  const replayTime = useRecording((s) => s.replayTime);
  const replayLookup = useMemo(() => {
    const m = new Map<AircraftId, { lat: number; lon: number }>();
    if (!replayMode || !imported) return m;
    const frame = frameAt(imported, replayTime);
    for (const [id, ac] of frame) m.set(id as AircraftId, { lat: ac.lat, lon: ac.lon });
    return m;
  }, [imported, replayMode, replayTime]);

  if (measurements.length === 0) {
    return (
      <div className="absolute bottom-2 right-2 z-30 w-60 rounded bg-tac-panel/95 ring-1 ring-tac-border backdrop-blur">
        <div className="flex items-center justify-between border-b border-tac-border px-2 py-1.5 text-xs uppercase tracking-wider text-slate-400">
          Measurements
        </div>
        <div className="flex flex-col gap-1 p-2">
          <button
            onClick={() => startMeasurement("ruler")}
            className="flex items-center gap-2 rounded bg-tac-border/30 px-2 py-1.5 text-xs text-slate-200 hover:bg-tac-border/60"
          >
            <Plus size={12} /> New ruler
          </button>
          <button
            onClick={() => startMeasurement("protractor")}
            className="flex items-center gap-2 rounded bg-tac-border/30 px-2 py-1.5 text-xs text-slate-200 hover:bg-tac-border/60"
          >
            <Plus size={12} /> New angle
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-2 right-2 z-30 w-72 rounded bg-tac-panel/95 ring-1 ring-tac-border backdrop-blur">
      <div className="flex items-center justify-between border-b border-tac-border px-2 py-1.5 text-xs uppercase tracking-wider text-slate-400">
        <span>Measurements ({measurements.length})</span>
        <button
          onClick={clearAll}
          title="Clear all"
          className="text-slate-500 hover:text-tac-danger"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto p-2">
        {measurements.map((m) => (
          <MeasurementRow
            key={m.id}
            m={m}
            lookup={lookup}
            replayLookup={replayLookup}
            active={m.id === activeId}
            onActivate={() => setActive(m.id)}
            onRename={(name) => rename(m.id, name)}
            onRemove={() => remove(m.id)}
          />
        ))}
      </div>
      <div className="flex gap-1 border-t border-tac-border p-2">
        <button
          onClick={() => startMeasurement("ruler")}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-tac-border/30 px-2 py-1 text-xs text-slate-200 hover:bg-tac-border/60"
        >
          <Plus size={12} /> Ruler
        </button>
        <button
          onClick={() => startMeasurement("protractor")}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-tac-border/30 px-2 py-1 text-xs text-slate-200 hover:bg-tac-border/60"
        >
          <Plus size={12} /> Angle
        </button>
        {activeId && (
          <button
            onClick={finishActive}
            className="rounded bg-tac-accent/30 px-2 py-1 text-xs text-tac-accent ring-1 ring-tac-accent/40 hover:bg-tac-accent/50"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}

function MeasurementRow({
  m,
  lookup,
  replayLookup,
  active,
  onActivate,
  onRename,
  onRemove,
}: {
  m: Measurement;
  lookup: Map<AircraftId, { lat: number; lon: number }>;
  replayLookup: Map<AircraftId, { lat: number; lon: number }>;
  active: boolean;
  onActivate: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const stats = useMemo(
    () => compute(m, lookup, replayLookup),
    [m, lookup, replayLookup],
  );
  const anchorsBadge = m.points
    .map((p) =>
      p.kind === "aircraft"
        ? `✈${p.aircraftId}`
        : p.kind === "replay-aircraft"
          ? `R${p.aircraftId}`
          : "·",
    )
    .join(" ");

  return (
    <div
      className={`rounded border p-2 text-xs transition ${
        active
          ? "border-tac-accent bg-tac-bg/60"
          : "border-tac-border bg-tac-bg/30 hover:border-slate-500"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: m.color }}
        />
        <input
          value={m.name}
          onChange={(e) => onRename(e.target.value)}
          className="flex-1 bg-transparent text-slate-100 focus:outline-none"
        />
        <button
          onClick={onActivate}
          title="Add more points"
          className={`rounded p-1 ${
            active ? "text-tac-accent" : "text-slate-500 hover:text-slate-200"
          }`}
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onRemove}
          title="Delete measurement"
          className="rounded p-1 text-slate-500 hover:text-tac-danger"
        >
          <X size={12} />
        </button>
      </div>
      <div className="mt-1 font-mono text-[10px] leading-tight text-slate-400">
        <div>
          {m.type === "ruler" ? "Ruler" : "Angle"} · {m.points.length} pt
          {anchorsBadge ? ` · ${anchorsBadge}` : ""}
        </div>
        {stats ? (
          <div className="text-tac-accent">{stats}</div>
        ) : (
          <div className="text-slate-600">
            click on map to add{m.type === "protractor" ? " 3" : ""} points
          </div>
        )}
      </div>
    </div>
  );
}

function compute(
  m: Measurement,
  lookup: Map<AircraftId, { lat: number; lon: number }>,
  replayLookup: Map<AircraftId, { lat: number; lon: number }>,
): string | null {
  const pts = m.points
    .map((p) => resolveAnchor(p, lookup, replayLookup))
    .filter((p): p is { lat: number; lon: number } => p !== null);
  if (pts.length < 2) return null;

  if (m.type === "ruler") {
    let total = 0;
    let firstBrg: string | null = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const from: [number, number] = [pts[i].lon, pts[i].lat];
      const to: [number, number] = [pts[i + 1].lon, pts[i + 1].lat];
      const dnm = turf.distance(from, to, { units: "nauticalmiles" });
      total += dnm;
      if (i === 0) {
        const brgT = (turf.bearing(from, to) + 360) % 360;
        const brgM = trueToMag(brgT, pts[i].lat, pts[i].lon);
        firstBrg = `${brgM.toFixed(0).padStart(3, "0")}°M`;
      }
    }
    return `${total.toFixed(2)} nm  ${(total * 1.852).toFixed(2)} km${
      firstBrg ? ` · ${firstBrg}` : ""
    }`;
  }
  if (m.type === "protractor" && pts.length === 3) {
    const [a, b, c] = pts;
    const brg1 = turf.bearing([b.lon, b.lat], [a.lon, a.lat]);
    const brg2 = turf.bearing([b.lon, b.lat], [c.lon, c.lat]);
    let diff = Math.abs(brg1 - brg2);
    if (diff > 180) diff = 360 - diff;
    return `Δ ${diff.toFixed(1)}°`;
  }
  return null;
}
