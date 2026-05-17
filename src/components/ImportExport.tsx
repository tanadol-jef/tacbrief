import { Download, Upload } from "lucide-react";
import { useRef } from "react";
import { useScenario } from "../store/scenarioStore";
import { exportScenarioFile, importScenarioFile } from "../lib/persistence";

export default function ImportExport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    aircraft,
    selectedId,
    formationMode,
    formationPreset,
    formationSpacingFt,
    formationStaggerFt,
    loadScenario,
  } = useScenario();

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() =>
          exportScenarioFile({
            aircraft,
            selectedId,
            formationMode,
            formationPreset,
            formationSpacingFt,
            formationStaggerFt,
          })
        }
        title="Export scenario"
        className="flex h-8 w-8 items-center justify-center rounded ring-1 ring-tac-border text-slate-300 hover:bg-tac-border/40"
      >
        <Download size={14} />
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        title="Import scenario"
        className="flex h-8 w-8 items-center justify-center rounded ring-1 ring-tac-border text-slate-300 hover:bg-tac-border/40"
      >
        <Upload size={14} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const s = await importScenarioFile(f);
          if (s) loadScenario(s);
          else alert("Failed to import — file format invalid or wrong version.");
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
    </div>
  );
}
