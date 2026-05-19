import { Compass, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type maplibregl from "maplibre-gl";

export default function MapNavControls({
  map,
}: {
  map: maplibregl.Map | null;
}) {
  const [bearing, setBearing] = useState(0);

  useEffect(() => {
    if (!map) return;
    const update = () => setBearing(map.getBearing());
    update();
    map.on("rotate", update);
    map.on("move", update);
    return () => {
      map.off("rotate", update);
      map.off("move", update);
    };
  }, [map]);

  const disabled = !map;

  return (
    <div className="absolute right-2 top-2 z-30 flex flex-col gap-1 rounded bg-tac-panel/90 p-1 ring-1 ring-tac-border backdrop-blur">
      <button
        onClick={() => map?.zoomIn({ duration: 180 })}
        disabled={disabled}
        title="Zoom in"
        className="flex h-8 w-8 items-center justify-center rounded text-slate-300 transition hover:bg-tac-border/50 disabled:opacity-40"
      >
        <Plus size={15} />
      </button>
      <button
        onClick={() => map?.zoomOut({ duration: 180 })}
        disabled={disabled}
        title="Zoom out"
        className="flex h-8 w-8 items-center justify-center rounded text-slate-300 transition hover:bg-tac-border/50 disabled:opacity-40"
      >
        <Minus size={15} />
      </button>
      <button
        onClick={() => map?.rotateTo(0, { duration: 220 })}
        disabled={disabled}
        title="Reset north"
        className={`flex h-8 w-8 items-center justify-center rounded transition disabled:opacity-40 ${
          Math.abs(bearing) > 0.5
            ? "text-tac-accent hover:bg-tac-accent/15"
            : "text-slate-300 hover:bg-tac-border/50"
        }`}
      >
        <Compass
          size={16}
          style={{ transform: `rotate(${-bearing}deg)` }}
        />
      </button>
    </div>
  );
}
