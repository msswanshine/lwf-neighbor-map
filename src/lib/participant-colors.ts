import type { ParticipantType } from "../features/addresses/types";

/** Filter chips and map marker ring stroke (FirePrepMap markers). */
export const PARTICIPANT_ACCENT_HEX: Record<ParticipantType, string> = {
  residential: "#38bdf8",
  business: "#c084fc",
  institution: "#f472b6",
  hoa: "#fbbf24",
};
