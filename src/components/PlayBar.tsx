import { Pause, Play, RotateCcw } from "lucide-react";
import { useScenario } from "../store/scenarioStore";

export default function PlayBar() {
  const { playing, simTime, play, pause, resetSim } = useScenario();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => (playing ? pause() : play())}
        className="flex h-8 w-8 items-center justify-center rounded bg-tac-accent/20 text-tac-accent ring-1 ring-tac-accent/40 hover:bg-tac-accent/30"
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        onClick={resetSim}
        className="flex h-8 w-8 items-center justify-center rounded ring-1 ring-tac-border text-slate-300 hover:bg-tac-border/40"
        title="Reset to t=0"
      >
        <RotateCcw size={14} />
      </button>
      <span className="font-mono text-xs text-slate-400">
        t+{formatTime(simTime)}
      </span>
    </div>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
