# Phase 11 — Deployment

**Shipped:** 2026-05-18

## Goal

Containerize the SPA and run it on the user's TrueNAS box under Dockge, with the source private on GitHub.

## What landed

- Multi-stage `Dockerfile`:
  - Stage 1: `node:20-alpine` builds the Vite bundle.
  - Stage 2: `nginx:alpine` serves `dist/` with gzip and SPA `try_files` fallback.
- `nginx.conf` tuned for an SPA: long-cache assets, fallback to `index.html`.
- `docker-compose.yml`:
  - `build: .` (local-build only).
  - `image: tacbrief:latest`, `pull_policy: build` so Dockge's Update button doesn't try to pull from a registry.
  - Host port **8090** → container **80**.
  - `restart: unless-stopped`.
- Private GitHub repo `tanadol-jef/tacbrief`, pushed via `gh repo create`.
- Initial deploy on TrueNAS:
  1. `git clone` into Dockge's stacks directory using a fine-grained PAT (or SSH).
  2. Dockge picks up the stack on refresh; **Deploy** triggers the first build.
  3. App at `http://<truenas>:8090`.

## Bug fixes during this phase

- **Basemap switch wiped aircraft** — MapLibre `setStyle()` removes all sources/layers/images, and the re-add chain raced the async SVG icon load. Refactored `MapView` to use `RasterTileSource.setTiles([...])` to swap basemap tiles without touching any other layer. Overlay (OpenAIP) is added/removed by source+layer manipulation instead of `setStyle`.
- **Port collision** — Dockge initial deploy reported `0.0.0.0:8080` already bound on the host. Default port moved to 8090.
- **Pull denied** — Dockge's default Update path runs `compose pull` first. Added `pull_policy: build` to skip pulling for this image.

## Update procedure

```bash
cd "/mnt/<pool>/dockge/stacks/tacbrief"
git pull
docker compose up -d --build
```

Or in Dockge UI: **Update** (after the `pull_policy: build` fix, this just builds).

## Key files

- `Dockerfile`, `nginx.conf`, `docker-compose.yml`
- `README.md` deployment section
- `.gitignore`, `.dockerignore`
