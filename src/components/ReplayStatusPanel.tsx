import { useMemo } from "react";
import { Minus } from "lucide-react";
import { frameAt, useRecording } from "../store/recordingStore";
import { useDraggablePanel } from "../lib/useDraggablePanel";
import { useSettings } from "../store/settingsStore";

export default function ReplayStatusPanel() {
  const imported = useRecording((s) => s.imported);
  const replayMode = useRecording((s) => s.replayMode);
  const replayTime = useRecording((s) => s.replayTime);
  const minimized = useSettings((s) => s.minimizedPanels.replayStatus);
  const setPanelMinimized = useSettings((s) => s.setPanelMinimized);
  const drag = useDraggablePanel("replayStatus", { bounds: "offsetParent" });

  const frame = useMemo(() => {
    if (!imported || !replayMode) return [];
    return Array.from(frameAt(imported, replayTime).values()).sort(
      (a, b) => a.id - b.id,
    );
  }, [imported, replayMode, replayTime]);

  if (!replayMode || frame.length === 0 || minimized) return null;

  return (
    <div
      ref={drag.ref}
      style={drag.style}
      className="absolute left-14 bottom-2 z-30 flex flex-col gap-1 rounded bg-tac-panel/95 px-2 py-2 ring-1 ring-tac-accent/40 backdrop-blur"
    >
      <div
        onPointerDown={drag.onPointerDown}
        className="flex touch-none cursor-move select-none items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-tac-accent"
      >
        <span>Replay status</span>
        <button
          onClick={() => setPanelMinimized("replayStatus", true)}
          title="Hide to taskbar"
          data-no-drag
          className="text-slate-500 hover:text-slate-200"
        >
          <Minus size={12} />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {frame.map((ac) => (
          <div
            key={ac.id}
            className="flex items-center gap-2 rounded border border-tac-border bg-tac-bg/40 px-2 py-1 font-mono text-[10px]"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: ac.color }}
            />
            <span className="w-12 shrink-0 text-slate-100">
              {ac.callsign}
              <span className="text-tac-accent">·R</span>
            </span>
            <span className="w-16 shrink-0 text-right text-slate-300">
              {Math.round(ac.speedKt)} kt
            </span>
            <span className="w-20 shrink-0 text-right text-slate-300">
              {Math.round(ac.altFt).toLocaleString()} ft
            </span>
            <span className="w-12 shrink-0 text-right text-slate-300">
              {Math.round(ac.headingMagDeg).toString().padStart(3, "0")}°M
            </span>
            <span
              className={`w-12 shrink-0 text-right ${
                Math.abs(ac.bankDeg) > 0.5 ? "text-tac-warn" : "text-slate-500"
              }`}
            >
              {ac.bankDeg >= 0 ? "+" : ""}
              {ac.bankDeg.toFixed(0)}°
            </span>
            <span className="w-12 shrink-0 text-right text-slate-500">
              {gFromBank(ac.bankDeg).toFixed(1)} G
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function gFromBank(bankDeg: number): number {
  const c = Math.cos(Math.abs(bankDeg) * (Math.PI / 180));
  if (c <= 1e-6) return 99;
  return 1 / c;
}
