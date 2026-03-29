export type MapWashTier = "red" | "orange" | "yellow" | "green";

/** Map overlay tier from A/B share percentage (0–100). */
export function abShareToWashTier(pct: number): MapWashTier {
  if (pct >= 75) return "green";
  if (pct >= 50) return "yellow";
  if (pct >= 25) return "orange";
  return "red";
}

/** Semi-transparent wash over the map (same alpha as prior red overlay). */
export const MAP_WASH_RGBA: Record<MapWashTier, string> = {
  red: "rgba(252, 165, 165, 0.35)",
  orange: "rgba(253, 186, 116, 0.35)",
  yellow: "rgba(253, 224, 71, 0.35)",
  green: "rgba(134, 239, 172, 0.35)",
};

/** Solid swatches for sidebar key (panel background differs from map wash). */
export const MAP_WASH_SWATCH_HEX: Record<MapWashTier, string> = {
  red: "#fca5a5",
  orange: "#fdba74",
  yellow: "#fde047",
  green: "#86efac",
};

/** Darker outlines for evacuation zone fill layers on the map. */
export const MAP_WASH_OVERLAY_LINE_HEX: Record<MapWashTier, string> = {
  red: "#dc2626",
  orange: "#ea580c",
  yellow: "#ca8a04",
  green: "#15803d",
};

export const MAP_WASH_TIER_LABEL: Record<MapWashTier, string> = {
  green: "Green",
  yellow: "Yellow",
  orange: "Orange",
  red: "Red",
};

export const MAP_WASH_LEGEND_ROWS: {
  tier: MapWashTier;
  rangeLabel: string;
}[] = [
  { tier: "green", rangeLabel: "75–100%" },
  { tier: "yellow", rangeLabel: "50–74%" },
  { tier: "orange", rangeLabel: "25–49%" },
  { tier: "red", rangeLabel: "0–24%" },
];
