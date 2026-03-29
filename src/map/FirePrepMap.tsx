import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { ASHLAND_BBOX } from "../config/regions";
import { buildOvertureStyle } from "./overture-style";
import type { AddressRecord } from "../features/addresses/types";
import { gradeHexToRgba, gradeToMapColor } from "../lib/rating-colors";
import { PARTICIPANT_ACCENT_HEX } from "../lib/participant-colors";

const MAP_CONTAINER_ID = "fire-prep-map";

/** Solid “ring” from box-shadow spread: 24px beyond the dot edge, grade-colored. */
const ADDRESS_HALO_SPREAD_PX = 24;
/** Stronger than the map-wide red wash so halos read clearly on top of it. */
const ADDRESS_HALO_ALPHA = 0.62;

/** Clamp address extents to Ashland study area; expand point-like sets slightly. */
function clampedBoundsFromAddresses(
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

function buildAddressMarkerElement(
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

export type FirePrepMapProps = {
  addresses: AddressRecord[];
  selectedId: string | null;
  onSelectAddress: (id: string | null) => void;
  onSelectNeighborhood: (id: string | null) => void;
  /** Semi-transparent RGBA wash over the map (A/B city share). */
  mapWashRgba: string;
  /** Fired once the map style is ready (for initial fit). */
  onOverlayReady?: () => void;
};

export type FirePrepMapHandle = {
  fitToAddresses: (addresses: AddressRecord[]) => void;
};

export const FirePrepMap = forwardRef<FirePrepMapHandle, FirePrepMapProps>(
  function FirePrepMap(
    {
      addresses,
      selectedId,
      onSelectAddress,
      onSelectNeighborhood,
      mapWashRgba,
      onOverlayReady,
    },
    ref,
  ) {
    const mapRef = useRef<maplibregl.Map | null>(null);

    const onSelectAddressRef = useRef(onSelectAddress);
    onSelectAddressRef.current = onSelectAddress;
    const onSelectNeighborhoodRef = useRef(onSelectNeighborhood);
    onSelectNeighborhoodRef.current = onSelectNeighborhood;
    const onOverlayReadyRef = useRef(onOverlayReady);
    onOverlayReadyRef.current = onOverlayReady;

    useImperativeHandle(
      ref,
      () => ({
        fitToAddresses: (addrs: AddressRecord[]) => {
          const map = mapRef.current;
          if (!map?.isStyleLoaded() || !addrs.length) return;
          const b = clampedBoundsFromAddresses(addrs);
          if (!b) return;
          map.fitBounds(b, { padding: 52, maxZoom: 16, duration: 550 });
        },
      }),
      [],
    );

    useEffect(() => {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);

      const map = new maplibregl.Map({
        container: MAP_CONTAINER_ID,
        style: buildOvertureStyle(),
        bounds: ASHLAND_BBOX,
        fitBoundsOptions: { padding: 36, duration: 0 },
        minZoom: 8,
        maxZoom: 19,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
          showAccuracyCircle: true,
          showUserLocation: true,
        }),
        "top-right",
      );
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      const onStyleReady = () => {
        map.on("click", () => {
          onSelectAddressRef.current(null);
          onSelectNeighborhoodRef.current(null);
        });
        queueMicrotask(() => onOverlayReadyRef.current?.());
      };

      mapRef.current = map;

      if (map.isStyleLoaded()) onStyleReady();
      else map.once("load", onStyleReady);

      return () => {
        map.remove();
        maplibregl.removeProtocol("pmtiles");
        mapRef.current = null;
      };
    }, []);

    /** DOM markers sit above the WebGL canvas for reliable visibility. */
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const markers: maplibregl.Marker[] = [];

      for (const a of addresses) {
        const selected = a.id === selectedId;
        const el = buildAddressMarkerElement(a, selected);
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onSelectAddressRef.current(a.id);
          onSelectNeighborhoodRef.current(null);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([a.lng, a.lat])
          .addTo(map);
        markers.push(marker);
      }

      return () => {
        for (const m of markers) m.remove();
      };
    }, [addresses, selectedId]);

    return (
      <div className="relative h-full w-full min-h-[420px] rounded-lg border border-[var(--color-border)]">
        <div
          id={MAP_CONTAINER_ID}
          className="h-full w-full min-h-[420px] rounded-[inherit]"
          role="application"
          aria-label="Interactive map of Ashland with preparedness ratings"
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
          style={{ backgroundColor: mapWashRgba }}
          aria-hidden
        />
      </div>
    );
  },
);

FirePrepMap.displayName = "FirePrepMap";
