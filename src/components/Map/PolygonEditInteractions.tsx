import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import { usePolygons } from "../../store/polygonStore";
import {
  LYR_POLY_EDIT_MIDPOINTS,
  LYR_POLY_EDIT_VERTICES,
} from "./PolygonLayer";

type Props = {
  map: maplibregl.Map | null;
  styleReady: number;
  drawing: boolean;
  editing: boolean;
};

type EditFeatureProps = {
  polyId?: string;
  index?: number;
};

export default function PolygonEditInteractions({
  map,
  styleReady,
  drawing,
  editing,
}: Props) {
  const draggingRef = useRef<{
    polyId: string;
    index: number;
    wasDragPanEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    if (!map || !editing) return;
    if (
      !map.getLayer(LYR_POLY_EDIT_VERTICES) ||
      !map.getLayer(LYR_POLY_EDIT_MIDPOINTS)
    ) {
      return;
    }

    const setPointer = () => {
      if (!drawing && editing) map.getCanvas().style.cursor = "pointer";
    };
    const clearPointer = () => {
      if (!draggingRef.current) map.getCanvas().style.cursor = "";
    };

    const onVertexDown = (e: maplibregl.MapMouseEvent) => {
      if (!editing || drawing || e.originalEvent.button !== 0) return;
      const props = editPropsAt(map, e, [LYR_POLY_EDIT_VERTICES]);
      if (!props) return;
      e.preventDefault();
      e.originalEvent.preventDefault();
      const wasDragPanEnabled = map.dragPan.isEnabled();
      if (wasDragPanEnabled) map.dragPan.disable();
      draggingRef.current = {
        polyId: props.polyId,
        index: props.index,
        wasDragPanEnabled,
      };
      map.getCanvas().style.cursor = "grabbing";
    };

    const onMove = (e: maplibregl.MapMouseEvent) => {
      const drag = draggingRef.current;
      if (!drag) return;
      usePolygons
        .getState()
        .moveVertex(drag.polyId, drag.index, {
          lat: e.lngLat.lat,
          lon: e.lngLat.lng,
        });
    };

    const stopDrag = () => {
      const drag = draggingRef.current;
      if (!drag) return;
      draggingRef.current = null;
      if (drag.wasDragPanEnabled) map.dragPan.enable();
      map.getCanvas().style.cursor = "";
    };

    const onVertexContext = (e: maplibregl.MapMouseEvent) => {
      if (!editing || drawing) return;
      const props = editPropsAt(map, e, [LYR_POLY_EDIT_VERTICES]);
      if (!props) return;
      e.preventDefault();
      e.originalEvent.preventDefault();
      usePolygons.getState().deleteVertex(props.polyId, props.index);
    };

    const onMidpointClick = (e: maplibregl.MapMouseEvent) => {
      if (!editing || drawing) return;
      const props = editPropsAt(map, e, [LYR_POLY_EDIT_MIDPOINTS]);
      if (!props) return;
      e.preventDefault();
      e.originalEvent.preventDefault();
      usePolygons.getState().insertVertex(props.polyId, props.index, {
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
      });
    };

    map.on("mouseenter", LYR_POLY_EDIT_VERTICES, setPointer);
    map.on("mouseenter", LYR_POLY_EDIT_MIDPOINTS, setPointer);
    map.on("mouseleave", LYR_POLY_EDIT_VERTICES, clearPointer);
    map.on("mouseleave", LYR_POLY_EDIT_MIDPOINTS, clearPointer);
    map.on("mousedown", LYR_POLY_EDIT_VERTICES, onVertexDown);
    map.on("contextmenu", LYR_POLY_EDIT_VERTICES, onVertexContext);
    map.on("click", LYR_POLY_EDIT_MIDPOINTS, onMidpointClick);
    map.on("mousemove", onMove);
    map.on("mouseup", stopDrag);

    return () => {
      map.off("mouseenter", LYR_POLY_EDIT_VERTICES, setPointer);
      map.off("mouseenter", LYR_POLY_EDIT_MIDPOINTS, setPointer);
      map.off("mouseleave", LYR_POLY_EDIT_VERTICES, clearPointer);
      map.off("mouseleave", LYR_POLY_EDIT_MIDPOINTS, clearPointer);
      map.off("mousedown", LYR_POLY_EDIT_VERTICES, onVertexDown);
      map.off("contextmenu", LYR_POLY_EDIT_VERTICES, onVertexContext);
      map.off("click", LYR_POLY_EDIT_MIDPOINTS, onMidpointClick);
      map.off("mousemove", onMove);
      map.off("mouseup", stopDrag);
      stopDrag();
    };
  }, [drawing, editing, map, styleReady]);

  return null;
}

function editPropsAt(
  map: maplibregl.Map,
  e: maplibregl.MapMouseEvent,
  layers: string[],
): { polyId: string; index: number } | null {
  return firstEditProps(map.queryRenderedFeatures(e.point, { layers }));
}

function firstEditProps(
  features: maplibregl.MapGeoJSONFeature[] | undefined,
): { polyId: string; index: number } | null {
  const props = features?.[0]?.properties as EditFeatureProps | undefined;
  if (typeof props?.polyId !== "string") return null;
  const index =
    typeof props.index === "number" ? props.index : Number(props.index);
  if (!Number.isInteger(index)) return null;
  return { polyId: props.polyId, index };
}
