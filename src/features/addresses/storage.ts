import type { AddressPersisted, LetterGrade } from "./types";
import { seedMockAddresses } from "./mock-seed";

const STORAGE_KEY = "fire-prep-addresses-v1";

export type StoredShape = {
  addresses: AddressPersisted[];
};

function parseStored(raw: string | null): AddressPersisted[] | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as StoredShape;
    if (!j?.addresses || !Array.isArray(j.addresses)) return null;
    return j.addresses;
  } catch {
    return null;
  }
}

export function loadAddressesFromStorage(): AddressPersisted[] {
  const fromDisk = parseStored(localStorage.getItem(STORAGE_KEY));
  if (fromDisk?.length) return fromDisk;
  return seedMockAddresses().map(({ neighborhoodId: _, ...rest }) => rest);
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
        }
      : a,
  );
}
