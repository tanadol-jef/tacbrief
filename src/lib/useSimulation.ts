import { useEffect, useRef } from "react";
import { useScenario } from "../store/scenarioStore";
import { useRecording } from "../store/recordingStore";

const MAX_DT = 0.1; // s — cap to avoid jumps after tab inactive

export function useSimulation() {
  const simPlaying = useScenario((s) => s.playing);
  const replayPlaying = useRecording((s) => s.replayPlaying);
  const tick = useScenario((s) => s.tick);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const anyPlaying = simPlaying || replayPlaying;

  useEffect(() => {
    if (!anyPlaying) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
      return;
    }
    const loop = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = Math.min(MAX_DT, (now - lastRef.current) / 1000);
      lastRef.current = now;
      if (dt > 0) {
        const rec = useRecording.getState();
        if (rec.replayMode && rec.replayPlaying && rec.imported) {
          rec.advanceReplay(dt);
        }
        if (useScenario.getState().playing) {
          tick(dt);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
    };
  }, [anyPlaying, tick]);
}
