import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import { useScenario } from "../../store/scenarioStore";
import type { AircraftId } from "../../types";
import { useTool } from "../../store/toolStore";

type Props = {
  map: maplibregl.Map | null;
  styleReady: number;
};

const HIT_RADIUS_PX = 24;

export default function AircraftDragInteractions({ map, styleReady }: Props) {
  const draggingRef = useRef<{
    aircraftId: AircraftId;
    wasDragPanEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    const canvasContainer = map.getCanvasContainer();
    const setCursor = (cursor: string) => {
      canvas.style.cursor = cursor;
      canvasContainer.style.cursor = cursor;
    };

    const setCursorForPoint = (point: { x: number; y: number }) => {
      if (draggingRef.current) {
        setCursor("grabbing");
        return;
      }
      if (useTool.getState().tool !== "select") {
        setCursor("default");
        return;
      }
      setCursor(aircraftAt(map, point) ? "grab" : "default");
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (useTool.getState().tool !== "select") return;
      const point = pointFromEvent(canvas, e);
      const aircraftId = aircraftAt(map, point);
      if (!aircraftId) return;
      e.preventDefault();
      useScenario.getState().select(aircraftId);
      const wasDragPanEnabled = map.dragPan.isEnabled();
      if (wasDragPanEnabled) map.dragPan.disable();
      draggingRef.current = { aircraftId, wasDragPanEnabled };
      canvas.setPointerCapture(e.pointerId);
      setCursor("grabbing");
    };

    const onPointerMove = (e: PointerEvent) => {
      const point = pointFromEvent(canvas, e);
      const drag = draggingRef.current;
      if (!drag) {
        setCursorForPoint(point);
        return;
      }
      const lngLat = map.unproject([point.x, point.y]);
      useScenario
        .getState()
        .setPosition(drag.aircraftId, lngLat.lat, lngLat.lng);
    };

    const stopDrag = (e?: PointerEvent) => {
      const drag = draggingRef.current;
      if (drag) {
        draggingRef.current = null;
        if (drag.wasDragPanEnabled) map.dragPan.enable();
      }
      if (e) {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
        setCursorForPoint(pointFromEvent(canvas, e));
      } else {
        setCursor("default");
      }
    };

    const onLeave = () => {
      if (!draggingRef.current) setCursor("default");
    };

    setCursor("default");
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", stopDrag);
    canvas.addEventListener("pointercancel", stopDrag);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", stopDrag);
      canvas.removeEventListener("pointercancel", stopDrag);
      canvas.removeEventListener("pointerleave", onLeave);
      stopDrag();
    };
  }, [map, styleReady]);

  return null;
}

function aircraftAt(
  map: maplibregl.Map,
  point: { x: number; y: number },
): AircraftId | null {
  let best: { id: AircraftId; d: number } | null = null;
  for (const a of useScenario.getState().aircraft) {
    if (!a.visible) continue;
    const screen = map.project([a.position.lon, a.position.lat]);
    const d = Math.hypot(screen.x - point.x, screen.y - point.y);
    if (d <= HIT_RADIUS_PX && (!best || d < best.d)) {
      best = { id: a.id, d };
    }
  }
  return best?.id ?? null;
}

function pointFromEvent(canvas: HTMLCanvasElement, e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}
