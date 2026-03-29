# Neighbor map — Ashland fire preparedness (demo)

Vite + React + TypeScript + Tailwind, MapLibre + [Overture Maps](https://overturemaps.org/) (PMTiles), mock addresses with A–F grades and **evacuation zone** rollups.

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Data

- **Parcel / address seed:** [`src/data/addresses-ashland-seed.json`](src/data/addresses-ashland-seed.json) — demo sites with `parcelId`, `normalizedAddress`, and `participantType`. The app always reads this bundled file (edit and refresh the dev server). In-app grade/participant tweaks are session-only and are not written back to disk or `localStorage`.
- **Evacuation zone polygons:** [`public/data/evac-zones-ashland.geojson`](public/data/evac-zones-ashland.geojson) — official Ashland evacuation zone boundaries from the City’s EvacZones ArcGIS feature service (same source as the [Zone Lookup](https://ashlandgis.maps.arcgis.com/apps/instant/lookup/index.html?appid=192bced74b664595abd59ab1ea5a7c39) app). Each feature has `properties.id` (stable id e.g. `ash-evac-001`) and `properties.name`. Regenerate with:
  ```bash
  npm run build:evac-zones
  ```
  Attribution and terms are noted in the GeoJSON `attribution` property; use for informational purposes per City of Ashland GIS.
- **Legacy neighborhood build (optional):** [`scripts/build-neighborhoods-ashland.py`](scripts/build-neighborhoods-ashland.py) outputs [`public/data/neighborhoods-ashland.geojson`](public/data/neighborhoods-ashland.geojson) (Voronoi / OSM experiment). The app loads **evac zones** by default, not this file.
- **Overture tiles:** Base, transportation, and **buildings** (footprints from zoom 15+) — release pinned in [`src/config/regions.ts`](src/config/regions.ts). See [Overture docs](https://docs.overturemaps.org/).
- Map: **zoom-based dot sizing**, **geolocate** control (browser permission), participant **filters** (ring color on dots matches type), **search**, auto **fit to filtered results**, **coverage table** + **CSV export**.

## Rollup rule

Zone letter grade = rounded mean of numeric scores (A=6 … F=1) over **graded** addresses in that polygon, only if there are at least **3** graded addresses; otherwise the UI shows “Insufficient data.”
