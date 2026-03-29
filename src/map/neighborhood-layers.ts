import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { DataDrivenPropertyValueSpecification, Map as MaplibreMap } from "maplibre-gl";

export const NEIGHBORHOODS_SOURCE_ID = "neighborhoods-overlay";
export const NEIGHBORHOODS_FILL_LAYER_ID = "neighborhoods-overlay-fill";
export const NEIGHBORHOODS_LINE_LAYER_ID = "neighborhoods-overlay-line";

export type NeighborhoodGeoJson = FeatureCollection<
  Polygon | MultiPolygon,
  { id: string; name: string }
>;

export function addNeighborhoodOverlayLayers(
  map: MaplibreMap,
  data: NeighborhoodGeoJson,
  beforeLayerId: string,
): void {
  map.addSource(NEIGHBORHOODS_SOURCE_ID, {
    type: "geojson",
    data,
  });
  map.addLayer(
    {
      id: NEIGHBORHOODS_FILL_LAYER_ID,
      type: "fill",
      source: NEIGHBORHOODS_SOURCE_ID,
      paint: {
        "fill-color": "#4f46e5",
        "fill-opacity": 0.08,
      },
    },
    beforeLayerId,
  );
  map.addLayer(
    {
      id: NEIGHBORHOODS_LINE_LAYER_ID,
      type: "line",
      source: NEIGHBORHOODS_SOURCE_ID,
      paint: {
        "line-color": "#3730a3",
        "line-opacity": 0.85,
        "line-width": 1.25,
      },
    },
    beforeLayerId,
  );
}

export function neighborhoodSelectionFillOpacity(
  selectedNeighborhoodId: string | null,
): DataDrivenPropertyValueSpecification<number> {
  const sid = selectedNeighborhoodId ?? "__none__";
  return [
    "case",
    ["==", ["get", "id"], sid],
    0.2,
    0.07,
  ];
}

export function neighborhoodSelectionLineWidth(
  selectedNeighborhoodId: string | null,
): DataDrivenPropertyValueSpecification<number> {
  const sid = selectedNeighborhoodId ?? "__none__";
  return ["case", ["==", ["get", "id"], sid], 2.8, 1.25];
}

export function neighborhoodSelectionLineOpacity(
  selectedNeighborhoodId: string | null,
): DataDrivenPropertyValueSpecification<number> {
  const sid = selectedNeighborhoodId ?? "__none__";
  return ["case", ["==", ["get", "id"], sid], 1, 0.75];
}
