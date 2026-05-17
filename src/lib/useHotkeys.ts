import { useEffect } from "react";
import { useScenario } from "../store/scenarioStore";
import type { AircraftId } from "../types";

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable
  );
}

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const { aircraft, select, playing, play, pause } = useScenario.getState();

      if (e.code === "Space") {
        e.preventDefault();
        if (playing) pause();
        else play();
        return;
      }

      if (["1", "2", "3", "4"].includes(e.key)) {
        const id = parseInt(e.key, 10) as AircraftId;
        if (aircraft.some((a) => a.id === id)) {
          select(id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
