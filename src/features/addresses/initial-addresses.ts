import type { AddressPersisted, ParticipantType } from "./types";
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
};

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
  }));
}
