import { Activity, Gauge, MapPinned, Ruler, Shapes } from "lucide-react";
import { type PanelKey, useSettings } from "../../store/settingsStore";

const TASKS: {
  key: PanelKey;
  label: string;
  icon: typeof Ruler;
}[] = [
  { key: "aircraftStatus", label: "Aircraft", icon: Gauge },
  { key: "measurement", label: "Measurements", icon: Ruler },
  { key: "polygon", label: "Polygons", icon: Shapes },
  { key: "replayStatus", label: "Replay", icon: Activity },
  { key: "mapStatus", label: "Map status", icon: MapPinned },
];

export default function FloatingTaskbar() {
  const minimizedPanels = useSettings((s) => s.minimizedPanels);
  const setPanelMinimized = useSettings((s) => s.setPanelMinimized);
  const minimized = TASKS.filter((task) => minimizedPanels[task.key]);

  if (minimized.length === 0) return null;

  return (
    <div className="absolute left-14 top-2 z-40 flex items-center gap-1 rounded bg-tac-panel/95 p-1 text-xs ring-1 ring-tac-border backdrop-blur">
      {minimized.map((task) => {
        const Icon = task.icon;
        return (
          <button
            key={task.key}
            onClick={() => setPanelMinimized(task.key, false)}
            title={`Restore ${task.label}`}
            className="flex h-8 items-center gap-1.5 rounded px-2 text-slate-300 hover:bg-tac-border/50 hover:text-slate-100"
          >
            <Icon size={14} />
            <span>{task.label}</span>
          </button>
        );
      })}
    </div>
  );
}
