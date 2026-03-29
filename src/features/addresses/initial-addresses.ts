import {
  FIRE_ASSESSMENT_TOOL_ORDER,
  type AddressPersisted,
  type FireAssessmentTool,
  type ParticipantType,
} from "./types";
import seedJson from "../../data/addresses-ashland-seed.json";

type SeedRow = {
  id: string;
  parcelId?: string;
  normalizedAddress?: string;
  lat: number;
  lng: number;
  label: string;
  street?: string;
  participantType?: ParticipantType;
  grade: AddressPersisted["grade"];
  engagementCount: number;
  assessmentTool?: FireAssessmentTool;
  criticalErrors?: string[];
  "critical errors"?: string[];
};

function isFireAssessmentTool(x: unknown): x is FireAssessmentTool {
  return (
    x === "Firewise Certification." ||
    x === "Living With Fire App" ||
    x === "Other"
  );
}

/** Demo sites approximated in Ashland; replace JSON with real parcel export when available. */
export function getBundledSeedAddresses(): AddressPersisted[] {
  const rows = seedJson as SeedRow[];
  return rows.map((r) => ({
    id: r.id,
    parcelId: r.parcelId,
    normalizedAddress: r.normalizedAddress,
    lat: r.lat,
    lng: r.lng,
    label: r.label,
    street: r.street,
    participantType: r.participantType ?? "residential",
    grade: r.grade,
    engagementCount: r.engagementCount,
    assessmentTool: isFireAssessmentTool(r.assessmentTool)
      ? r.assessmentTool
      : FIRE_ASSESSMENT_TOOL_ORDER[0],
    criticalErrors: (() => {
      const v =
        r.criticalErrors !== undefined
          ? r.criticalErrors
          : r["critical errors"];
      return Array.isArray(v) ? v : [];
    })(),
  }));
}
