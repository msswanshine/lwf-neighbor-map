import type { AddressRecord } from "../addresses/types";
import { abShareToWashTier, type MapWashTier } from "../../lib/map-ab-share-wash";

/** Same A/B share rule as city summary: % of sites graded A or B in this evacuation zone. */
export function tierForNeighborhood(
  neighborhoodId: string,
  addresses: AddressRecord[],
): MapWashTier {
  const inNb = addresses.filter((a) => a.neighborhoodId === neighborhoodId);
  const total = inNb.length;
  const abCount = inNb.filter((a) => a.grade === "A" || a.grade === "B").length;
  const pct = total ? (abCount / total) * 100 : 0;
  return abShareToWashTier(pct);
}
