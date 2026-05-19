import { Check, Download, Minus, Pencil, Trash2, Upload, X } from "lucide-react";
import { useRef } from "react";
import { usePolygons } from "../store/polygonStore";
import { buildKmz, downloadKmz, readKmzOrKml } from "../lib/kmz";
import { useDraggablePanel } from "../lib/useDraggablePanel";
import { useSettings } from "../store/settingsStore";

export default function PolygonPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useDraggablePanel("polygon", { bounds: "offsetParent" });
  const minimized = useSettings((s) => s.minimizedPanels.polygon);
  const setPanelMinimized = useSettings((s) => s.setPanelMinimized);
  const {
    polygons,
    drawing,
    editing,
    draftPoints,
    startDrawing,
    setEditing,
    finishDraft,
    cancelDraft,
    addPolygons,
    setColor,
    setFillColor,
    rename,
    remove,
    clearAll,
  } = usePolygons();

  if (minimized) return null;

  return (
    <div
      ref={drag.ref}
      style={drag.style}
      className="absolute left-14 top-2 z-30 w-60 rounded bg-tac-panel/95 ring-1 ring-tac-border backdrop-blur"
    >
      <div
        onPointerDown={drag.onPointerDown}
        className={`flex touch-none cursor-move select-none items-center justify-between border-b border-tac-border px-2 py-1.5 text-xs uppercase tracking-wider text-slate-400 ${
          drag.dragging ? "text-tac-accent" : ""
        }`}
      >
        <span>Polygons ({polygons.length})</span>
        <div className="flex items-center gap-2">
        {polygons.length > 0 && (
          <button
            onClick={clearAll}
            title="Clear all"
            data-no-drag
            className="text-slate-500 hover:text-tac-danger"
          >
            <Trash2 size={12} />
          </button>
        )}
          <button
            onClick={() => setPanelMinimized("polygon", true)}
            title="Hide to taskbar"
            data-no-drag
            className="text-slate-500 hover:text-slate-200"
          >
            <Minus size={12} />
          </button>
        </div>
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
          onClick={() => setEditing(!editing)}
          disabled={drawing || polygons.length === 0}
          title="Show vertex edit handles"
          className={`rounded px-2 py-1 text-xs ring-1 disabled:opacity-30 ${
            editing
              ? "bg-tac-accent/30 text-tac-accent ring-tac-accent/40"
              : "bg-tac-border/30 text-slate-200 ring-transparent hover:bg-tac-border/60"
          }`}
        >
          Edit
        </button>
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
              className="rounded border border-tac-border bg-tac-bg/40 px-2 py-1 text-xs"
            >
              <div className="flex items-center gap-2">
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
              <div className="mt-1 flex items-center gap-2">
                <label
                  className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500"
                  title="Outline color"
                >
                  <span>Line</span>
                  <input
                    type="color"
                    value={p.color}
                    onChange={(e) => setColor(p.id, e.target.value)}
                    className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
                <label
                  className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500"
                  title="Fill color"
                >
                  <span>Fill</span>
                  <input
                    type="color"
                    value={p.fillColor ?? p.color}
                    onChange={(e) => setFillColor(p.id, e.target.value)}
                    className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
                <button
                  onClick={() => setFillColor(p.id, null)}
                  title="No fill"
                  className={`ml-auto shrink-0 rounded px-1 py-0.5 text-[10px] uppercase tracking-wider ring-1 ${
                    p.fillColor
                      ? "text-slate-500 ring-tac-border hover:text-slate-200"
                      : "text-tac-accent ring-tac-accent/50"
                  }`}
                >
                  None
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
