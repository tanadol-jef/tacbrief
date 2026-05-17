import {
  Circle,
  Download,
  Film,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef } from "react";
import { replayBounds, useRecording } from "../store/recordingStore";

export default function RecordingControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    recording,
    samples,
    imported,
    replayMode,
    replayPlaying,
    replayTime,
    startRecording,
    stopRecording,
    clearRecording,
    exportFile,
    importFromFile,
    clearImported,
    setReplayMode,
    playReplay,
    pauseReplay,
    seekReplay,
  } = useRecording();

  const hasSamples = samples.length > 0;
  const dur = hasSamples ? samples[samples.length - 1].t - samples[0].t : 0;
  const replayDur = replayBounds(imported).duration;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => (recording ? stopRecording() : startRecording())}
        title={recording ? "Stop recording" : "Start recording"}
        className={`flex h-8 w-8 items-center justify-center rounded ring-1 ${
          recording
            ? "bg-tac-danger/30 text-tac-danger ring-tac-danger/60 animate-pulse"
            : "ring-tac-border text-slate-300 hover:bg-tac-border/40"
        }`}
      >
        {recording ? <Square size={12} /> : <Circle size={12} fill="currentColor" />}
      </button>
      {hasSamples && (
        <span className="font-mono text-[10px] text-slate-400">
          {samples.length} pts · {formatDur(dur)}
        </span>
      )}
      <button
        onClick={exportFile}
        disabled={!hasSamples}
        title="Save recording to .json"
        className="flex h-8 w-8 items-center justify-center rounded ring-1 ring-tac-border text-slate-300 hover:bg-tac-border/40 disabled:opacity-30"
      >
        <Download size={12} />
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        title="Load recording (.json)"
        className={`flex h-8 w-8 items-center justify-center rounded ring-1 ${
          imported
            ? "bg-tac-accent/20 text-tac-accent ring-tac-accent/50"
            : "ring-tac-border text-slate-300 hover:bg-tac-border/40"
        }`}
      >
        <Upload size={12} />
      </button>
      {(hasSamples || imported) && (
        <button
          onClick={() => {
            if (hasSamples) clearRecording();
            if (imported) clearImported();
          }}
          title="Clear recording / loaded track"
          className="flex h-8 w-8 items-center justify-center rounded text-slate-400 ring-1 ring-tac-border hover:text-tac-danger"
        >
          <Trash2 size={12} />
        </button>
      )}
      {imported && (
        <>
          <button
            onClick={() => setReplayMode(!replayMode)}
            title={replayMode ? "Exit replay mode" : "Enter replay mode"}
            className={`flex h-8 items-center gap-1 rounded px-2 ring-1 ${
              replayMode
                ? "bg-tac-accent/20 text-tac-accent ring-tac-accent/60"
                : "ring-tac-border text-slate-300 hover:bg-tac-border/40"
            }`}
          >
            <Film size={12} />
            <span className="text-xs">Replay</span>
          </button>
          {replayMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => (replayPlaying ? pauseReplay() : playReplay())}
                title={replayPlaying ? "Pause replay" : "Play replay"}
                className="flex h-7 w-7 items-center justify-center rounded bg-tac-accent/20 text-tac-accent ring-1 ring-tac-accent/40 hover:bg-tac-accent/40"
              >
                {replayPlaying ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <button
                onClick={() => {
                  pauseReplay();
                  seekReplay(0);
                }}
                title="Replay to t=0"
                className="flex h-7 w-7 items-center justify-center rounded text-slate-300 ring-1 ring-tac-border hover:bg-tac-border/40"
              >
                <RotateCcw size={12} />
              </button>
              <span className="font-mono text-[10px] text-tac-accent">
                {formatDur(replayTime)} / {formatDur(replayDur)}
              </span>
              <input
                type="range"
                min={0}
                max={replayDur || 0}
                step={0.1}
                value={replayTime}
                onChange={(e) => seekReplay(parseFloat(e.target.value))}
                className="h-1.5 w-40 cursor-pointer appearance-none rounded bg-tac-border accent-tac-accent"
              />
            </div>
          )}
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const ok = await importFromFile(f);
          if (!ok) alert("Failed to import — wrong format or version.");
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
    </div>
  );
}

function formatDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
