import type { AddressPersisted, LetterGrade, ParticipantType } from "./types";
import { getBundledSeedAddresses } from "./initial-addresses";

const STORAGE_KEY = "fire-prep-addresses-v2";
const LEGACY_STORAGE_KEY = "fire-prep-addresses-v1";

export type StoredShape = {
  addresses: AddressPersisted[];
};

function parseStored(raw: string | null): AddressPersisted[] | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as StoredShape;
    if (!j?.addresses || !Array.isArray(j.addresses)) return null;
    return j.addresses.map(migrateRow);
  } catch {
    return null;
  }
}

/** Ensures new fields exist when loading older saved rows. */
function migrateRow(
  row: Record<string, unknown>,
): AddressPersisted {
  return {
    id: String(row.id),
    parcelId:
      row.parcelId !== undefined ? String(row.parcelId) : undefined,
    normalizedAddress:
      row.normalizedAddress !== undefined
        ? String(row.normalizedAddress)
        : undefined,
    lat: Number(row.lat),
    lng: Number(row.lng),
    label: String(row.label ?? row.id),
    street: row.street !== undefined ? String(row.street) : undefined,
    participantType: isParticipantType(row.participantType)
      ? row.participantType
      : "residential",
    grade: row.grade === null || row.grade === undefined ? null : (row.grade as LetterGrade),
    engagementCount:
      typeof row.engagementCount === "number" ? row.engagementCount : 0,
  };
}

function isParticipantType(x: unknown): x is ParticipantType {
  return (
    x === "residential" ||
    x === "business" ||
    x === "institution" ||
    x === "hoa" ||
    x === "property_manager"
  );
}

function loadLegacyV1(): AddressPersisted[] | null {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { addresses?: Record<string, unknown>[] };
    if (!j?.addresses || !Array.isArray(j.addresses)) return null;
    return j.addresses.map(migrateRow);
  } catch {
    return null;
  }
}

export function loadAddressesFromStorage(): AddressPersisted[] {
  const fromDisk = parseStored(localStorage.getItem(STORAGE_KEY));
  if (fromDisk?.length) return fromDisk;
  const legacy = loadLegacyV1();
  if (legacy?.length) {
    saveAddressesToStorage(legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  }
  return getBundledSeedAddresses();
}

export function saveAddressesToStorage(addresses: AddressPersisted[]): void {
  const payload: StoredShape = { addresses };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function mergeGradeAndEngagement(
  persisted: AddressPersisted[],
  updates: {
    id: string;
    grade?: LetterGrade | null;
    engagementCount?: number;
    participantType?: ParticipantType;
  },
): AddressPersisted[] {
  return persisted.map((a) =>
    a.id === updates.id
      ? {
          ...a,
          ...(updates.grade !== undefined ? { grade: updates.grade } : {}),
          ...(updates.engagementCount !== undefined
            ? { engagementCount: updates.engagementCount }
            : {}),
          ...(updates.participantType !== undefined
            ? { participantType: updates.participantType }
            : {}),
        }
      : a,
  );
}
