/** Bounding box [westLng, southLat, eastLng, northLat] for initial map fit (WGS84). */
export const ASHLAND_BBOX: [number, number, number, number] = [
  -122.752, 42.165, -122.648, 42.225,
];

/** Overture PMTiles release — verify in https://docs.overturemaps.org/ if tiles 404. */
export const OVERTURE_RELEASE = "2024-08-20";

export const OVERTURE_TILES_BASE =
  "https://overturemaps-tiles-us-west-2-beta.s3.amazonaws.com";

export function overturePmtilesUrl(theme: string): string {
  return `${OVERTURE_TILES_BASE}/${OVERTURE_RELEASE}/${theme}.pmtiles`;
}
