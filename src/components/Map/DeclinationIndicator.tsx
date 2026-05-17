import { useEffect, useState } from "react";
import type maplibregl from "maplibre-gl";
import { declinationDeg } from "../../lib/magnetic";

export default function DeclinationIndicator({
  map,
}: {
  map: maplibregl.Map | null;
}) {
  const [decl, setDecl] = useState<number | null>(null);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      const c = map.getCenter();
      setDecl(declinationDeg(c.lat, c.lng));
    };
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [map]);

  if (decl == null) return null;
  const abs = Math.abs(decl);
  const dir = decl >= 0 ? "E" : "W";
  return (
    <span className="font-mono text-xs text-slate-400">
      VAR {abs.toFixed(1)}°{dir}
    </span>
  );
}
