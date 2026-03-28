import type { AddressRecord, LetterGrade } from "../addresses/types";
import { gradeToScore, scoreToGrade } from "../../lib/rating-colors";

/** Minimum rated addresses before showing a neighborhood letter grade. */
export const MIN_RATED_ADDRESSES_FOR_ROLLUP = 3;

export type NeighborhoodRollup = {
  neighborhoodId: string;
  /** Mean of rated addresses → letter; null if insufficient rated count. */
  grade: LetterGrade | null;
  ratedCount: number;
  unratedCount: number;
  totalEngagement: number;
};

/**
 * Rollup rule (v1): map grades to scores A=6..F=1, mean of **rated** addresses only,
 * round to nearest integer score → letter. Ungraded addresses excluded from mean.
 * If ratedCount < MIN_RATED_ADDRESSES_FOR_ROLLUP, grade is null (insufficient data).
 */
export function computeNeighborhoodRollups(
  addresses: AddressRecord[],
  neighborhoodIds: string[],
): Map<string, NeighborhoodRollup> {
  const byNb = new Map<
    string,
    { rated: LetterGrade[]; unrated: number; engagement: number }
  >();

  for (const id of neighborhoodIds) {
    byNb.set(id, { rated: [], unrated: 0, engagement: 0 });
  }

  for (const a of addresses) {
    if (!a.neighborhoodId || !byNb.has(a.neighborhoodId)) continue;
    const bucket = byNb.get(a.neighborhoodId)!;
    bucket.engagement += a.engagementCount;
    if (a.grade === null) bucket.unrated += 1;
    else bucket.rated.push(a.grade);
  }

  const out = new Map<string, NeighborhoodRollup>();
  for (const id of neighborhoodIds) {
    const b = byNb.get(id)!;
    const ratedCount = b.rated.length;
    let grade: LetterGrade | null = null;
    if (ratedCount >= MIN_RATED_ADDRESSES_FOR_ROLLUP) {
      const mean =
        b.rated.reduce((s, g) => s + gradeToScore(g), 0) / ratedCount;
      grade = scoreToGrade(mean);
    }
    out.set(id, {
      neighborhoodId: id,
      grade,
      ratedCount,
      unratedCount: b.unrated,
      totalEngagement: b.engagement,
    });
  }
  return out;
}
