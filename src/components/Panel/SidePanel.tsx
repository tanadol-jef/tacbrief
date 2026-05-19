import { useScenario } from "../../store/scenarioStore";
import { useState } from "react";
import AircraftCard from "./AircraftCard";
import FormationControls from "./FormationControls";
import ProgramPanel from "./ProgramPanel";

export default function SidePanel() {
  const { aircraft, addAircraft, syncEdits, setSyncEdits } = useScenario();
  const [tab, setTab] = useState<"aircraft" | "program">("aircraft");
  const canAdd = aircraft.length < 4;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-tac-border bg-tac-bg">
      <div className="border-b border-tac-border p-2">
        <div className="mb-2 grid grid-cols-2 rounded bg-tac-bg p-1 text-xs uppercase tracking-wider ring-1 ring-tac-border">
          <button
            onClick={() => setTab("aircraft")}
            className={`rounded px-2 py-1 ${
              tab === "aircraft"
                ? "bg-tac-accent/20 text-tac-accent"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Aircraft
          </button>
          <button
            onClick={() => setTab("program")}
            className={`rounded px-2 py-1 ${
              tab === "program"
                ? "bg-tac-accent/20 text-tac-accent"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Program
          </button>
        </div>
        {tab === "aircraft" && (
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
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
        )}
      </div>
      {tab === "aircraft" ? (
        <>
          <div className="compact-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto p-2">
            {aircraft.map((a) => (
              <AircraftCard key={a.id} a={a} />
            ))}
          </div>
          <FormationControls />
        </>
      ) : (
        <ProgramPanel />
      )}
    </aside>
  );
}
