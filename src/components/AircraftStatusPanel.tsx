import { Minus } from "lucide-react";
import { useDraggablePanel } from "../lib/useDraggablePanel";
import { useScenario } from "../store/scenarioStore";
import { useSettings } from "../store/settingsStore";
import type { Aircraft } from "../types";

export default function AircraftStatusPanel() {
  const aircraft = useScenario((s) => s.aircraft);
  const selectedId = useScenario((s) => s.selectedId);
  const select = useScenario((s) => s.select);
  const simTime = useScenario((s) => s.simTime);
  const runtime = useScenario((s) => s.programRuntime);
  const minimized = useSettings((s) => s.minimizedPanels.aircraftStatus);
  const setPanelMinimized = useSettings((s) => s.setPanelMinimized);
  const drag = useDraggablePanel("aircraftStatus", { bounds: "offsetParent" });

  const visible = aircraft.filter((a) => a.visible);
  if (minimized || visible.length === 0) return null;

  return (
    <div
      ref={drag.ref}
      onPointerDown={drag.onPointerDown}
      style={drag.style}
      className={`absolute right-2 top-2 z-30 w-[31rem] max-w-[calc(100vw-1rem)] touch-none cursor-move select-none rounded bg-tac-panel/85 px-1.5 py-1 font-mono text-sm text-slate-300 shadow-xl ring-1 ring-tac-border backdrop-blur ${
        drag.dragging ? "text-tac-accent ring-tac-accent/60" : ""
      }`}
    >
      <button
        onClick={() => setPanelMinimized("aircraftStatus", true)}
        title="Hide to taskbar"
        data-no-drag
        className="absolute right-1.5 top-1.5 z-10 rounded p-1 text-slate-500 hover:bg-tac-bg/70 hover:text-slate-200"
      >
        <Minus size={13} />
      </button>
      <div className="compact-scrollbar max-h-[18rem] overflow-y-auto pr-4">
        <div className="flex flex-col gap-0.5">
          {visible.map((a) => (
            <AircraftRow
              key={a.id}
              a={a}
              selected={a.id === selectedId}
              simTime={simTime}
              runtime={runtime.aircraft[a.id]}
              onSelect={() => select(a.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AircraftRow({
  a,
  selected,
  simTime,
  runtime,
  onSelect,
}: {
  a: Aircraft;
  selected: boolean;
  simTime: number;
  runtime?: {
    activeBlockIndex: number | null;
    blockStartedAt: number | null;
    waitingBlockIndex?: number | null;
    waitingStartedAt?: number | null;
    completedBlockIds: string[];
  };
  onSelect: () => void;
}) {
  const block =
    runtime?.activeBlockIndex == null
      ? null
      : a.programBlocks[runtime.activeBlockIndex];
  const elapsed =
    runtime?.blockStartedAt == null ? null : simTime - runtime.blockStartedAt;
  const waiting =
    runtime?.activeBlockIndex == null && runtime?.waitingBlockIndex != null
      ? a.programBlocks[runtime.waitingBlockIndex]
      : null;
  const waitingElapsed =
    runtime?.waitingStartedAt == null ? null : simTime - runtime.waitingStartedAt;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`grid w-full grid-cols-[62px_42px_46px_58px_34px_38px_minmax(0,1fr)_42px] items-center gap-x-1 gap-y-0 rounded px-1.5 py-1 text-left ring-1 transition ${
        selected
          ? "bg-tac-accent/10 ring-tac-accent/60"
          : "bg-tac-bg/45 ring-tac-border hover:bg-tac-bg/70"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: a.color }}
        />
        <span className="truncate font-semibold text-slate-100">{a.callsign}</span>
      </span>
      <span className="text-right text-slate-200">
        {Math.round(a.headingMagDeg).toString().padStart(3, "0")}°
      </span>
      <span className="text-right text-slate-200">{Math.round(a.speedKt)}kt</span>
      <span className="text-right text-slate-200">
        {Math.round(a.altitudeFt).toLocaleString()}
      </span>
      <span
        className={`text-right ${
          Math.abs(a.bankDeg) > 0.5 ? "text-tac-warn" : "text-slate-500"
        }`}
      >
        {a.bankDeg >= 0 ? "+" : ""}
        {a.bankDeg.toFixed(0)}
      </span>
      <span className="text-right text-slate-200">{a.loadFactorG.toFixed(1)}G</span>
      <span className="min-w-0 truncate pl-2 text-left text-slate-300">
        {block?.label ?? waiting?.label ?? "none"}
      </span>
      <span className="pl-2 text-left">
        {block && elapsed != null && (
          <span className="text-tac-accent">{elapsed.toFixed(1)}s</span>
        )}
        {!block && waiting && waitingElapsed != null && (
          <span className="text-slate-500">{waitingElapsed.toFixed(1)}s</span>
        )}
      </span>
    </div>
  );
}
