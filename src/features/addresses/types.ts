export type LetterGrade = "A" | "B" | "C" | "D" | "E" | "F";

/** Who registered the site (reporting / filtering). */
export type ParticipantType =
  | "residential"
  | "business"
  | "institution"
  | "hoa"
  | "property_manager";

export const PARTICIPANT_LABELS: Record<ParticipantType, string> = {
  residential: "Home / residential",
  business: "Business",
  institution: "Institution",
  hoa: "HOA",
  property_manager: "Property manager",
};

export const PARTICIPANT_ORDER: ParticipantType[] = [
  "residential",
  "business",
  "institution",
  "hoa",
  "property_manager",
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
  neighborhoodId: string | null;
};

export type AddressPersisted = Omit<AddressRecord, "neighborhoodId">;
