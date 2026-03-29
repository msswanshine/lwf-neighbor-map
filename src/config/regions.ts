import type { FeatureCollection, Polygon } from "geojson";

/** Bounding box [westLng, southLat, eastLng, northLat] for initial map fit (WGS84). */
export const ASHLAND_BBOX: [number, number, number, number] = [
  -122.752, 42.165, -122.648, 42.225,
];

/** Study-area rectangle as GeoJSON (city-wide A/B wash layer draws below zone fills). */
export function ashlandStudyAreaFeatureCollection(): FeatureCollection<Polygon> {
  const [w, s, e, n] = ASHLAND_BBOX;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s],
            ],
          ],
        },
      },
    ],
  };
}

/** Overture PMTiles release — verify in https://docs.overturemaps.org/ if tiles 404. */
export const OVERTURE_RELEASE = "2024-08-20";

export const OVERTURE_TILES_BASE =
  "https://overturemaps-tiles-us-west-2-beta.s3.amazonaws.com";

export function overturePmtilesUrl(theme: string): string {
  return `${OVERTURE_TILES_BASE}/${OVERTURE_RELEASE}/${theme}.pmtiles`;
}
