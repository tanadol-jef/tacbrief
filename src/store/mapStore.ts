import { create } from "zustand";

type MapState = {
  flyTo: { lat: number; lon: number; zoom?: number } | null;
  requestFlyTo: (lat: number, lon: number, zoom?: number) => void;
  clearFlyTo: () => void;
};

export const useMapStore = create<MapState>((set) => ({
  flyTo: null,
  requestFlyTo: (lat, lon, zoom) => set({ flyTo: { lat, lon, zoom } }),
  clearFlyTo: () => set({ flyTo: null }),
}));
