import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { DataDrivenPropertyValueSpecification, Map as MaplibreMap } from "maplibre-gl";
import {
  type MapWashTier,
  MAP_WASH_OVERLAY_LINE_HEX,
  MAP_WASH_SWATCH_HEX,
} from "../lib/map-ab-share-wash";

export const NEIGHBORHOODS_SOURCE_ID = "neighborhoods-overlay";
export const NEIGHBORHOODS_FILL_LAYER_ID = "neighborhoods-overlay-fill";
export const NEIGHBORHOODS_LINE_LAYER_ID = "neighborhoods-overlay-line";

export type NeighborhoodGeoJson = FeatureCollection<
  Polygon | MultiPolygon,
  { id: string; name: string; washTier: MapWashTier } & Record<string, unknown>
>;

/** Tier → color: expression is fixed so only GeoJSON `washTier` must change on setData (no paint swaps). */
function fillColorMatchByWashTier(): DataDrivenPropertyValueSpecification<string> {
  const expr: unknown[] = ["match", ["to-string", ["get", "washTier"]]];
  for (const tier of ["red", "orange", "yellow", "green"] as MapWashTier[]) {
    expr.push(tier, MAP_WASH_SWATCH_HEX[tier]);
  }
  expr.push("#94a3b8");
  return expr as DataDrivenPropertyValueSpecification<string>;
}

function lineColorMatchByWashTier(): DataDrivenPropertyValueSpecification<string> {
  const expr: unknown[] = ["match", ["to-string", ["get", "washTier"]]];
  for (const tier of ["red", "orange", "yellow", "green"] as MapWashTier[]) {
    expr.push(tier, MAP_WASH_OVERLAY_LINE_HEX[tier]);
  }
  expr.push("#64748b");
  return expr as DataDrivenPropertyValueSpecification<string>;
}

export const NEIGHBORHOOD_FILL_COLOR_EXPR = fillColorMatchByWashTier();

export const NEIGHBORHOOD_LINE_COLOR_EXPR = lineColorMatchByWashTier();

export function addNeighborhoodOverlayLayers(
  map: MaplibreMap,
  data: NeighborhoodGeoJson,
  beforeLayerId: string,
): void {
  map.addSource(NEIGHBORHOODS_SOURCE_ID, {
    type: "geojson",
    data,
    /** Stable feature ids help the worker re-bake tiles when properties (washTier) change. */
    promoteId: "id",
  });
  map.addLayer(
    {
      id: NEIGHBORHOODS_FILL_LAYER_ID,
      type: "fill",
      source: NEIGHBORHOODS_SOURCE_ID,
      paint: {
        "fill-color": NEIGHBORHOOD_FILL_COLOR_EXPR,
        "fill-opacity": 0.22,
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
        "line-color": NEIGHBORHOOD_LINE_COLOR_EXPR,
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
    ["==", ["to-string", ["get", "id"]], sid],
    0.4,
    0.22,
  ];
}

export function neighborhoodSelectionLineWidth(
  selectedNeighborhoodId: string | null,
): DataDrivenPropertyValueSpecification<number> {
  const sid = selectedNeighborhoodId ?? "__none__";
  return [
    "case",
    ["==", ["to-string", ["get", "id"]], sid],
    2.8,
    1.25,
  ];
}

export function neighborhoodSelectionLineOpacity(
  selectedNeighborhoodId: string | null,
): DataDrivenPropertyValueSpecification<number> {
  const sid = selectedNeighborhoodId ?? "__none__";
  return ["case", ["==", ["to-string", ["get", "id"]], sid], 1, 0.75];
}
