import type { AddressRecord } from "../features/addresses/types";
import { gradeHexToRgba, gradeToMapColor } from "../lib/rating-colors";
import { PARTICIPANT_ACCENT_HEX } from "../lib/participant-colors";
import { ASHLAND_BBOX } from "../config/regions";

/** Solid “ring” from box-shadow spread: 24px beyond the dot edge, grade-colored. */
export const ADDRESS_HALO_SPREAD_PX = 24;
/** Stronger than the map-wide red wash so halos read clearly on top of it. */
export const ADDRESS_HALO_ALPHA = 0.62;

/** Clamp address extents to Ashland study area; expand point-like sets slightly. */
export function clampedBoundsFromAddresses(
  addresses: AddressRecord[],
): [[number, number], [number, number]] | null {
  if (!addresses.length) return null;
  const [w, s, e, n] = ASHLAND_BBOX;
  let minLng = addresses[0].lng;
  let maxLng = addresses[0].lng;
  let minLat = addresses[0].lat;
  let maxLat = addresses[0].lat;
  for (const a of addresses) {
    minLng = Math.min(minLng, a.lng);
    maxLng = Math.max(maxLng, a.lng);
    minLat = Math.min(minLat, a.lat);
    maxLat = Math.max(maxLat, a.lat);
  }
  const expand = 0.0014;
  if (minLng === maxLng) {
    minLng -= expand;
    maxLng += expand;
  }
  if (minLat === maxLat) {
    minLat -= expand;
    maxLat += expand;
  }
  minLng = Math.max(w, minLng - expand * 0.35);
  maxLng = Math.min(e, maxLng + expand * 0.35);
  minLat = Math.max(s, minLat - expand * 0.35);
  maxLat = Math.min(n, maxLat + expand * 0.35);
  if (minLng >= maxLng || minLat >= maxLat) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function buildAddressMarkerElement(
  a: AddressRecord,
  selected: boolean,
): HTMLButtonElement {
  const fill = gradeToMapColor(a.grade);
  const ring = PARTICIPANT_ACCENT_HEX[a.participantType];
  const size = selected ? 22 : 14;
  const ringW = selected ? 2.5 : 2;
  const haloRgb = gradeHexToRgba(fill, ADDRESS_HALO_ALPHA);
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${a.label}, preparedness ${a.grade ?? "ungraded"}`);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "50%";
  el.style.background = fill;
  el.style.border = `${ringW}px solid ${ring}`;
  el.style.padding = "0";
  el.style.cursor = "pointer";
  el.style.boxSizing = "border-box";
  el.style.display = "block";
  el.style.overflow = "visible";
  el.style.boxShadow = `0 0 0 ${ADDRESS_HALO_SPREAD_PX}px ${haloRgb}, 0 1px 3px rgba(0,0,0,0.35)`;
  return el;
}
