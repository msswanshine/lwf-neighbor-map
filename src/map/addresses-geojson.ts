import type { FeatureCollection, Feature, Point } from "geojson";
import type { AddressRecord } from "../features/addresses/types";
import { gradeToMapColor } from "../lib/rating-colors";

export function addressesToFeatureCollection(
  addresses: AddressRecord[],
): FeatureCollection<Point, { id: string; label: string; gradeColor: string }> {
  const features: Feature<
    Point,
    { id: string; label: string; gradeColor: string }
  >[] = addresses.map((a) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [a.lng, a.lat] },
    properties: {
      id: a.id,
      label: a.label,
      gradeColor: gradeToMapColor(a.grade),
    },
  }));
  return { type: "FeatureCollection", features };
}
