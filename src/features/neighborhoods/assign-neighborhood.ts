import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { AddressRecord } from "../addresses/types";

export type NeighborhoodFeature = Feature<
  Polygon | MultiPolygon,
  { id: string; name: string }
>;

export function assignNeighborhoodIds(
  addresses: AddressRecord[],
  neighborhoods: FeatureCollection<Polygon | MultiPolygon, { id: string; name: string }>,
): AddressRecord[] {
  const feats = neighborhoods.features as NeighborhoodFeature[];
  return addresses.map((a) => {
    const pt = point([a.lng, a.lat]);
    for (const poly of feats) {
      if (booleanPointInPolygon(pt, poly)) {
        return { ...a, neighborhoodId: poly.properties.id };
      }
    }
    return { ...a, neighborhoodId: null };
  });
}
