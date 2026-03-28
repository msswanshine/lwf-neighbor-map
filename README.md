# Neighbor map — Ashland fire preparedness (demo)

Vite + React + TypeScript + Tailwind, MapLibre + [Overture Maps](https://overturemaps.org/) (PMTiles), mock addresses with A–F grades and neighborhood rollups.

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Data

- **Neighborhood polygons:** [`public/data/neighborhoods-ashland.geojson`](public/data/neighborhoods-ashland.geojson) — placeholder quadrants for development. Replace with Jackson County / City of Ashland open-data boundaries when available; keep `properties.id` and `properties.name`.
- **Overture tiles:** Release URL is pinned in [`src/config/regions.ts`](src/config/regions.ts). Update if AWS URLs change; see [Overture docs](https://docs.overturemaps.org/).
- **Grades** persist in the browser (`localStorage` key `fire-prep-addresses-v1`).

## Rollup rule

Neighborhood letter grade = rounded mean of numeric scores (A=6 … F=1) over **graded** addresses in that polygon, only if there are at least **3** graded addresses; otherwise the UI shows “Insufficient data.”
