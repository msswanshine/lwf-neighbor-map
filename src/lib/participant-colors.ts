import type { ParticipantType } from "../features/addresses/types";

/** Filter chips and map ring stroke (see addresses-geojson). */
export const PARTICIPANT_ACCENT_HEX: Record<ParticipantType, string> = {
  residential: "#38bdf8",
  business: "#c084fc",
  institution: "#f472b6",
  hoa: "#fbbf24",
  property_manager: "#34d399",
};
