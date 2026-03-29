export type LetterGrade = "A" | "B" | "C" | "D" | "E" | "F";

/** Who registered the site (reporting / filtering). */
export type ParticipantType =
  | "residential"
  | "business"
  | "institution"
  | "hoa";

export const PARTICIPANT_LABELS: Record<ParticipantType, string> = {
  residential: "Home / residential",
  business: "Business",
  institution: "Institution",
  hoa: "HOA",
};

export const PARTICIPANT_ORDER: ParticipantType[] = [
  "residential",
  "business",
  "institution",
  "hoa",
];

/** Tool used to assess / improve fire risk for the property. */
export type FireAssessmentTool =
  | "Firewise Certification."
  | "Living With Fire App"
  | "Other";

export const FIRE_ASSESSMENT_TOOL_ORDER: FireAssessmentTool[] = [
  "Firewise Certification.",
  "Living With Fire App",
  "Other",
];

export type AddressRecord = {
  id: string;
  /** Optional assessor / parcel key when ingested from open data. */
  parcelId?: string;
  /** Uppercased normalized mailing address for matching. */
  normalizedAddress?: string;
  lat: number;
  lng: number;
  label: string;
  street?: string;
  participantType: ParticipantType;
  grade: LetterGrade | null;
  engagementCount: number;
  assessmentTool: FireAssessmentTool;
  neighborhoodId: string | null;
};

export type AddressPersisted = Omit<AddressRecord, "neighborhoodId">;
