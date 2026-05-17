import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Aircraft } from "../../types";
import { useScenario } from "../../store/scenarioStore";
import { formatDDM, parseDDM } from "../../lib/coords";

type Props = { a: Aircraft };

export default function WaypointEditor({ a }: Props) {
  const { addWaypoint, removeWaypoint, clearRoute, update } = useScenario();

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= a.route.length) return;
    const route = [...a.route];
    const [item] = route.splice(i, 1);
    route.splice(j, 0, item);
    update(a.id, { route });
  };

  const editPoint = (i: number, lat: number, lon: number) => {
    const route = a.route.map((w, idx) => (idx === i ? { ...w, lat, lon } : w));
    update(a.id, { route });
  };

  const editAlt = (i: number, altFt: number | undefined) => {
    const route = a.route.map((w, idx) => (idx === i ? { ...w, altFt } : w));
    update(a.id, { route });
  };

  const editSpd = (i: number, speedKt: number | undefined) => {
    const route = a.route.map((w, idx) => (idx === i ? { ...w, speedKt } : w));
    update(a.id, { route });
  };

  return (
    <div className="mt-3 border-t border-tac-border pt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
        <span>
          Waypoints ({a.route.length}){" "}
          {a.route.length > 0 && a.routeIndex < a.route.length && (
            <span className="text-tac-accent">
              · next #{a.routeIndex + 1}
            </span>
          )}
        </span>
        {a.route.length > 0 && (
          <button
            onClick={() => clearRoute(a.id)}
            title="Clear route"
            className="text-slate-500 hover:text-tac-danger"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {a.route.map((w, i) => (
          <WaypointRow
            key={i}
            wp={w}
            index={i}
            running={i === a.routeIndex}
            onEditPoint={(lat, lon) => editPoint(i, lat, lon)}
            onEditAlt={(v) => editAlt(i, v)}
            onEditSpd={(v) => editSpd(i, v)}
            onRemove={() => removeWaypoint(a.id, i)}
            onMove={(dir) => move(i, dir)}
            isFirst={i === 0}
            isLast={i === a.route.length - 1}
          />
        ))}
      </div>
      <button
        onClick={() =>
          addWaypoint(a.id, {
            lat: a.position.lat,
            lon: a.position.lon,
          })
        }
        className="mt-1 flex w-full items-center justify-center gap-1 rounded bg-tac-bg px-2 py-1 text-[11px] text-slate-300 ring-1 ring-tac-border hover:bg-tac-border/40"
      >
        <Plus size={11} /> Add waypoint at current position
      </button>
      <div className="mt-1 text-[10px] text-slate-500">
        Or use the waypoint tool (📍) to click on the map.
      </div>
    </div>
  );
}

function WaypointRow({
  wp,
  index,
  running,
  onEditPoint,
  onEditAlt,
  onEditSpd,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: {
  wp: { lat: number; lon: number; altFt?: number; speedKt?: number };
  index: number;
  running: boolean;
  onEditPoint: (lat: number, lon: number) => void;
  onEditAlt: (v: number | undefined) => void;
  onEditSpd: (v: number | undefined) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [coordText, setCoordText] = useState(formatDDM(wp.lat, wp.lon));

  const commitCoord = () => {
    const parsed = parseDDM(coordText);
    if (parsed) {
      onEditPoint(parsed.lat, parsed.lon);
      setCoordText(formatDDM(parsed.lat, parsed.lon));
    } else {
      setCoordText(formatDDM(wp.lat, wp.lon));
    }
    setEditing(false);
  };

  return (
    <div
      className={`flex flex-col gap-1 rounded px-1.5 py-1 text-[11px] ring-1 ${
        running
          ? "bg-tac-accent/10 text-slate-100 ring-tac-accent/50"
          : "bg-tac-bg/40 text-slate-300 ring-tac-border"
      }`}
    >
      <div className="flex items-center gap-1">
        <span className="w-5 shrink-0 text-center font-mono text-slate-500">
          {index + 1}
        </span>
        {editing ? (
          <input
            value={coordText}
            autoFocus
            onChange={(e) => setCoordText(e.target.value)}
            onBlur={commitCoord}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitCoord();
              else if (e.key === "Escape") {
                setCoordText(formatDDM(wp.lat, wp.lon));
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded bg-tac-bg px-1 py-0.5 font-mono text-[10px] text-slate-100 ring-1 ring-tac-accent focus:outline-none"
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCoordText(formatDDM(wp.lat, wp.lon));
              setEditing(true);
            }}
            className="min-w-0 flex-1 truncate text-left font-mono text-[10px] text-slate-200 hover:text-tac-accent"
          >
            {formatDDM(wp.lat, wp.lon)}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMove(-1);
          }}
          disabled={isFirst}
          className="shrink-0 text-slate-500 hover:text-slate-200 disabled:opacity-20"
        >
          <ChevronUp size={11} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMove(1);
          }}
          disabled={isLast}
          className="shrink-0 text-slate-500 hover:text-slate-200 disabled:opacity-20"
        >
          <ChevronDown size={11} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 text-slate-500 hover:text-tac-danger"
        >
          <X size={11} />
        </button>
      </div>
      <div className="flex items-center gap-2 pl-6 text-[10px] text-slate-500">
        <label className="flex items-center gap-1">
          alt
          <input
            type="number"
            value={wp.altFt ?? ""}
            placeholder="—"
            onChange={(e) => {
              const v = e.target.value;
              onEditAlt(v === "" ? undefined : parseInt(v, 10));
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-16 rounded bg-tac-bg px-1 py-0.5 text-right font-mono text-slate-200 ring-1 ring-tac-border focus:outline-none"
          />
          ft
        </label>
        <label className="flex items-center gap-1">
          spd
          <input
            type="number"
            value={wp.speedKt ?? ""}
            placeholder="—"
            onChange={(e) => {
              const v = e.target.value;
              onEditSpd(v === "" ? undefined : parseInt(v, 10));
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-14 rounded bg-tac-bg px-1 py-0.5 text-right font-mono text-slate-200 ring-1 ring-tac-border focus:outline-none"
          />
          kt
        </label>
      </div>
    </div>
  );
}
