export type LetterGrade = "A" | "B" | "C" | "D" | "E" | "F";

export type AddressRecord = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  street?: string;
  grade: LetterGrade | null;
  engagementCount: number;
  neighborhoodId: string | null;
};

export type AddressPersisted = Omit<AddressRecord, "neighborhoodId">;
