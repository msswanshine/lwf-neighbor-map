import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { ASHLAND_BBOX } from "../config/regions";
import { buildOvertureStyle } from "./overture-style";
import type { AddressRecord } from "../features/addresses/types";
import { gradeToMapColor } from "../lib/rating-colors";
import { PARTICIPANT_ACCENT_HEX } from "../lib/participant-colors";

const MAP_CONTAINER_ID = "fire-prep-map";

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
  el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.35)";
  return el;
}

export type FirePrepMapProps = {
  neighborhoods: FeatureCollection<
    Polygon | MultiPolygon,
    { id: string; name: string; rollupColor: string }
  > | null;
  addresses: AddressRecord[];
  selectedId: string | null;
  onSelectAddress: (id: string | null) => void;
  onSelectNeighborhood: (id: string | null) => void;
  /** Fired once GeoJSON overlays exist; use to fit bounds when the map was not ready on first parent effect. */
  onOverlayReady?: () => void;
};

export type FirePrepMapHandle = {
  fitToAddresses: (addresses: AddressRecord[]) => void;
};

export const FirePrepMap = forwardRef<FirePrepMapHandle, FirePrepMapProps>(
  function FirePrepMap(
    {
      neighborhoods,
      addresses,
      selectedId,
      onSelectAddress,
      onSelectNeighborhood,
      onOverlayReady,
    },
    ref,
  ) {
    const mapRef = useRef<maplibregl.Map | null>(null);

    const neighborhoodsRef = useRef(neighborhoods);
    neighborhoodsRef.current = neighborhoods;

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

      /**
       * Inline styles can finish loading before `map.on("load", …)` runs, so the
       * event is never fired. Always run overlay setup when the style is ready.
       */
      const installNeighborhoodOverlays = () => {
        if (map.getSource("neighborhoods")) return;

        map.addSource("neighborhoods", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "neighborhoods-fill",
          type: "fill",
          source: "neighborhoods",
          paint: {
            "fill-color": ["get", "rollupColor"],
            "fill-opacity": 0.28,
          },
        });
        map.addLayer({
          id: "neighborhoods-outline",
          type: "line",
          source: "neighborhoods",
          paint: {
            "line-color": "#1e293b",
            "line-width": 2,
            "line-opacity": 0.65,
          },
        });

        map.on("click", "neighborhoods-fill", (e) => {
          const f = e.features?.[0];
          const id = f?.properties?.id as string | undefined;
          if (id) {
            onSelectNeighborhoodRef.current(id);
            onSelectAddressRef.current(null);
          }
        });

        map.on("click", (e) => {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: ["neighborhoods-fill"],
          });
          if (hits.length === 0) {
            onSelectAddressRef.current(null);
            onSelectNeighborhoodRef.current(null);
          }
        });

        map.on("mouseenter", "neighborhoods-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "neighborhoods-fill", () => {
          map.getCanvas().style.cursor = "";
        });

        const nSrc = map.getSource("neighborhoods") as maplibregl.GeoJSONSource;
        const nb = neighborhoodsRef.current;
        if (nSrc && nb) nSrc.setData(nb);

        queueMicrotask(() => onOverlayReadyRef.current?.());
      };

      mapRef.current = map;

      if (map.isStyleLoaded()) installNeighborhoodOverlays();
      else map.once("load", installNeighborhoodOverlays);

      return () => {
        map.remove();
        maplibregl.removeProtocol("pmtiles");
        mapRef.current = null;
      };
    }, []);

    const refreshNeighborhoodLayer = useCallback(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;

      const nSrc = map.getSource("neighborhoods") as maplibregl.GeoJSONSource;
      if (nSrc && neighborhoods) nSrc.setData(neighborhoods);
    }, [neighborhoods]);

    useEffect(() => {
      if (!mapRef.current) return;
      const map = mapRef.current;
      if (map.isStyleLoaded()) {
        refreshNeighborhoodLayer();
        return;
      }
      map.once("load", refreshNeighborhoodLayer);
    }, [refreshNeighborhoodLayer]);

    /** DOM markers sit above the WebGL canvas so they are not covered by neighborhood fills and avoid circle-layer GPU quirks. */
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
      <div
        id={MAP_CONTAINER_ID}
        className="h-full w-full min-h-[320px] rounded-lg border border-[var(--color-border)]"
        role="application"
        aria-label="Interactive map of Ashland with preparedness ratings"
      />
    );
  },
);

FirePrepMap.displayName = "FirePrepMap";
