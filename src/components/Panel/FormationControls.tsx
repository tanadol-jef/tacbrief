import { useScenario } from "../../store/scenarioStore";
import { FORMATION_LIST } from "../../lib/formations";

export default function FormationControls() {
  const {
    formationMode,
    formationPreset,
    formationSpacingFt,
    formationStaggerFt,
    setFormationMode,
    setFormationPreset,
    setFormationSpacingFt,
    setFormationStaggerFt,
    syncFormation,
  } = useScenario();
  const linked = formationMode === "linked";

  return (
    <div className="border-t border-tac-border bg-tac-panel/60 p-3 text-xs text-slate-300">
      <div className="mb-2 flex items-center justify-between">
        <span className="uppercase tracking-wider text-slate-400">
          Formation
        </span>
        <div className="flex overflow-hidden rounded ring-1 ring-tac-border">
          {(["independent", "linked"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setFormationMode(m)}
              className={`px-2 py-0.5 ${
                formationMode === m
                  ? "bg-tac-accent/30 text-tac-accent"
                  : "text-slate-400 hover:bg-tac-border/40"
              }`}
            >
              {m === "independent" ? "Indep" : "Linked"}
            </button>
          ))}
        </div>
      </div>
      <select
        value={formationPreset}
        onChange={(e) =>
          setFormationPreset(
            e.target.value as (typeof FORMATION_LIST)[number]["id"],
          )
        }
        disabled={!linked}
        className="mb-2 w-full rounded bg-tac-bg px-2 py-1 ring-1 ring-tac-border disabled:opacity-50"
      >
        {FORMATION_LIST.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Spacing
          </span>
          <input
            type="number"
            step={100}
            value={formationSpacingFt}
            onChange={(e) =>
              setFormationSpacingFt(parseInt(e.target.value, 10) || 0)
            }
            disabled={!linked}
            className="rounded bg-tac-bg px-2 py-1 font-mono ring-1 ring-tac-border disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Stagger
          </span>
          <input
            type="number"
            step={100}
            value={formationStaggerFt}
            onChange={(e) =>
              setFormationStaggerFt(parseInt(e.target.value, 10) || 0)
            }
            disabled={!linked}
            className="rounded bg-tac-bg px-2 py-1 font-mono ring-1 ring-tac-border disabled:opacity-50"
          />
        </label>
      </div>
      {linked && (
        <button
          onClick={syncFormation}
          className="mt-2 w-full rounded bg-tac-border/50 px-2 py-1 text-slate-200 hover:bg-tac-border"
        >
          Re-sync wingmen
        </button>
      )}
    </div>
  );
}
