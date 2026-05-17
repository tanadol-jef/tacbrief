# TacBrief

Tactical briefing visualization for fighter formations operating from Thai airbases. Self-hosted, 2D map-based, supports up to 4 aircraft with live turn-circle visualization (TAS / bank / G), pre-programmed maneuver sequences, formations, waypoints, polygon overlays (KMZ/KML import + export), measurement tools, and record / replay of simulated flights.

## Features

- Map (MapLibre GL): Dark / OSM / Satellite / Topo basemaps, optional OpenAIP aero overlay
- Up to 4 aircraft, RTAF presets (F-16A, Gripen C, T-50TH, F-5E, L-39, Custom)
- Live turn circles, heading vectors, 10-second trail (configurable)
- Maneuver sequence editor: Turn to heading, Set speed, Set altitude, Hold, Go to waypoint
- Waypoint manager with DD MM.MMM coordinate edit
- Independent and Linked formations (Line Abreast / Trail / Wedge / Echelon L/R / Finger Four / Box)
- Multiple ruler / protractor measurements with snap-to-aircraft (live + replay), realtime updates
- Polygon drawing + KMZ / KML import / export
- Record simulated flights, save / load `.json`, replay with dedicated play/pause and timeline scrubber
- Thailand airports (106) and runways (86) from OurAirports
- Magnetic declination via WMM (geomagnetism)
- Bundled JSON scenario export / import, polygons + settings autosave to localStorage
- "Sync edits" toggle to apply parameter changes to all aircraft at once

## Tech

- Vite 6 + React 19 + TypeScript
- MapLibre GL JS 5 (raster tiles)
- Zustand state, Tailwind v4
- Turf.js geo math, `geomagnetism` for magnetic declination
- JSZip for KMZ packaging

## Dev

```bash
npm install
npm run dev      # http://localhost:5173
```

Optional: refresh Thailand airport data from OurAirports

```bash
npm run build:airports
```

## Production build

```bash
npm run build
npm run preview  # http://localhost:4173
```

## Deploy on TrueNAS via Dockge

1. **In Dockge**, create a new stack named `tacbrief`.
2. Paste the contents of `docker-compose.yml`:

   ```yaml
   services:
     tacbrief:
       build: .
       image: tacbrief:latest
       container_name: tacbrief
       ports:
         - "8080:80"
       restart: unless-stopped
   ```

3. **Provide the build context** (Dockge needs the source to run `build:`). Two options:
   - **Clone the repo on the host** into the stack directory Dockge created (typically `/mnt/.../stacks/tacbrief`), or
   - **Pre-build the image** elsewhere and replace `build: .` with `image: tacbrief:latest` referencing a pushed image.
4. Click **Deploy**. Open `http://<truenas-host>:8080`.

The image is a multi-stage build: `node:20-alpine` produces the `dist/`, then `nginx:alpine` serves it with gzip and SPA-style `try_files` fallback. Final image is ~25 MB.

## Conventions

- Headings: magnetic (°M). Stored true internally, converted at the UI boundary via WMM.
- Coordinates: DD MM.MMM with hemisphere letter (e.g., `N 13° 54.567'  E 100° 36.234'`).
- Units: Speed = knots, Altitude = feet, Distance = nm/ft, Heading = degrees.
- Time engine: real-time at 1× speed, fixed-step integrator (no scrubbing for live sim — use record + replay for that).

## License

Private project.
