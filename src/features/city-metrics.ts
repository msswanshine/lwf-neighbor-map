import type { AddressRecord } from "./addresses/types";
import type { NeighborhoodRollup } from "./neighborhoods/rollup";

export type NeighborhoodCoverage = {
  neighborhoodId: string;
  neighborhoodName: string;
  siteCount: number;
  /** Addresses with at least one engagement (proxy for opt-in / affiliate touch). */
  engagedCount: number;
  gradedCount: number;
  /** engagedCount / siteCount, 0–1 */
  engagementRate: number;
  /** gradedCount / siteCount, 0–1 */
  gradedRate: number;
  rollup: NeighborhoodRollup | null;
};

function safeRate(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.round((num / den) * 1000) / 1000;
}

export function computeNeighborhoodCoverage(
  addresses: AddressRecord[],
  neighborhoodNames: Map<string, string>,
  rollups: Map<string, NeighborhoodRollup>,
  neighborhoodIds: string[],
): NeighborhoodCoverage[] {
  return neighborhoodIds.map((neighborhoodId) => {
    const inNb = addresses.filter((a) => a.neighborhoodId === neighborhoodId);
    const siteCount = inNb.length;
    const engagedCount = inNb.filter((a) => a.engagementCount > 0).length;
    const gradedCount = inNb.filter((a) => a.grade !== null).length;
    return {
      neighborhoodId,
      neighborhoodName: neighborhoodNames.get(neighborhoodId) ?? neighborhoodId,
      siteCount,
      engagedCount,
      gradedCount,
      engagementRate: safeRate(engagedCount, siteCount),
      gradedRate: safeRate(gradedCount, siteCount),
      rollup: rollups.get(neighborhoodId) ?? null,
    };
  });
}

export function coverageToCsv(rows: NeighborhoodCoverage[]): string {
  const header =
    "neighborhood_id,neighborhood_name,sites,engaged,graded,engagement_rate,graded_rate,rollup_grade";
  const lines = rows.map((r) =>
    [
      escapeCsv(r.neighborhoodId),
      escapeCsv(r.neighborhoodName),
      r.siteCount,
      r.engagedCount,
      r.gradedCount,
      r.engagementRate,
      r.gradedRate,
      r.rollup?.grade ?? "",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function addressesToSnapshotCsv(
  rows: {
    id: string;
    parcelId?: string;
    normalizedAddress?: string;
    street?: string;
    neighborhoodName: string;
    participantType: string;
    grade: string;
    engagementCount: number;
    assessmentTool: string;
  }[],
): string {
  const header =
    "id,parcel_id,normalized_address,street,neighborhood,participant_type,grade,engagement_count,assessment_tool";
  const lines = rows.map((r) =>
    [
      escapeCsv(r.id),
      escapeCsv(r.parcelId ?? ""),
      escapeCsv(r.normalizedAddress ?? ""),
      escapeCsv(r.street ?? ""),
      escapeCsv(r.neighborhoodName),
      escapeCsv(r.participantType),
      r.grade,
      r.engagementCount,
      escapeCsv(r.assessmentTool),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
