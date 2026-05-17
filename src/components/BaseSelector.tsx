import { useEffect, useMemo, useState } from "react";
import { loadAirports, loadRunways, type Airport } from "../lib/airports";

type Props = {
  value: string | null;
  onChange: (icao: string, airport: Airport, spawn: { lat: number; lon: number; hdgTrue: number | null }) => void;
};

const RTAF_PRIORITY = [
  "VTBU", // Takhli, Wing 4
  "VTUN", // Korat, Wing 1
  "VTSB", // Surat Thani, Wing 7
  "VTUW", // Nakhon Phanom, Wing 23 (Udon Thani currently)
  "VTUD", // Udon Thani, Wing 23
  "VTUI", // Sakon Nakhon
  "VTBI", // Trat
  "VTBD", // Don Mueang (RTAF Wing 6)
  "VTBL", // Khok Kathiam (Lopburi)
  "VTSE", // Chumphon
  "VTBO", // U-Tapao
  "VTBS", // Suvarnabhumi
  "VTCC", // Chiang Mai
  "VTSP", // Phuket
  "VTSS", // Hat Yai
];

export default function BaseSelector({ value, onChange }: Props) {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [runwayMidByIcao, setRunwayMidByIcao] = useState<
    Map<string, { lat: number; lon: number; hdgTrue: number | null }>
  >(new Map());

  useEffect(() => {
    Promise.all([loadAirports(), loadRunways()]).then(([aps, rws]) => {
      setAirports(aps);
      const m = new Map<
        string,
        { lat: number; lon: number; hdgTrue: number | null }
      >();
      for (const r of rws) {
        if (m.has(r.icao)) continue;
        m.set(r.icao, {
          lat: (r.le.lat + r.he.lat) / 2,
          lon: (r.le.lon + r.he.lon) / 2,
          hdgTrue: r.le.hdgTrue,
        });
      }
      setRunwayMidByIcao(m);
    });
  }, []);

  const sorted = useMemo(() => {
    const prio = new Map(RTAF_PRIORITY.map((k, i) => [k, i]));
    return [...airports].sort((a, b) => {
      const pa = prio.has(a.icao) ? prio.get(a.icao)! : 999;
      const pb = prio.has(b.icao) ? prio.get(b.icao)! : 999;
      if (pa !== pb) return pa - pb;
      return a.icao.localeCompare(b.icao);
    });
  }, [airports]);

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const icao = e.target.value;
        const ap = airports.find((a) => a.icao === icao);
        if (!ap) return;
        const spawn =
          runwayMidByIcao.get(icao) ?? {
            lat: ap.lat,
            lon: ap.lon,
            hdgTrue: null,
          };
        onChange(icao, ap, spawn);
      }}
      className="rounded bg-tac-bg px-2 py-1 text-xs text-slate-100 ring-1 ring-tac-border focus:outline-none"
    >
      <option value="">— Base —</option>
      {sorted.map((a) => (
        <option key={a.icao} value={a.icao}>
          {a.icao} · {a.name}
        </option>
      ))}
    </select>
  );
}
