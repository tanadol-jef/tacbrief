import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { Aircraft, ManeuverStep } from "../../types";
import { useScenario } from "../../store/scenarioStore";

type Props = { a: Aircraft };

const STEP_TYPES: { kind: ManeuverStep["kind"]; label: string }[] = [
  { kind: "turn-to", label: "Turn to heading" },
  { kind: "set-speed", label: "Set speed" },
  { kind: "set-altitude", label: "Set altitude" },
  { kind: "waypoint", label: "Go to waypoint" },
  { kind: "hold", label: "Hold" },
];

function makeStep(kind: ManeuverStep["kind"], a: Aircraft): ManeuverStep {
  switch (kind) {
    case "turn-to":
      return { kind, headingMagDeg: Math.round(a.headingMagDeg), bankDeg: 30 };
    case "set-speed":
      return { kind, speedKt: Math.round(a.speedKt) };
    case "set-altitude":
      return { kind, altFt: Math.round(a.altitudeFt), climbRateFpm: 2000 };
    case "waypoint":
      return { kind, lat: a.position.lat, lon: a.position.lon };
    case "hold":
      return { kind, seconds: 10 };
  }
}

export default function ManeuverEditor({ a }: Props) {
  const { addStep, updateStep, removeStep, moveStep, clearSteps } =
    useScenario();
  return (
    <div className="mt-3 border-t border-tac-border pt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
        <span>
          Sequence ({a.steps.length}){" "}
          {a.steps.length > 0 && (
            <span className="text-tac-accent">
              · running #{a.stepIndex + 1}
            </span>
          )}
        </span>
        {a.steps.length > 0 && (
          <button
            onClick={() => clearSteps(a.id)}
            title="Clear sequence"
            className="text-slate-500 hover:text-tac-danger"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {a.steps.map((step, i) => (
          <StepRow
            key={i}
            step={step}
            index={i}
            running={i === a.stepIndex}
            onUpdate={(s) => updateStep(a.id, i, s)}
            onRemove={() => removeStep(a.id, i)}
            onMove={(dir) => moveStep(a.id, i, dir)}
            isFirst={i === 0}
            isLast={i === a.steps.length - 1}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        <select
          onChange={(e) => {
            const kind = e.target.value as ManeuverStep["kind"];
            if (!kind) return;
            addStep(a.id, makeStep(kind, a));
            e.target.value = "";
          }}
          value=""
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded bg-tac-bg px-1 py-1 text-[11px] text-slate-200 ring-1 ring-tac-border focus:outline-none"
        >
          <option value="" disabled>
            + Add step…
          </option>
          {STEP_TYPES.map((t) => (
            <option key={t.kind} value={t.kind}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StepRow({
  step,
  index,
  running,
  onUpdate,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: {
  step: ManeuverStep;
  index: number;
  running: boolean;
  onUpdate: (s: ManeuverStep) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] ring-1 ${
        running
          ? "bg-tac-accent/10 text-slate-100 ring-tac-accent/50"
          : "bg-tac-bg/40 text-slate-300 ring-tac-border"
      }`}
    >
      <span className="w-5 shrink-0 text-center font-mono text-slate-500">
        {index + 1}
      </span>
      <StepBody step={step} onUpdate={onUpdate} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMove(-1);
        }}
        disabled={isFirst}
        className="shrink-0 text-slate-500 hover:text-slate-200 disabled:opacity-20"
      >
        <ChevronUp size={11} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMove(1);
        }}
        disabled={isLast}
        className="shrink-0 text-slate-500 hover:text-slate-200 disabled:opacity-20"
      >
        <ChevronDown size={11} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 text-slate-500 hover:text-tac-danger"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function StepBody({
  step,
  onUpdate,
}: {
  step: ManeuverStep;
  onUpdate: (s: ManeuverStep) => void;
}) {
  if (step.kind === "turn-to") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <span className="shrink-0 text-slate-400">Turn to</span>
        <NumInput
          value={step.headingMagDeg}
          width={48}
          onChange={(v) => onUpdate({ ...step, headingMagDeg: wrap360(v) })}
        />
        <span className="text-slate-500">°M @</span>
        <NumInput
          value={step.bankDeg ?? 30}
          width={36}
          onChange={(v) => onUpdate({ ...step, bankDeg: clamp(v, 5, 80) })}
        />
        <span className="text-slate-500">° bank</span>
      </div>
    );
  }
  if (step.kind === "set-speed") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <span className="shrink-0 text-slate-400">Speed</span>
        <NumInput
          value={step.speedKt}
          width={52}
          onChange={(v) => onUpdate({ ...step, speedKt: clamp(v, 50, 800) })}
        />
        <span className="text-slate-500">kt</span>
      </div>
    );
  }
  if (step.kind === "set-altitude") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <span className="shrink-0 text-slate-400">Alt</span>
        <NumInput
          value={step.altFt}
          width={64}
          onChange={(v) => onUpdate({ ...step, altFt: clamp(v, 0, 60000) })}
        />
        <span className="text-slate-500">ft @</span>
        <NumInput
          value={step.climbRateFpm ?? 2000}
          width={56}
          onChange={(v) =>
            onUpdate({ ...step, climbRateFpm: clamp(v, 100, 20000) })
          }
        />
        <span className="text-slate-500">fpm</span>
      </div>
    );
  }
  if (step.kind === "waypoint") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1 text-slate-400">
        <span>WP</span>
        <span className="font-mono text-[10px] text-slate-300">
          {step.lat.toFixed(3)}, {step.lon.toFixed(3)}
        </span>
      </div>
    );
  }
  // hold
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <span className="shrink-0 text-slate-400">Hold</span>
      <NumInput
        value={step.seconds}
        width={48}
        onChange={(v) => onUpdate({ ...step, seconds: clamp(v, 1, 3600) })}
      />
      <span className="text-slate-500">sec</span>
    </div>
  );
}

function NumInput({
  value,
  width,
  onChange,
}: {
  value: number;
  width: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
      onClick={(e) => e.stopPropagation()}
      style={{ width }}
      className="rounded bg-tac-bg px-1 py-0.5 text-right font-mono text-slate-100 ring-1 ring-tac-border focus:outline-none focus:ring-tac-accent"
    />
  );
}

function wrap360(deg: number) {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
