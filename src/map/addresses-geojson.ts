import type { FeatureCollection, Feature, Point } from "geojson";
import type { AddressRecord } from "../features/addresses/types";
import { gradeToMapColor } from "../lib/rating-colors";
import { PARTICIPANT_ACCENT_HEX } from "../lib/participant-colors";

export type AddressPointProps = {
  id: string;
  label: string;
  gradeColor: string;
  participantType: AddressRecord["participantType"];
  participantStroke: string;
};

export function addressesToFeatureCollection(
  addresses: AddressRecord[],
): FeatureCollection<Point, AddressPointProps> {
  const features: Feature<Point, AddressPointProps>[] = addresses.map((a) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [a.lng, a.lat] },
    properties: {
      id: a.id,
      label: a.label,
      gradeColor: gradeToMapColor(a.grade),
      participantType: a.participantType,
      participantStroke: PARTICIPANT_ACCENT_HEX[a.participantType],
    },
  }));
  return { type: "FeatureCollection", features };
}
