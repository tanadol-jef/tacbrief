import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import LayerSwitcher, {
  buildStyle,
  type BasemapId,
} from "./LayerSwitcher";
import AircraftLayer from "./AircraftLayer";
import AirportLayer from "./AirportLayer";
import WaypointLayer from "./WaypointLayer";
import MeasurementLayer from "./MeasurementLayer";
import PolygonLayer from "./PolygonLayer";
import RecordingLayer from "./RecordingLayer";
import ReplayLayer from "./ReplayLayer";
import DeclinationIndicator from "./DeclinationIndicator";
import Toolbar from "./Toolbar";
import { usePolygons } from "../../store/polygonStore";
import { useRecording } from "../../store/recordingStore";
import PolygonPanel from "../PolygonPanel";
import { useScenario } from "../../store/scenarioStore";
import { useMapStore } from "../../store/mapStore";
import { useTool } from "../../store/toolStore";
import { useSettings } from "../../store/settingsStore";
import { frameAt as recordingFrameAt } from "../../store/recordingStore";
import { formatDDM } from "../../lib/coords";
import MeasurementPanel from "../MeasurementPanel";

const INITIAL_CENTER: [number, number] = [100.5, 14.5];
const INITIAL_ZOOM = 6;

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("dark");
  const [overlayOn, setOverlayOn] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(
    null,
  );

  const aircraft = useScenario((s) => s.aircraft);
  const selectedId = useScenario((s) => s.selectedId);
  const setPosition = useScenario((s) => s.setPosition);
  const addWaypoint = useScenario((s) => s.addWaypoint);

  const flyTo = useMapStore((s) => s.flyTo);
  const clearFlyTo = useMapStore((s) => s.clearFlyTo);

  const tool = useTool((s) => s.tool);
  const measurements = useTool((s) => s.measurements);
  const activeMeasurementId = useTool((s) => s.activeId);
  const addPoint = useTool((s) => s.addPoint);

  const polygons = usePolygons((s) => s.polygons);
  const draftPoints = usePolygons((s) => s.draftPoints);
  const drawing = usePolygons((s) => s.drawing);
  const addDraftPoint = usePolygons((s) => s.addDraftPoint);
  const finishDraft = usePolygons((s) => s.finishDraft);

  const importedRecording = useRecording((s) => s.imported);
  const replayMode = useRecording((s) => s.replayMode);
  const replayTime = useRecording((s) => s.replayTime);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: containerRef.current,
        style: buildStyle("dark", false),
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        attributionControl: { compact: true },
      });
    } catch (err) {
      console.error("[TacBrief] MapLibre init failed:", err);
      return;
    }
    m.on("error", (e) => console.error("[TacBrief] map error:", e.error));
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }));
    m.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: "nautical" }),
    );
    m.on("mousemove", (e) =>
      setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat }),
    );
    m.on("mouseout", () => setCursor(null));
    m.on("load", () => setStyleVersion((v) => v + 1));
    mapRef.current = m;
    setMap(m);
    return () => {
      m.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  const lastAppliedStyle = useRef<{ basemap: BasemapId; overlay: boolean }>({
    basemap: "dark",
    overlay: false,
  });
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const prev = lastAppliedStyle.current;
    if (prev.basemap === basemap && prev.overlay === overlayOn) return;
    lastAppliedStyle.current = { basemap, overlay: overlayOn };
    m.setStyle(buildStyle(basemap, overlayOn));
    m.once("styledata", () => setStyleVersion((v) => v + 1));
  }, [basemap, overlayOn]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !flyTo) return;
    m.flyTo({
      center: [flyTo.lon, flyTo.lat],
      zoom: flyTo.zoom ?? m.getZoom(),
      essential: true,
      duration: 1200,
    });
    clearFlyTo();
  }, [flyTo, clearFlyTo]);

  // Hook click events based on active tool. We read aircraft and snapPx from
  // the store on every click so the closure can't go stale during sim playback.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const canvas = m.getCanvas();

    if (tool === "select") canvas.style.cursor = "";
    else canvas.style.cursor = "crosshair";

    const snapToAircraft = (
      pt: maplibregl.Point,
    ):
      | {
          source: "live" | "replay";
          aircraftId: 1 | 2 | 3 | 4;
          lat: number;
          lon: number;
        }
      | null => {
      const snapPx = useSettings.getState().snapPx;
      const acs = useScenario.getState().aircraft;
      let best:
        | {
            source: "live" | "replay";
            id: 1 | 2 | 3 | 4;
            lat: number;
            lon: number;
            d: number;
          }
        | null = null;
      for (const a of acs) {
        if (!a.visible) continue;
        const screen = m.project([a.position.lon, a.position.lat]);
        const d = Math.hypot(screen.x - pt.x, screen.y - pt.y);
        if (d <= snapPx && (!best || d < best.d)) {
          best = {
            source: "live",
            id: a.id,
            lat: a.position.lat,
            lon: a.position.lon,
            d,
          };
        }
      }
      // Also consider replay ghost aircraft when replay is showing.
      const rec = useRecording.getState();
      if (rec.replayMode && rec.imported) {
        const frame = recordingFrameAt(rec.imported, rec.replayTime);
        for (const [id, ac] of frame) {
          const screen = m.project([ac.lon, ac.lat]);
          const d = Math.hypot(screen.x - pt.x, screen.y - pt.y);
          if (d <= snapPx && (!best || d < best.d)) {
            best = {
              source: "replay",
              id: id as 1 | 2 | 3 | 4,
              lat: ac.lat,
              lon: ac.lon,
              d,
            };
          }
        }
      }
      return best
        ? {
            source: best.source,
            aircraftId: best.id,
            lat: best.lat,
            lon: best.lon,
          }
        : null;
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const lat = e.lngLat.lat;
      const lon = e.lngLat.lng;
      if (drawing) {
        addDraftPoint({ lat, lon });
        return;
      }
      switch (tool) {
        case "place":
          setPosition(selectedId as 1 | 2 | 3 | 4, lat, lon);
          break;
        case "waypoint":
          addWaypoint(selectedId as 1 | 2 | 3 | 4, { lat, lon });
          break;
        case "ruler":
        case "protractor": {
          const snap = snapToAircraft(e.point);
          if (snap) {
            addPoint({
              kind:
                snap.source === "replay" ? "replay-aircraft" : "aircraft",
              aircraftId: snap.aircraftId,
            });
          } else {
            addPoint({ kind: "fixed", lat, lon });
          }
          break;
        }
      }
    };

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      if (drawing) {
        e.preventDefault();
        finishDraft();
      }
    };

    m.on("click", onClick);
    m.on("dblclick", onDblClick);
    return () => {
      m.off("click", onClick);
      m.off("dblclick", onDblClick);
      canvas.style.cursor = "";
    };
  }, [
    tool,
    selectedId,
    drawing,
    addDraftPoint,
    finishDraft,
    setPosition,
    addWaypoint,
    addPoint,
  ]);

  return (
    <div
      className="relative"
      style={{ height: "100%", width: "100%", minHeight: 0 }}
    >
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          background: "#0b0f14",
        }}
      />
      <AirportLayer map={map} styleReady={styleVersion} />
      <WaypointLayer
        map={map}
        styleReady={styleVersion}
        aircraft={aircraft}
        selectedId={selectedId}
      />
      <AircraftLayer
        map={map}
        styleReady={styleVersion}
        aircraft={aircraft}
        selectedId={selectedId}
      />
      <PolygonLayer
        map={map}
        styleReady={styleVersion}
        polygons={polygons}
        draftPoints={draftPoints}
        drawing={drawing}
      />
      <RecordingLayer
        map={map}
        styleReady={styleVersion}
        imported={importedRecording}
      />
      <ReplayLayer
        map={map}
        styleReady={styleVersion}
        imported={importedRecording}
        replayMode={replayMode}
        replayTime={replayTime}
      />
      <MeasurementLayer
        map={map}
        styleReady={styleVersion}
        measurements={measurements}
        aircraft={aircraft}
        activeId={activeMeasurementId}
      />
      <MeasurementPanel />
      <PolygonPanel />
      <Toolbar />
      <LayerSwitcher
        basemap={basemap}
        onBasemapChange={setBasemap}
        overlay={overlayOn}
        onOverlayChange={setOverlayOn}
      />
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-3 rounded bg-tac-panel/80 px-2 py-1 font-mono text-xs text-slate-300 ring-1 ring-tac-border">
        <span>
          {cursor
            ? formatDDM(cursor.lat, cursor.lng)
            : "— move cursor over map —"}
        </span>
        <DeclinationIndicator map={map} />
      </div>
    </div>
  );
}
