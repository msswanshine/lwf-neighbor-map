# Neighbor map — Ashland fire preparedness (demo)

Vite + React + TypeScript + Tailwind, MapLibre + [Overture Maps](https://overturemaps.org/) (PMTiles), mock addresses with A–F grades and neighborhood rollups.

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Data

- **Parcel / address seed:** [`src/data/addresses-ashland-seed.json`](src/data/addresses-ashland-seed.json) — demo sites with `parcelId`, `normalizedAddress`, and `participantType`. The app always reads this bundled file (edit and refresh the dev server). In-app grade/participant tweaks are session-only and are not written back to disk or `localStorage`.
- **Neighborhood polygons:** [`public/data/neighborhoods-ashland.geojson`](public/data/neighborhoods-ashland.geojson) — placeholder quadrants. Replace with official boundaries; keep `properties.id` and `properties.name`.
- **Overture tiles:** Base, transportation, and **buildings** (footprints from zoom 15+) — release pinned in [`src/config/regions.ts`](src/config/regions.ts). See [Overture docs](https://docs.overturemaps.org/).
- Map: **zoom-based dot sizing**, **geolocate** control (browser permission), participant **filters** (ring color on dots matches type), **search**, auto **fit to filtered results**, **coverage table** + **CSV export**.

## Rollup rule

Neighborhood letter grade = rounded mean of numeric scores (A=6 … F=1) over **graded** addresses in that polygon, only if there are at least **3** graded addresses; otherwise the UI shows “Insufficient data.”
