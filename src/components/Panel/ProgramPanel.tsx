import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import type {
  Aircraft,
  AircraftId,
  ProgramBlock,
  ProgramEventCondition,
  ProgramExitCondition,
  ProgramHeadingLane,
  ProgramStartCondition,
  PresetId,
} from "../../types";
import {
  bankFromLoadFactor,
  loadFactorFromBank,
} from "../../lib/flightMath";
import { clamp, wrap360 } from "../../lib/units";
import { useScenario } from "../../store/scenarioStore";
import WaypointEditor from "./WaypointEditor";
import Slider from "./Slider";
import { AIRCRAFT_PRESETS } from "../../presets/aircraft";

type ProgramTab = "aircraft" | "route";

export default function ProgramPanel() {
  const [tab, setTab] = useState<ProgramTab>("aircraft");
  const {
    aircraft,
    selectedId,
    select,
    programRuntime,
    programEventLog,
    update,
    setBank,
    setLoadFactor,
    setPreset,
    addProgramBlock,
    updateProgramBlock,
    removeProgramBlock,
    moveProgramBlock,
    clearProgramBlocks,
    clearEventLog,
  } = useScenario();
  const selected = aircraft.find((a) => a.id === selectedId) ?? aircraft[0];

  if (!selected) return null;

  const runtime = programRuntime.aircraft[selected.id];

  return (
    <div className="compact-scrollbar flex flex-1 flex-col overflow-y-auto p-2">
      <div className="mb-2 grid grid-cols-2 rounded bg-tac-bg p-1 text-xs ring-1 ring-tac-border">
        <button
          onClick={() => setTab("aircraft")}
          className={`rounded px-2 py-1 ${
            tab === "aircraft"
              ? "bg-tac-accent/20 text-tac-accent"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Aircraft Program
        </button>
        <button
          onClick={() => setTab("route")}
          className={`rounded px-2 py-1 ${
            tab === "route"
              ? "bg-tac-accent/20 text-tac-accent"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Route
        </button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {aircraft.map((a) => (
          <button
            key={a.id}
            onClick={() => select(a.id)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ring-1 ${
              a.id === selected.id
                ? "bg-tac-panel text-slate-100 ring-tac-accent/60"
                : "bg-tac-bg/60 text-slate-400 ring-tac-border hover:text-slate-200"
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: a.color }}
            />
            {a.callsign}
          </button>
        ))}
      </div>

      {tab === "route" ? (
        <WaypointEditor a={selected} />
      ) : (
        <div className="flex flex-col gap-2">
          <InitialConditionsEditor
            a={selected}
            update={update}
            setBank={setBank}
            setLoadFactor={setLoadFactor}
            setPreset={setPreset}
          />

          <section className="rounded border border-tac-border bg-tac-panel/70 p-2">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
              <span>Timeline Blocks ({selected.programBlocks.length})</span>
              <div className="flex items-center gap-2">
                {selected.programBlocks.length > 0 && (
                  <button
                    onClick={() => clearProgramBlocks(selected.id)}
                    className="text-slate-500 hover:text-tac-danger"
                    title="Clear blocks"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <button
                  onClick={() => addProgramBlock(selected.id)}
                  className="flex items-center gap-1 rounded bg-tac-accent/15 px-2 py-0.5 text-tac-accent ring-1 ring-tac-accent/40 hover:bg-tac-accent/25"
                >
                  <Plus size={12} /> Block
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {selected.programBlocks.map((block, index) => (
                <BlockEditor
                  key={block.id}
                  a={selected}
                  allAircraft={aircraft}
                  block={block}
                  index={index}
                  running={runtime?.activeBlockIndex === index}
                  onUpdate={(patch) =>
                    updateProgramBlock(selected.id, index, patch)
                  }
                  onRemove={() => removeProgramBlock(selected.id, index)}
                  onMove={(dir) => moveProgramBlock(selected.id, index, dir)}
                  isFirst={index === 0}
                  isLast={index === selected.programBlocks.length - 1}
                />
              ))}
              {selected.programBlocks.length === 0 && (
                <div className="rounded bg-tac-bg/60 px-2 py-3 text-center text-[11px] text-slate-500 ring-1 ring-tac-border">
                  No blocks authored.
                </div>
              )}
            </div>
          </section>

          <EventLog events={programEventLog} onClear={clearEventLog} />
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  a,
  allAircraft,
  block,
  index,
  running,
  onUpdate,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: {
  a: Aircraft;
  allAircraft: Aircraft[];
  block: ProgramBlock;
  index: number;
  running: boolean;
  onUpdate: (patch: Partial<ProgramBlock>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const lanes = block.lanes;
  const action = actionKind(block);
  return (
    <div
      className={`rounded p-2 text-[11px] ring-1 ${
        running
          ? "bg-tac-accent/10 ring-tac-accent/50"
          : "bg-tac-bg/50 ring-tac-border"
      }`}
    >
      <div className="mb-2 flex items-center gap-1">
        <span className="w-5 text-center font-mono text-slate-500">
          {index + 1}
        </span>
        <input
          value={block.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="min-w-0 flex-1 rounded bg-tac-bg px-1.5 py-1 text-slate-100 ring-1 ring-tac-border focus:outline-none focus:ring-tac-accent"
        />
        <IconButton onClick={() => onMove(-1)} disabled={isFirst} title="Move up">
          <ChevronUp size={12} />
        </IconButton>
        <IconButton onClick={() => onMove(1)} disabled={isLast} title="Move down">
          <ChevronDown size={12} />
        </IconButton>
        <IconButton onClick={onRemove} title="Remove block" danger>
          <Trash2 size={12} />
        </IconButton>
      </div>

      <ConditionEditor
        label="Start"
        value={block.start}
        aircraft={allAircraft}
        owner={a}
        waypoints={a.route.length}
        onChange={(start) => onUpdate({ start: start as ProgramStartCondition })}
      />

      <div className="mt-2 flex flex-col gap-1 rounded bg-tac-bg/40 p-2 ring-1 ring-tac-border">
        <label className="grid grid-cols-[58px_1fr] items-center gap-1 text-slate-500">
          <span className="text-[10px] uppercase tracking-wider">Action</span>
          <select
            value={action}
            onChange={(e) =>
              onUpdate({
                lanes: makeActionLanes(e.target.value as ActionKind, a, block),
                exit:
                  block.exit.kind === "headingCaptured"
                    ? { kind: "actionComplete" }
                    : block.exit,
              })
            }
            className="min-w-0 rounded bg-tac-bg px-1 py-0.5 text-slate-200 ring-1 ring-tac-border"
          >
            <option value="turn-heading">Turn to heading</option>
            <option value="turn-aircraft-heading">Turn to aircraft heading</option>
            <option value="turn-waypoint">Turn to waypoint</option>
            <option value="set-parameter">Set parameter</option>
            <option value="climb">Climb</option>
          </select>
        </label>

        {(action === "turn-heading" ||
          action === "turn-waypoint" ||
          action === "turn-aircraft-heading") && (
          <TurnActionEditor
            a={a}
            allAircraft={allAircraft}
            heading={lanes.heading}
            mode={
              action === "turn-heading"
                ? "heading"
                : action === "turn-aircraft-heading"
                  ? "aircraftHeading"
                  : "waypoint"
            }
            onChange={(heading) =>
              onUpdate({ lanes: { heading, speed: undefined, altitude: undefined, hold: undefined } })
            }
          />
        )}

        {action === "set-parameter" && (
          <SetParameterActionEditor
            speedKt={lanes.speed?.targetSpeedKt ?? Math.round(a.speedKt)}
            altitudeFt={lanes.altitude?.targetAltFt ?? Math.round(a.altitudeFt)}
            speedEnabled={lanes.speed?.enabled ?? true}
            altitudeEnabled={lanes.altitude?.enabled ?? false}
            onChange={(next) =>
              onUpdate({
                lanes: {
                  heading: undefined,
                  speed: next.speedEnabled
                    ? { enabled: true, targetSpeedKt: next.speedKt }
                    : undefined,
                  altitude: next.altitudeEnabled
                    ? {
                        enabled: true,
                        mode: "set",
                        targetAltFt: next.altitudeFt,
                        climbRateFpm: 2000,
                      }
                    : undefined,
                  hold: undefined,
                },
              })
            }
          />
        )}

        {action === "climb" && (
          <ClimbActionEditor
            altitudeFt={lanes.altitude?.targetAltFt ?? Math.round(a.altitudeFt)}
            rateFpm={lanes.altitude?.climbRateFpm ?? 2000}
            onChange={(altitudeFt, rateFpm) =>
              onUpdate({
                lanes: {
                  heading: undefined,
                  speed: undefined,
                  altitude: {
                    enabled: true,
                    mode: "climb",
                    targetAltFt: altitudeFt,
                    climbRateFpm: rateFpm,
                  },
                  hold: undefined,
                },
              })
            }
          />
        )}
      </div>
      <div className="mt-2">
        <ConditionEditor
          label="Exit"
          value={block.exit}
          aircraft={allAircraft}
          owner={a}
          waypoints={a.route.length}
          onChange={(exit) => onUpdate({ exit: exit as ProgramBlock["exit"] })}
        />
      </div>
    </div>
  );
}

function InitialConditionsEditor({
  a,
  update,
  setBank,
  setLoadFactor,
  setPreset,
}: {
  a: Aircraft;
  update: (id: AircraftId, patch: Partial<Aircraft>) => void;
  setBank: (id: AircraftId, bankDeg: number) => void;
  setLoadFactor: (id: AircraftId, g: number) => void;
  setPreset: (id: AircraftId, preset: PresetId) => void;
}) {
  const preset = AIRCRAFT_PRESETS[a.preset];
  const overSpeed = a.speedKt > preset.vneKt;
  const overG = a.loadFactorG > preset.maxG + 0.05;

  return (
    <section className="rounded border border-tac-border bg-tac-panel/70 p-2">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
        <span>Initial Conditions</span>
        <span className="text-[9px] text-slate-500">linked to Aircraft tab</span>
      </div>
      <div className="mb-2 grid grid-cols-[1fr_92px] gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-[10px] uppercase tracking-wider text-slate-500">
          Callsign
          <input
            value={a.callsign}
            onChange={(e) => update(a.id, { callsign: e.target.value })}
            className="min-w-0 rounded bg-tac-bg px-2 py-1 text-xs normal-case tracking-normal text-slate-100 ring-1 ring-tac-border focus:outline-none focus:ring-tac-accent"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[10px] uppercase tracking-wider text-slate-500">
          Preset
          <select
            value={a.preset}
            onChange={(e) => setPreset(a.id, e.target.value as PresetId)}
            className="min-w-0 rounded bg-tac-bg px-1 py-1 text-xs normal-case tracking-normal text-slate-200 ring-1 ring-tac-border focus:outline-none focus:ring-tac-accent"
          >
            {Object.values(AIRCRAFT_PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
          onChange={(v) => update(a.id, { altitudeFt: clamp(v, 0, 50000) })}
          min={0}
          max={50000}
          step={500}
          format={(v) => v.toLocaleString()}
        />
        <Slider
          label="Heading"
          suffix="M"
          value={a.headingMagDeg}
          onChange={(v) => update(a.id, { headingMagDeg: wrap360(v) })}
          min={0}
          max={360}
          step={1}
          format={(v) => v.toFixed(0).padStart(3, "0")}
        />
        <Slider
          label="Bank"
          suffix=" deg"
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
          onChange={(v) => setLoadFactor(a.id, clamp(v, 1, preset.maxG + 1))}
          min={1}
          max={preset.maxG + 1}
          step={0.1}
          format={(v) => v.toFixed(1)}
          active={a.activeControl === "g"}
          warn={overG}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-tac-border pt-2">
        <NumberField
          label="Lat"
          value={a.position.lat}
          precision={5}
          onChange={(lat) => update(a.id, { position: { ...a.position, lat } })}
        />
        <NumberField
          label="Lon"
          value={a.position.lon}
          precision={5}
          onChange={(lon) => update(a.id, { position: { ...a.position, lon } })}
        />
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  precision,
  onChange,
}: {
  label: string;
  value: number;
  precision: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(value.toFixed(precision));

  useEffect(() => {
    setText(value.toFixed(precision));
  }, [precision, value]);

  const commit = () => {
    const n = parseFloat(text);
    if (Number.isFinite(n)) onChange(n);
    else setText(value.toFixed(precision));
  };

  return (
    <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
      <span className="w-7">{label}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setText(value.toFixed(precision));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="min-w-0 flex-1 rounded bg-tac-bg px-1 py-0.5 text-right font-mono text-[11px] normal-case tracking-normal text-slate-100 ring-1 ring-tac-border focus:outline-none focus:ring-tac-accent"
      />
    </label>
  );
}

type ActionKind =
  | "turn-heading"
  | "turn-aircraft-heading"
  | "turn-waypoint"
  | "set-parameter"
  | "climb";

function actionKind(block: ProgramBlock): ActionKind {
  if (block.lanes.heading?.mode === "waypoint") return "turn-waypoint";
  if (block.lanes.heading?.mode === "aircraftHeading") {
    return "turn-aircraft-heading";
  }
  if (block.lanes.heading?.mode === "heading") return "turn-heading";
  if (block.lanes.altitude?.enabled && block.lanes.altitude.mode === "climb") {
    return "climb";
  }
  return "set-parameter";
}

function makeActionLanes(
  action: ActionKind,
  a: Aircraft,
  block: ProgramBlock,
): ProgramBlock["lanes"] {
  if (action === "turn-waypoint") {
    return {
      heading: makeHeadingLane("waypoint", a, block.lanes.heading),
    };
  }
  if (action === "turn-heading") {
    return {
      heading: makeHeadingLane("heading", a, block.lanes.heading),
    };
  }
  if (action === "turn-aircraft-heading") {
    return {
      heading: makeHeadingLane("aircraftHeading", a, block.lanes.heading),
    };
  }
  if (action === "climb") {
    return {
      altitude: {
        enabled: true,
        mode: "climb",
        targetAltFt:
          block.lanes.altitude?.targetAltFt ?? Math.round(a.altitudeFt + 5000),
        climbRateFpm: block.lanes.altitude?.climbRateFpm ?? 2000,
      },
    };
  }
  return {
    speed: {
      enabled: true,
      targetSpeedKt: block.lanes.speed?.targetSpeedKt ?? Math.round(a.speedKt),
    },
    altitude: block.lanes.altitude?.enabled
      ? {
          enabled: true,
          mode: "set",
          targetAltFt: block.lanes.altitude.targetAltFt,
          climbRateFpm: 2000,
        }
      : undefined,
  };
}

function TurnActionEditor({
  a,
  allAircraft,
  heading,
  mode,
  onChange,
}: {
  a: Aircraft;
  allAircraft: Aircraft[];
  heading: ProgramHeadingLane | undefined;
  mode: "heading" | "waypoint" | "aircraftHeading";
  onChange: (heading: ProgramHeadingLane) => void;
}) {
  const lane = makeHeadingLane(mode, a, heading)!;
  const control = lane.turnControl ?? "g";
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[58px_1fr] items-center gap-1">
        <span className="text-slate-500">To</span>
        {mode === "heading" ? (
          <div className="flex items-center gap-1">
            <NumInput
              value={
                lane.mode === "heading"
                  ? lane.targetHeadingMagDeg
                  : Math.round(a.headingMagDeg)
              }
              width={58}
              onChange={(v) =>
                onChange({
                  ...lane,
                  mode: "heading",
                  targetHeadingMagDeg: wrap360(v),
                })
              }
            />
            <span className="text-slate-500">M</span>
          </div>
        ) : mode === "aircraftHeading" ? (
          <div className="flex items-center gap-1">
            <AircraftSelect
              aircraft={allAircraft}
              value={lane.mode === "aircraftHeading" ? lane.referenceAircraftId : a.id}
              onChange={(id) =>
                onChange({
                  ...lane,
                  mode: "aircraftHeading",
                  referenceAircraftId: id,
                })
              }
            />
            <span className="text-slate-500">at start</span>
          </div>
        ) : (
          <select
            value={lane.mode === "waypoint" ? lane.waypointIndex : 0}
            onChange={(e) =>
              onChange({
                ...lane,
                mode: "waypoint",
                waypointIndex: parseInt(e.target.value, 10),
              })
            }
            className="min-w-0 rounded bg-tac-bg px-1 py-0.5 text-slate-200 ring-1 ring-tac-border"
          >
            {a.route.map((_, i) => (
              <option key={i} value={i}>
                WP {i + 1}
              </option>
            ))}
            {a.route.length === 0 && <option value={0}>No waypoint</option>}
          </select>
        )}
      </div>
      <div className="grid grid-cols-[58px_1fr] items-center gap-1">
        <span className="text-slate-500">Cond</span>
        <div className="flex items-center gap-1">
          <select
            value={control}
            onChange={(e) => {
              const nextControl = e.target.value as "g" | "bank";
              onChange({
                ...lane,
                turnControl: nextControl,
                bankDeg:
                  lane.bankDeg ??
                  Math.round(bankFromLoadFactor(lane.loadFactorG)),
                loadFactorG:
                  lane.loadFactorG ??
                  Number(loadFactorFromBank(lane.bankDeg ?? 30).toFixed(1)),
              });
            }}
            className="rounded bg-tac-bg px-1 py-0.5 text-slate-200 ring-1 ring-tac-border"
          >
            <option value="g">G</option>
            <option value="bank">Bank</option>
          </select>
          {control === "bank" ? (
            <>
              <NumInput
                value={lane.bankDeg ?? Math.round(bankFromLoadFactor(lane.loadFactorG))}
                width={50}
                onChange={(v) =>
                  onChange({
                    ...lane,
                    turnControl: "bank",
                    bankDeg: clamp(v, 1, 80),
                    loadFactorG: Number(loadFactorFromBank(clamp(v, 1, 80)).toFixed(1)),
                  })
                }
              />
              <span className="text-slate-500">deg</span>
            </>
          ) : (
            <>
              <NumInput
                value={lane.loadFactorG}
                width={50}
                step={0.1}
                onChange={(v) =>
                  onChange({
                    ...lane,
                    turnControl: "g",
                    loadFactorG: clamp(v, 1, 9.5),
                    bankDeg: Math.round(bankFromLoadFactor(clamp(v, 1, 9.5))),
                  })
                }
              />
              <span className="text-slate-500">G</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SetParameterActionEditor({
  speedKt,
  altitudeFt,
  speedEnabled,
  altitudeEnabled,
  onChange,
}: {
  speedKt: number;
  altitudeFt: number;
  speedEnabled: boolean;
  altitudeEnabled: boolean;
  onChange: (next: {
    speedKt: number;
    altitudeFt: number;
    speedEnabled: boolean;
    altitudeEnabled: boolean;
  }) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="grid grid-cols-[58px_1fr] items-center gap-1">
        <span className="flex items-center gap-1 text-slate-500">
          <input
            type="checkbox"
            checked={speedEnabled}
            onChange={(e) =>
              onChange({ speedKt, altitudeFt, speedEnabled: e.target.checked, altitudeEnabled })
            }
            className="h-4 w-4 accent-tac-accent"
          />
          Speed
        </span>
        <div className="flex items-center gap-1">
          <NumInput
            value={speedKt}
            width={64}
            onChange={(v) =>
              onChange({ speedKt: clamp(v, 50, 900), altitudeFt, speedEnabled: true, altitudeEnabled })
            }
          />
          <span className="text-slate-500">kt</span>
        </div>
      </label>
      <label className="grid grid-cols-[58px_1fr] items-center gap-1">
        <span className="flex items-center gap-1 text-slate-500">
          <input
            type="checkbox"
            checked={altitudeEnabled}
            onChange={(e) =>
              onChange({ speedKt, altitudeFt, speedEnabled, altitudeEnabled: e.target.checked })
            }
            className="h-4 w-4 accent-tac-accent"
          />
          Alt
        </span>
        <div className="flex items-center gap-1">
          <NumInput
            value={altitudeFt}
            width={72}
            onChange={(v) =>
              onChange({ speedKt, altitudeFt: clamp(v, 0, 60000), speedEnabled, altitudeEnabled: true })
            }
          />
          <span className="text-slate-500">ft</span>
        </div>
      </label>
    </div>
  );
}

function ClimbActionEditor({
  altitudeFt,
  rateFpm,
  onChange,
}: {
  altitudeFt: number;
  rateFpm: number;
  onChange: (altitudeFt: number, rateFpm: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[58px_1fr] items-center gap-1">
        <span className="text-slate-500">To</span>
        <div className="flex items-center gap-1">
          <NumInput
            value={altitudeFt}
            width={72}
            onChange={(v) => onChange(clamp(v, 0, 60000), rateFpm)}
          />
          <span className="text-slate-500">ft</span>
        </div>
      </div>
      <div className="grid grid-cols-[58px_1fr] items-center gap-1">
        <span className="text-slate-500">Rate</span>
        <div className="flex items-center gap-1">
          <NumInput
            value={rateFpm}
            width={72}
            onChange={(v) => onChange(altitudeFt, clamp(v, 100, 20000))}
          />
          <span className="text-slate-500">fpm</span>
        </div>
      </div>
    </div>
  );
}

function ConditionEditor({
  label,
  value,
  aircraft,
  owner,
  waypoints = 0,
  onChange,
}: {
  label: string;
  value: ProgramStartCondition | ProgramExitCondition;
  aircraft: Aircraft[];
  owner: Aircraft;
  waypoints?: number;
  onChange: (value: ProgramStartCondition | ProgramExitCondition) => void;
}) {
  const isStart = label === "Start";
  const selectValue = conditionSelectValue(value, isStart);
  return (
    <label className="flex min-w-0 flex-col gap-1 rounded bg-tac-bg/35 p-2 text-slate-500 ring-1 ring-tac-border">
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
      <select
        value={selectValue}
        onChange={(e) => {
          const kind = e.target.value;
          if (isStart) {
            onChange(
              kind === "afterSeconds"
                ? { kind, seconds: 0 }
                : isEventConditionKind(kind)
                  ? defaultEventCondition(kind, owner, aircraft)
                  : { kind: "immediate" },
            );
          } else {
            onChange(
              kind === "actionComplete"
                ? { kind }
                : kind === "afterSeconds"
                ? { kind, seconds: 5 }
                : isEventConditionKind(kind)
                  ? defaultEventCondition(kind, owner, aircraft)
                    : { kind: "actionComplete" },
            );
          }
        }}
        className="min-w-0 rounded bg-tac-bg px-1 py-0.5 text-slate-200 ring-1 ring-tac-border"
      >
        {isStart && <option value="immediate">immediate</option>}
        <option value="afterSeconds">after seconds</option>
        {!isStart && <option value="actionComplete">action complete</option>}
        <option value="headingCross">heading cross</option>
        <option value="blockComplete">block complete</option>
        <option value="waypointCaptured">waypoint captured</option>
        <option value="vectorPass">vector pass</option>
      </select>
      {value.kind === "afterSeconds" && (
        <NumInput
          value={value.seconds}
          width={70}
          onChange={(seconds) =>
            onChange({ ...value, seconds: clamp(seconds, 0, 3600) } as typeof value)
          }
        />
      )}
      {isEventCondition(value) && (
        <EventConditionEditor
          value={value}
          aircraft={aircraft}
          owner={owner}
          onChange={(condition) => onChange(condition)}
        />
      )}
      <span className="hidden">{waypoints}</span>
    </label>
  );
}

function conditionSelectValue(
  value: ProgramStartCondition | ProgramExitCondition,
  isStart: boolean,
) {
  if (!isStart && value.kind === "headingCaptured") return "actionComplete";
  if (value.kind === "triggerFired") {
    return isStart ? "immediate" : "actionComplete";
  }
  return value.kind;
}

function isEventConditionKind(kind: string): kind is ProgramEventCondition["kind"] {
  return (
    kind === "headingCross" ||
    kind === "blockComplete" ||
    kind === "waypointCaptured" ||
    kind === "vectorPass"
  );
}

function isEventCondition(
  value: ProgramStartCondition | ProgramExitCondition,
): value is ProgramEventCondition {
  return isEventConditionKind(value.kind);
}

function defaultEventCondition(
  kind: ProgramEventCondition["kind"],
  owner: Aircraft,
  aircraft: Aircraft[],
): ProgramEventCondition {
  const sourceAircraftId = owner.id;
  if (kind === "headingCross") {
    return {
      kind,
      sourceAircraftId,
      headingMagDeg: Math.round(owner.headingMagDeg),
      toleranceDeg: 2,
    };
  }
  if (kind === "blockComplete") {
    return {
      kind,
      sourceAircraftId,
      blockId: owner.programBlocks[0]?.id ?? "",
      toleranceDeg: 2,
    };
  }
  if (kind === "waypointCaptured") {
    return {
      kind,
      sourceAircraftId,
      waypointIndex: 0,
      toleranceDeg: 2,
    };
  }
  return {
    kind,
    sourceAircraftId,
    referenceAircraftId: aircraft.find((a) => a.id !== owner.id)?.id ?? owner.id,
    toleranceDeg: 2,
  };
}

function EventConditionEditor({
  value,
  aircraft,
  owner,
  onChange,
}: {
  value: ProgramEventCondition;
  aircraft: Aircraft[];
  owner: Aircraft;
  onChange: (value: ProgramEventCondition) => void;
}) {
  const sourceId = value.sourceAircraftId ?? owner.id;
  const source = aircraft.find((a) => a.id === sourceId) ?? owner;

  const updateSource = (sourceAircraftId: AircraftId) => {
    if (value.kind === "blockComplete") {
      const sourceAircraft =
        aircraft.find((a) => a.id === sourceAircraftId) ?? owner;
      onChange({
        ...value,
        sourceAircraftId,
        blockId: sourceAircraft.programBlocks[0]?.id ?? "",
      });
      return;
    }
    onChange({ ...value, sourceAircraftId } as ProgramEventCondition);
  };

  return (
    <div className="flex flex-col gap-1 rounded bg-tac-bg/40 p-1.5 ring-1 ring-tac-border">
      <div className="flex items-center gap-1">
        <AircraftSelect aircraft={aircraft} value={sourceId} onChange={updateSource} />
        {value.kind === "headingCross" && (
          <>
            <span>crosses</span>
            <NumInput
              value={value.headingMagDeg}
              width={52}
              onChange={(headingMagDeg) =>
                onChange({ ...value, headingMagDeg: wrap360(headingMagDeg) })
              }
            />
            <span>M</span>
          </>
        )}
        {value.kind === "blockComplete" && (
          <>
            <span>completes</span>
            <select
              value={value.blockId}
              onChange={(e) => onChange({ ...value, blockId: e.target.value })}
              className="min-w-0 flex-1 rounded bg-tac-bg px-1 py-0.5 text-slate-200 ring-1 ring-tac-border"
            >
              {source.programBlocks.map((block, i) => (
                <option key={block.id} value={block.id}>
                  {i + 1}. {block.label}
                </option>
              ))}
              {source.programBlocks.length === 0 && (
                <option value="">No blocks</option>
              )}
            </select>
          </>
        )}
        {value.kind === "waypointCaptured" && (
          <>
            <span>captures</span>
            <select
              value={value.waypointIndex}
              onChange={(e) =>
                onChange({
                  ...value,
                  waypointIndex: parseInt(e.target.value, 10),
                })
              }
              className="min-w-0 flex-1 rounded bg-tac-bg px-1 py-0.5 text-slate-200 ring-1 ring-tac-border"
            >
              {source.route.map((_, i) => (
                <option key={i} value={i}>
                  WP {i + 1}
                </option>
              ))}
              {source.route.length === 0 && <option value={0}>No waypoint</option>}
            </select>
          </>
        )}
        {value.kind === "vectorPass" && (
          <>
            <span>passes vector to</span>
            <AircraftSelect
              aircraft={aircraft}
              value={value.referenceAircraftId}
              onChange={(referenceAircraftId) =>
                onChange({ ...value, referenceAircraftId })
              }
            />
          </>
        )}
      </div>
      {(value.kind === "headingCross" || value.kind === "vectorPass") && (
        <label className="flex items-center gap-1 text-slate-500">
          tol
          <NumInput
            value={value.toleranceDeg}
            width={42}
            onChange={(toleranceDeg) =>
              onChange({ ...value, toleranceDeg: clamp(toleranceDeg, 0.1, 45) })
            }
          />
          deg
        </label>
      )}
    </div>
  );
}

function EventLog({
  events,
  onClear,
}: {
  events: ReturnType<typeof useScenario.getState>["programEventLog"];
  onClear: () => void;
}) {
  return (
    <section className="rounded border border-tac-border bg-tac-panel/70 p-2">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
        <span>Event Log</span>
        {events.length > 0 && (
          <button onClick={onClear} className="text-slate-500 hover:text-tac-danger">
            clear
          </button>
        )}
      </div>
      <div className="compact-scrollbar flex max-h-44 flex-col gap-1 overflow-y-auto">
        {events
          .slice()
          .reverse()
          .map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[42px_42px_1fr] gap-1 rounded bg-tac-bg/50 px-1.5 py-1 font-mono text-[10px] text-slate-400 ring-1 ring-tac-border"
            >
              <span>{event.time.toFixed(1)}</span>
              <span>{event.callsign ?? "--"}</span>
              <span className="truncate text-slate-300">{event.detail}</span>
            </div>
          ))}
        {events.length === 0 && (
          <div className="rounded bg-tac-bg/60 px-2 py-2 text-center text-[11px] text-slate-500 ring-1 ring-tac-border">
            No events this run.
          </div>
        )}
      </div>
    </section>
  );
}

function NumInput({
  value,
  width,
  step = 1,
  onChange,
}: {
  value: number;
  width: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      step={step}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      style={{ width }}
      className="rounded bg-tac-bg px-1 py-0.5 text-right font-mono text-slate-100 ring-1 ring-tac-border focus:outline-none focus:ring-tac-accent"
    />
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded p-1 disabled:opacity-20 ${
        danger
          ? "text-slate-500 hover:text-tac-danger"
          : "text-slate-500 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function AircraftSelect({
  aircraft,
  value,
  onChange,
}: {
  aircraft: Aircraft[];
  value: AircraftId;
  onChange: (id: AircraftId) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) as AircraftId)}
      className="rounded bg-tac-bg px-1 py-0.5 text-slate-200 ring-1 ring-tac-border"
    >
      {aircraft.map((a) => (
        <option key={a.id} value={a.id}>
          {a.callsign}
        </option>
      ))}
    </select>
  );
}

function makeHeadingLane(
  mode: string,
  a: Aircraft,
  prior: ProgramHeadingLane | undefined,
): ProgramHeadingLane | undefined {
  if (mode === "off") return undefined;
  const loadFactorG = prior?.loadFactorG ?? 4;
  if (mode === "waypoint") {
    return {
      enabled: true,
      mode: "waypoint",
      waypointIndex: prior?.mode === "waypoint" ? prior.waypointIndex : 0,
      loadFactorG,
      turnControl: prior?.turnControl ?? "g",
      bankDeg: prior?.bankDeg ?? Math.round(bankFromLoadFactor(loadFactorG)),
    };
  }
  if (mode === "aircraftHeading") {
    return {
      enabled: true,
      mode: "aircraftHeading",
      referenceAircraftId:
        prior?.mode === "aircraftHeading" ? prior.referenceAircraftId : a.id,
      loadFactorG,
      turnControl: prior?.turnControl ?? "g",
      bankDeg: prior?.bankDeg ?? Math.round(bankFromLoadFactor(loadFactorG)),
    };
  }
  return {
    enabled: true,
    mode: "heading",
    targetHeadingMagDeg:
      prior?.mode === "heading"
        ? prior.targetHeadingMagDeg
        : Math.round(a.headingMagDeg),
    loadFactorG,
    turnControl: prior?.turnControl ?? "g",
    bankDeg: prior?.bankDeg ?? Math.round(bankFromLoadFactor(loadFactorG)),
  };
}
