import { Hand, MapPin, Ruler, Triangle } from "lucide-react";
import { useEffect } from "react";
import { useTool, type ToolId } from "../../store/toolStore";

const TOOLS: { id: ToolId; label: string; icon: typeof Hand }[] = [
  { id: "select", label: "Select / Pan", icon: Hand },
  { id: "waypoint", label: "Add waypoint", icon: MapPin },
  { id: "ruler", label: "Ruler (new)", icon: Ruler },
  { id: "protractor", label: "Protractor (new)", icon: Triangle },
];

export default function Toolbar() {
  const { tool, setTool } = useTool();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTool]);

  return (
    <div className="absolute left-2 top-2 flex flex-col gap-1 rounded bg-tac-panel/90 p-1 ring-1 ring-tac-border backdrop-blur">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = t.id === tool;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            className={`flex h-9 w-9 items-center justify-center rounded transition ${
              active
                ? "bg-tac-accent/30 text-tac-accent ring-1 ring-tac-accent/60"
                : "text-slate-300 hover:bg-tac-border/50"
            }`}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
