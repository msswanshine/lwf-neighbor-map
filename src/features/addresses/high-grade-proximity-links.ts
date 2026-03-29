import type { Feature, FeatureCollection, LineString } from "geojson";
import type { AddressRecord } from "./types";

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(
  a: Pick<AddressRecord, "lat" | "lng">,
  b: Pick<AddressRecord, "lat" | "lng">,
): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lng - a.lng) * toRad;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const GRADE_B_OR_ABOVE = new Set(["A", "B"]);

function isGradeBOrAbove(grade: AddressRecord["grade"]): grade is "A" | "B" {
  return grade !== null && GRADE_B_OR_ABOVE.has(grade);
}

/** Unordered pairs within `maxDistanceM` where both addresses have grade A or B. */
export function buildHighGradeProximityLinks(
  addresses: AddressRecord[],
  maxDistanceM = 1000,
): FeatureCollection<LineString> {
  const qualified = addresses.filter((a) => isGradeBOrAbove(a.grade));
  const features: Feature<LineString>[] = [];
  for (let i = 0; i < qualified.length; i++) {
    for (let j = i + 1; j < qualified.length; j++) {
      const p = qualified[i];
      const q = qualified[j];
      if (haversineMeters(p, q) <= maxDistanceM) {
        features.push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [p.lng, p.lat],
              [q.lng, q.lat],
            ],
          },
        });
      }
    }
  }
  return { type: "FeatureCollection", features };
}
