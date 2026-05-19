import { useEffect, useState } from "react";
import type maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import { Minus } from "lucide-react";
import DeclinationIndicator from "./DeclinationIndicator";
import { formatDDM } from "../../lib/coords";
import { useDraggablePanel } from "../../lib/useDraggablePanel";
import { useSettings } from "../../store/settingsStore";

const MAX_SCALE_WIDTH = 120;

type CursorPos = { lng: number; lat: number } | null;

type ScaleState = {
  label: string;
  width: number;
};

export default function MapStatusPanel({
  map,
  cursor,
}: {
  map: maplibregl.Map | null;
  cursor: CursorPos;
}) {
  const drag = useDraggablePanel("mapStatus", { bounds: "offsetParent" });
  const minimized = useSettings((s) => s.minimizedPanels.mapStatus);
  const setPanelMinimized = useSettings((s) => s.setPanelMinimized);
  const [scale, setScale] = useState<ScaleState | null>(null);

  useEffect(() => {
    if (!map) return;
    const update = () => setScale(computeScale(map));
    update();
    map.on("move", update);
    map.on("zoom", update);
    map.on("resize", update);
    return () => {
      map.off("move", update);
      map.off("zoom", update);
      map.off("resize", update);
    };
  }, [map]);

  if (minimized) return null;

  return (
    <div
      ref={drag.ref}
      style={drag.style}
      onPointerDown={drag.onPointerDown}
      className={`absolute bottom-2 left-2 z-30 flex touch-none cursor-move select-none items-center gap-3 rounded bg-tac-panel/80 px-2 py-1 font-mono text-xs text-slate-300 ring-1 ring-tac-border backdrop-blur ${
        drag.dragging ? "text-tac-accent" : ""
      }`}
    >
      <span>
        {cursor ? formatDDM(cursor.lat, cursor.lng) : "-- move cursor over map --"}
      </span>
      <DeclinationIndicator map={map} />
      {scale && (
        <span className="flex items-center gap-2 text-slate-400">
          <span
            className="h-1.5 border-x border-b border-slate-400"
            style={{ width: scale.width }}
          />
          <span>{scale.label}</span>
        </span>
      )}
      <button
        onClick={() => setPanelMinimized("mapStatus", true)}
        title="Hide to taskbar"
        data-no-drag
        className="text-slate-500 hover:text-slate-200"
      >
        <Minus size={12} />
      </button>
    </div>
  );
}

function computeScale(map: maplibregl.Map): ScaleState | null {
  const container = map.getContainer();
  if (!container.clientWidth || !container.clientHeight) return null;

  const y = Math.max(0, container.clientHeight - 48);
  const left = map.unproject([0, y]);
  const right = map.unproject([MAX_SCALE_WIDTH, y]);
  const rawNm = turf.distance(
    [left.lng, left.lat],
    [right.lng, right.lat],
    { units: "nauticalmiles" },
  );
  if (!Number.isFinite(rawNm) || rawNm <= 0) return null;

  const niceNm = niceDistance(rawNm);
  return {
    label: formatScale(niceNm),
    width: Math.max(24, Math.round((niceNm / rawNm) * MAX_SCALE_WIDTH)),
  };
}

function niceDistance(maxNm: number): number {
  const exponent = Math.floor(Math.log10(maxNm));
  const base = 10 ** exponent;
  for (const step of [5, 2, 1]) {
    const candidate = step * base;
    if (candidate <= maxNm) return candidate;
  }
  return base / 2;
}

function formatScale(nm: number): string {
  if (nm < 1) return `${Math.round(nm * 6076)} ft`;
  if (nm < 10) return `${nm.toFixed(1).replace(/\.0$/, "")} nm`;
  return `${Math.round(nm)} nm`;
}
