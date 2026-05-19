import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type PanelKey,
  type PanelPos,
  useSettings,
} from "../store/settingsStore";

const VIEWPORT_MARGIN = 8;
const SNAP_PX = 12;

type BoundsMode = "viewport" | "offsetParent";

type Bounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type DraggablePanelOptions = {
  bounds?: BoundsMode;
};

function boundsFor(el: HTMLElement | null, mode: BoundsMode): Bounds {
  if (typeof window === "undefined") {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  if (mode === "offsetParent" && el?.offsetParent instanceof HTMLElement) {
    const rect = el.offsetParent.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function clamp(
  pos: PanelPos,
  width: number,
  height: number,
  bounds: Bounds,
): PanelPos {
  return {
    x: Math.min(
      Math.max(VIEWPORT_MARGIN, pos.x),
      Math.max(VIEWPORT_MARGIN, bounds.width - width - VIEWPORT_MARGIN),
    ),
    y: Math.min(
      Math.max(VIEWPORT_MARGIN, pos.y),
      Math.max(VIEWPORT_MARGIN, bounds.height - height - VIEWPORT_MARGIN),
    ),
  };
}

function snap(
  pos: PanelPos,
  width: number,
  height: number,
  bounds: Bounds,
): PanelPos {
  let next = clamp(pos, width, height, bounds);
  const right = bounds.width - (next.x + width);
  const bottom = bounds.height - (next.y + height);
  if (next.x - VIEWPORT_MARGIN <= SNAP_PX) next = { ...next, x: VIEWPORT_MARGIN };
  if (next.y - VIEWPORT_MARGIN <= SNAP_PX) next = { ...next, y: VIEWPORT_MARGIN };
  if (right - VIEWPORT_MARGIN <= SNAP_PX) {
    next = { ...next, x: bounds.width - width - VIEWPORT_MARGIN };
  }
  if (bottom - VIEWPORT_MARGIN <= SNAP_PX) {
    next = { ...next, y: bounds.height - height - VIEWPORT_MARGIN };
  }
  return clamp(next, width, height, bounds);
}

function shouldIgnoreDrag(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("button,input,select,textarea,a,[data-no-drag]"))
  );
}

export function useDraggablePanel(
  key: PanelKey,
  options: DraggablePanelOptions = {},
) {
  const boundsMode = options.bounds ?? "viewport";
  const ref = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const pos = useSettings((s) => s.panelPositions[key]);
  const setPanelPos = useSettings((s) => s.setPanelPos);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!pos) return;
    const current = ref.current;
    const clampToCurrentBounds = () => {
      const rect = current?.getBoundingClientRect();
      if (!rect || !current) return;
      const next = clamp(
        pos,
        rect.width,
        rect.height,
        boundsFor(current, boundsMode),
      );
      if (next.x !== pos.x || next.y !== pos.y) setPanelPos(key, next);
    };
    window.addEventListener("resize", clampToCurrentBounds);

    let observer: ResizeObserver | null = null;
    if (
      typeof ResizeObserver !== "undefined" &&
      boundsMode === "offsetParent" &&
      current?.offsetParent instanceof HTMLElement
    ) {
      observer = new ResizeObserver(clampToCurrentBounds);
      observer.observe(current.offsetParent);
    }

    return () => {
      window.removeEventListener("resize", clampToCurrentBounds);
      observer?.disconnect();
    };
  }, [boundsMode, key, pos, setPanelPos]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || shouldIgnoreDrag(e.target)) return;
      const current = ref.current;
      const rect = current?.getBoundingClientRect();
      if (!rect || !current) return;
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();

      const move = (event: PointerEvent) => {
        const nextBounds = boundsFor(current, boundsMode);
        const next = clamp(
          {
            x: event.clientX - nextBounds.left - dragOffset.current.x,
            y: event.clientY - nextBounds.top - dragOffset.current.y,
          },
          rect.width,
          rect.height,
          nextBounds,
        );
        setPanelPos(key, next);
      };

      const up = (event: PointerEvent) => {
        setDragging(false);
        const nextBounds = boundsFor(current, boundsMode);
        const next = snap(
          {
            x: event.clientX - nextBounds.left - dragOffset.current.x,
            y: event.clientY - nextBounds.top - dragOffset.current.y,
          },
          rect.width,
          rect.height,
          nextBounds,
        );
        setPanelPos(key, next);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up, { once: true });
    },
    [boundsMode, key, setPanelPos],
  );

  const style: CSSProperties | undefined = pos
    ? {
        position: boundsMode === "viewport" ? "fixed" : "absolute",
        left: pos.x,
        top: pos.y,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  return { ref, dragging, onPointerDown, style };
}
