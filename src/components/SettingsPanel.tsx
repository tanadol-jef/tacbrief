import { Settings as SettingsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "../store/settingsStore";
import { useDraggablePanel } from "../lib/useDraggablePanel";

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useDraggablePanel("settings");
  const s = useSettings();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Settings"
        className="flex h-8 w-8 items-center justify-center rounded ring-1 ring-tac-border text-slate-300 hover:bg-tac-border/40"
      >
        <SettingsIcon size={14} />
      </button>
      {open && (
        <div
          ref={drag.ref}
          style={drag.style}
          className="absolute right-0 top-10 z-40 w-72 rounded bg-tac-panel/95 p-3 text-xs ring-1 ring-tac-border backdrop-blur"
        >
          <div
            onPointerDown={drag.onPointerDown}
            className={`mb-2 touch-none cursor-move select-none text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${
              drag.dragging ? "text-tac-accent" : ""
            }`}
          >
            Settings
          </div>
          <NumberField
            label="Trail history (seconds)"
            value={s.trailSeconds}
            min={1}
            max={120}
            step={1}
            onChange={(v) => s.set("trailSeconds", v)}
          />
          <NumberField
            label="Trail sample rate (Hz)"
            value={s.trailSampleHz}
            min={1}
            max={30}
            step={1}
            onChange={(v) => s.set("trailSampleHz", v)}
          />
          <NumberField
            label="Snap radius (px)"
            value={s.snapPx}
            min={6}
            max={60}
            step={1}
            onChange={(v) => s.set("snapPx", v)}
          />
          <label className="mt-3 flex items-center gap-2 text-slate-200">
            <input
              type="checkbox"
              checked={s.showTurnCirclesInTurn}
              onChange={(e) => s.set("showTurnCirclesInTurn", e.target.checked)}
              className="accent-tac-accent"
            />
            Keep turn circles visible during turns
          </label>
          <button
            onClick={s.resetAllPanelPositions}
            className="mt-3 w-full rounded bg-tac-border/30 px-2 py-1.5 text-xs text-slate-200 hover:bg-tac-border/60"
          >
            Reset floating windows
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={s.saveCurrentPanelPositionsAsDefault}
              className="rounded bg-tac-accent/20 px-2 py-1.5 text-xs text-tac-accent ring-1 ring-tac-accent/40 hover:bg-tac-accent/30"
            >
              Set current default
            </button>
            <button
              onClick={s.clearDefaultPanelPositions}
              className="rounded bg-tac-border/30 px-2 py-1.5 text-xs text-slate-300 hover:bg-tac-border/60"
            >
              Clear default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-2 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded bg-tac-border accent-tac-accent"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v))
              onChange(Math.min(max, Math.max(min, v)));
          }}
          className="w-16 rounded bg-tac-bg px-1 py-0.5 text-right font-mono text-slate-100 ring-1 ring-tac-border focus:outline-none"
        />
      </div>
    </label>
  );
}
