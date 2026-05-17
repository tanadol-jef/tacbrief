import { useScenario } from "../../store/scenarioStore";
import AircraftCard from "./AircraftCard";
import FormationControls from "./FormationControls";

export default function SidePanel() {
  const { aircraft, addAircraft, syncEdits, setSyncEdits } = useScenario();
  const canAdd = aircraft.length < 4;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-tac-border bg-tac-bg">
      <div className="flex items-center justify-between border-b border-tac-border px-3 py-2 text-xs uppercase tracking-wider text-slate-400">
        <span>Aircraft ({aircraft.length}/4)</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSyncEdits(!syncEdits)}
            title="When on, editing one aircraft applies to all"
            className={`rounded px-2 py-0.5 ring-1 ${
              syncEdits
                ? "bg-tac-warn/20 text-tac-warn ring-tac-warn/50"
                : "ring-tac-border text-slate-400 hover:bg-tac-border/40"
            }`}
          >
            Sync {syncEdits ? "ON" : "OFF"}
          </button>
          <button
            onClick={addAircraft}
            disabled={!canAdd}
            className="rounded bg-tac-accent/20 px-2 py-0.5 text-tac-accent ring-1 ring-tac-accent/40 hover:bg-tac-accent/30 disabled:cursor-not-allowed disabled:opacity-30"
          >
            + Add
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {aircraft.map((a) => (
          <AircraftCard key={a.id} a={a} />
        ))}
      </div>
      <FormationControls />
    </aside>
  );
}
