import { useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import BaseSelector from "./BaseSelector";
import PlayBar from "./PlayBar";
import ImportExport from "./ImportExport";
import RecordingControls from "./RecordingControls";
import SettingsPanel from "./SettingsPanel";
import { useMapStore } from "../store/mapStore";
import { useScenario } from "../store/scenarioStore";
import { useSettings } from "../store/settingsStore";
import { trueToMag } from "../lib/magnetic";

export default function TopBar() {
  const [baseIcao, setBaseIcao] = useState<string | null>(null);
  const requestFlyTo = useMapStore((s) => s.requestFlyTo);
  const { aircraft, update, selectedId } = useScenario();
  const sidebarHidden = useSettings((s) => s.sidebarHidden);
  const toggleSidebar = useSettings((s) => s.toggleSidebar);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-tac-border bg-tac-panel px-4 text-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          title={`${sidebarHidden ? "Show" : "Hide"} sidebar (Ctrl+B)`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-300 ring-1 ring-tac-border hover:bg-tac-border/40"
        >
          {sidebarHidden ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-tac-accent">✦</span>
          <span className="font-semibold tracking-wide">TacBrief</span>
          <span className="text-slate-500">v1.0.3</span>
        </div>
        <PlayBar />
        <span className="text-slate-600">|</span>
        <RecordingControls />
      </div>
      <div className="flex items-center gap-3 text-slate-400">
        <SettingsPanel />
        <ImportExport />
        <span className="text-slate-500">|</span>
        <span>Base:</span>
        <BaseSelector
          value={baseIcao}
          onChange={(icao, ap, spawn) => {
            setBaseIcao(icao);
            requestFlyTo(ap.lat, ap.lon, 11);
            // Spawn the selected aircraft on the runway, heading aligned to it.
            const target = aircraft.find((a) => a.id === selectedId);
            if (!target) return;
            const headingMag =
              spawn.hdgTrue != null
                ? trueToMag(spawn.hdgTrue, spawn.lat, spawn.lon)
                : target.headingMagDeg;
            update(target.id, {
              position: { lat: spawn.lat, lon: spawn.lon },
              headingMagDeg: headingMag,
              altitudeFt: ap.elevFt ?? target.altitudeFt,
            });
          }}
        />
      </div>
    </header>
  );
}
