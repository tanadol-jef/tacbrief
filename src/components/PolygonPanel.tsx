import { Check, Download, Pencil, Trash2, Upload, X } from "lucide-react";
import { useRef } from "react";
import { usePolygons } from "../store/polygonStore";
import { buildKmz, downloadKmz, readKmzOrKml } from "../lib/kmz";

export default function PolygonPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    polygons,
    drawing,
    draftPoints,
    startDrawing,
    finishDraft,
    cancelDraft,
    addPolygons,
    rename,
    remove,
    clearAll,
  } = usePolygons();

  return (
    <div className="absolute left-14 top-2 z-30 w-60 rounded bg-tac-panel/95 ring-1 ring-tac-border backdrop-blur">
      <div className="flex items-center justify-between border-b border-tac-border px-2 py-1.5 text-xs uppercase tracking-wider text-slate-400">
        <span>Polygons ({polygons.length})</span>
        {polygons.length > 0 && (
          <button
            onClick={clearAll}
            title="Clear all"
            className="text-slate-500 hover:text-tac-danger"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-tac-border p-2">
        {!drawing ? (
          <button
            onClick={startDrawing}
            className="flex flex-1 items-center justify-center gap-1 rounded bg-tac-border/30 px-2 py-1 text-xs text-slate-200 hover:bg-tac-border/60"
            title="Click points on the map; double-click or press Enter to close"
          >
            <Pencil size={12} /> Draw
          </button>
        ) : (
          <>
            <button
              onClick={finishDraft}
              disabled={draftPoints.length < 3}
              className="flex flex-1 items-center justify-center gap-1 rounded bg-tac-accent/30 px-2 py-1 text-xs text-tac-accent ring-1 ring-tac-accent/40 hover:bg-tac-accent/50 disabled:opacity-30"
            >
              <Check size={12} /> Finish ({draftPoints.length})
            </button>
            <button
              onClick={cancelDraft}
              className="rounded px-2 py-1 text-xs text-slate-400 ring-1 ring-tac-border hover:text-tac-danger"
            >
              <X size={12} />
            </button>
          </>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          title="Import .kmz / .kml"
          className="rounded bg-tac-border/30 px-2 py-1 text-xs text-slate-200 hover:bg-tac-border/60"
        >
          <Upload size={12} />
        </button>
        <button
          onClick={async () => {
            const blob = await buildKmz(polygons);
            const stamp = new Date()
              .toISOString()
              .replace(/[:.]/g, "-")
              .slice(0, 16);
            downloadKmz(blob, `tacbrief-polygons-${stamp}.kmz`);
          }}
          disabled={polygons.length === 0}
          title="Export .kmz"
          className="rounded bg-tac-border/30 px-2 py-1 text-xs text-slate-200 hover:bg-tac-border/60 disabled:opacity-30"
        >
          <Download size={12} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const polys = await readKmzOrKml(f);
              if (polys.length === 0) {
                alert("No polygons found in this file.");
              } else {
                addPolygons(polys);
              }
            } catch (err) {
              alert(
                `Import failed: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      </div>

      {polygons.length > 0 && (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto p-2">
          {polygons.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded border border-tac-border bg-tac-bg/40 px-2 py-1 text-xs"
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: p.color }}
              />
              <input
                value={p.name}
                onChange={(e) => rename(p.id, e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-slate-100 focus:outline-none"
              />
              <span className="shrink-0 text-[10px] text-slate-500">
                {p.outer.length} pt
              </span>
              <button
                onClick={() => remove(p.id)}
                className="shrink-0 text-slate-500 hover:text-tac-danger"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
