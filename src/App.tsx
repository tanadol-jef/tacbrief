import MapView from "./components/Map/MapView";
import SidePanel from "./components/Panel/SidePanel";
import TopBar from "./components/TopBar";
import { useSimulation } from "./lib/useSimulation";
import { useHotkeys } from "./lib/useHotkeys";

export default function App() {
  useSimulation();
  useHotkeys();
  return (
    <div
      className="flex flex-col overflow-hidden bg-tac-bg text-slate-100"
      style={{ height: "100vh", width: "100vw" }}
    >
      <TopBar />
      <div className="flex" style={{ flex: 1, minHeight: 0 }}>
        <SidePanel />
        <main
          className="relative"
          style={{ flex: 1, minHeight: 0, minWidth: 0 }}
        >
          <MapView />
        </main>
      </div>
    </div>
  );
}
