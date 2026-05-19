import { Lock, LockOpen } from "lucide-react";
import type { Aircraft, PresetId } from "../../types";
import { AIRCRAFT_PRESETS } from "../../presets/aircraft";
import { summarizeTurn } from "../../lib/flightMath";
import { useScenario } from "../../store/scenarioStore";
import { clamp, wrap360 } from "../../lib/units";
import Slider from "./Slider";

const PRESET_LIST = Object.values(AIRCRAFT_PRESETS);

export default function AircraftCard({ a }: { a: Aircraft }) {
  const {
    update,
    setBank,
    setLoadFactor,
    setPreset,
    setTargetHeading,
    select,
    removeAircraft,
    selectedId,
    toggleLock,
    formationMode,
  } = useScenario();
  const isLead = a.id === 1;
  const linked = formationMode === "linked";
  const linkedFollower = linked && !isLead && !a.locked;
  const preset = AIRCRAFT_PRESETS[a.preset];
  const selected = a.id === selectedId;

  const t = summarizeTurn(a.speedKt, a.altitudeFt, a.bankDeg);
  const overSpeed = a.speedKt > preset.vneKt;
  const overG = a.loadFactorG > preset.maxG + 0.05;

  return (
    <div
      onClick={() => select(a.id)}
      className={`cursor-pointer rounded-md border p-3 transition ${
        selected
          ? "border-tac-accent bg-tac-panel"
          : "border-tac-border bg-tac-panel/70 hover:bg-tac-panel"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ background: a.color }}
        />
        <input
          value={a.callsign}
          onChange={(e) => update(a.id, { callsign: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-16 min-w-0 bg-transparent text-sm font-semibold text-slate-100 focus:outline-none"
        />
        <select
          value={a.preset}
          onChange={(e) => setPreset(a.id, e.target.value as PresetId)}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded bg-tac-bg px-1 py-0.5 text-xs text-slate-200 ring-1 ring-tac-border focus:outline-none"
        >
          {PRESET_LIST.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>
        {linked && !isLead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLock(a.id);
            }}
            title={a.locked ? "Linked → break link" : "Break formation link"}
            className={`shrink-0 rounded p-1 ${
              a.locked
                ? "text-tac-warn hover:text-tac-danger"
                : "text-slate-500 hover:text-slate-200"
            }`}
          >
            {a.locked ? <LockOpen size={12} /> : <Lock size={12} />}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeAircraft(a.id);
          }}
          className="shrink-0 rounded px-1.5 text-slate-500 hover:text-tac-danger"
          title="Remove aircraft"
        >
          ✕
        </button>
      </div>

      <div
        className={`mt-3 grid grid-cols-2 gap-3 ${
          linkedFollower ? "opacity-60" : ""
        }`}
      >
        <Slider
          label="Speed"
          suffix=" kt"
          value={a.speedKt}
          onChange={(v) =>
            update(a.id, { speedKt: clamp(v, 100, preset.vneKt + 50) })
          }
          min={100}
          max={preset.vneKt + 50}
          step={5}
          warn={overSpeed}
        />
        <Slider
          label="Altitude"
          suffix=" ft"
          value={a.altitudeFt}
          onChange={(v) =>
            update(a.id, { altitudeFt: clamp(v, 0, 50000) })
          }
          min={0}
          max={50000}
          step={500}
          format={(v) => v.toLocaleString()}
        />
        <Slider
          label="Heading"
          suffix="°M"
          value={a.headingMagDeg}
          onChange={(v) => update(a.id, { headingMagDeg: wrap360(v) })}
          min={0}
          max={360}
          step={1}
          format={(v) => v.toFixed(0).padStart(3, "0")}
        />
        <div />
        <Slider
          label="Bank"
          suffix="°"
          value={a.bankDeg}
          onChange={(v) => setBank(a.id, v)}
          min={-80}
          max={80}
          step={1}
          active={a.activeControl === "bank"}
        />
        <Slider
          label="Load"
          suffix=" G"
          value={a.loadFactorG}
          onChange={(v) =>
            setLoadFactor(a.id, clamp(v, 1, preset.maxG + 1))
          }
          min={1}
          max={preset.maxG + 1}
          step={0.1}
          format={(v) => v.toFixed(1)}
          active={a.activeControl === "g"}
          warn={overG}
        />
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span className="text-slate-400">Roll out at</span>
        <input
          type="number"
          value={a.targetHeadingMagDeg ?? ""}
          placeholder="—"
          min={0}
          max={360}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              setTargetHeading(a.id, null);
            } else {
              const n = parseInt(v, 10);
              if (Number.isFinite(n)) setTargetHeading(a.id, wrap360(n));
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className={`w-16 rounded bg-tac-bg px-1 py-0.5 text-right font-mono ring-1 focus:outline-none ${
            a.targetHeadingMagDeg != null
              ? "text-tac-accent ring-tac-accent/60"
              : "text-slate-200 ring-tac-border"
          }`}
        />
        <span className="text-slate-500">°M</span>
        {a.targetHeadingMagDeg != null && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTargetHeading(a.id, null);
            }}
            className="text-slate-500 hover:text-tac-danger"
            title="Clear rollout target"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-tac-border pt-2 font-mono text-[11px] text-slate-400">
        <Stat label="TAS" value={`${t.tasKt.toFixed(0)} kt`} />
        <Stat
          label="Turn R"
          value={
            Number.isFinite(t.radiusNm)
              ? `${t.radiusNm.toFixed(2)} nm`
              : "∞"
          }
        />
        <Stat
          label="ω"
          value={`${t.rateDegSec.toFixed(1)}°/s`}
        />
        <Stat
          label="R (ft)"
          value={
            Number.isFinite(t.radiusFt)
              ? `${Math.round(t.radiusFt).toLocaleString()} ft`
              : "∞"
          }
        />
        <Stat label="Vne" value={`${preset.vneKt} kt`} />
        <Stat label="Max G" value={`${preset.maxG}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
