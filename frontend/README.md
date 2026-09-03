# CityShield AI — Dashboard

React + Leaflet dashboard that subscribes to the backend's `/ws` feed and
shows live risk predictions on a schematic city map plus a scrolling event
feed.

## Setup

```bash
cd frontend
npm install
```

## Run

Start the backend first (`cd ../backend && uvicorn main:app --port 8000`),
then:

```bash
npm run dev
```

Open `http://localhost:5173`. With nothing streaming yet you'll see 4 empty
zone tiles and "Waiting for events…" — start the simulator
(`cd ../simulator && python simulate.py --interval 0.15 --shuffle --loop`) to
see it come alive.

## What it shows

- **Zone map** (`src/components/ZoneMap.jsx`) — a schematic (non-geographic)
  4-quadrant grid, one tile per `zone_id` from the dataset (`downtown`,
  `hospital_zone`, `residential`, `arterial_road`). Each tile is colored by
  the most recent prediction for that zone (green/amber/red = low/medium/
  high) and flashes briefly on a fresh event.
- **Event feed** (`src/components/EventFeed.jsx`) — the last 200 predictions
  received over `/ws`, newest first, color-coded by `risk_level`.
- **Stat bar** (`src/components/StatBar.jsx`) — WebSocket connection status,
  the backend's reported `model_mode` and `connected_dashboards` (both
  polled from `GET /health` every 4s), and running counts by risk level.

## Configuration

`src/config.js` hardcodes the backend at `127.0.0.1:8000` and the 4 zone
tiles' schematic grid positions. Edit it if the backend runs elsewhere or
the dataset's zone set changes.

## Notes

- The map is intentionally not a real-world Leaflet basemap — the dataset's
  zones (`downtown`, `hospital_zone`, etc.) aren't tied to real coordinates,
  so `react-leaflet` is used with `CRS.Simple` to lay them out as an
  abstract grid instead of implying a real location.
- The dashboard is read-only: it only ever receives broadcasts from
  `/ws`, matching the architecture (`simulator -> POST /ingest -> WebSocket
  -> dashboard`). It never calls `/predict` or `/ingest` itself.
- `npm audit` reports a moderate/high advisory in `esbuild`/`vite`'s dev
  server (fixable only via a breaking Vite 6→8 upgrade). It affects the
  local dev server only, not the built app, and this is a localhost demo —
  left as-is to avoid an unplanned major-version bump.
