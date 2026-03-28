import type { AddressRecord } from "./types";

/** Mock addresses inside Ashland bbox for demo (not geocoded). */
export function seedMockAddresses(): AddressRecord[] {
  const base: Omit<AddressRecord, "neighborhoodId">[] = [
    {
      id: "addr-1",
      lat: 42.1945,
      lng: -122.7095,
      label: "Downtown mock A",
      street: "Main St (mock)",
      grade: "B",
      engagementCount: 2,
    },
    {
      id: "addr-2",
      lat: 42.201,
      lng: -122.698,
      label: "North mock",
      street: "North Mountain Ave (mock)",
      grade: null,
      engagementCount: 0,
    },
    {
      id: "addr-3",
      lat: 42.187,
      lng: -122.72,
      label: "South mock",
      street: "Siskiyou Blvd (mock)",
      grade: "C",
      engagementCount: 5,
    },
    {
      id: "addr-4",
      lat: 42.198,
      lng: -122.685,
      label: "East mock",
      street: "Highland Ave (mock)",
      grade: "A",
      engagementCount: 1,
    },
    {
      id: "addr-5",
      lat: 42.192,
      lng: -122.732,
      label: "West mock",
      street: "Helman St (mock)",
      grade: "D",
      engagementCount: 3,
    },
    {
      id: "addr-6",
      lat: 42.2055,
      lng: -122.712,
      label: "Rail district mock",
      street: "A St (mock)",
      grade: "B",
      engagementCount: 4,
    },
    {
      id: "addr-7",
      lat: 42.18,
      lng: -122.705,
      label: "SOU area mock",
      street: "University Way (mock)",
      grade: "F",
      engagementCount: 1,
    },
  ];
  return base.map((a) => ({ ...a, neighborhoodId: null }));
}
