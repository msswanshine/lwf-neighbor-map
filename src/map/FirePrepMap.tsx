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
import {
  NEIGHBORHOODS_FILL_LAYER_ID,
  NEIGHBORHOODS_LINE_LAYER_ID,
  addNeighborhoodOverlayLayers,
  neighborhoodSelectionFillOpacity,
  neighborhoodSelectionLineOpacity,
  neighborhoodSelectionLineWidth,
  type NeighborhoodGeoJson,
} from "./neighborhood-layers";
import { buildOvertureStyle } from "./overture-style";
import type { AddressRecord } from "../features/addresses/types";
import { buildHighGradeProximityLinks } from "../features/addresses/high-grade-proximity-links";
import {
  buildAddressMarkerElement,
  clampedBoundsFromAddresses,
} from "./address-marker";

const MAP_CONTAINER_ID = "fire-prep-map";

const HIGH_GRADE_LINKS_SOURCE_ID = "high-grade-links";
const HIGH_GRADE_LINKS_LAYER_ID = "high-grade-links-line";

export type FirePrepMapProps = {
  addresses: AddressRecord[];
  /** Boundaries used for labels and point-in-polygon (same asset as App fetch). */
  neighborhoods: NeighborhoodGeoJson;
  selectedNeighborhoodId: string | null;
  selectedId: string | null;
  onSelectAddress: (id: string | null) => void;
  onSelectNeighborhood: (id: string | null) => void;
  /** Semi-transparent RGBA wash over the map (A/B city share). */
  mapWashRgba: string;
  /** Fired once the map style is ready (for initial fit). */
  onOverlayReady?: () => void;
  /** Green segments between A/B sites within 1 km. */
  showPotentialFireBreakLinks: boolean;
};

export type FirePrepMapHandle = {
  fitToAddresses: (addresses: AddressRecord[]) => void;
};

export const FirePrepMap = forwardRef<FirePrepMapHandle, FirePrepMapProps>(
  function FirePrepMap(
    {
      addresses,
      neighborhoods,
      selectedNeighborhoodId,
      selectedId,
      onSelectAddress,
      onSelectNeighborhood,
      mapWashRgba,
      onOverlayReady,
      showPotentialFireBreakLinks,
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
    const addressesRef = useRef(addresses);
    addressesRef.current = addresses;
    const showFireBreakLinksRef = useRef(showPotentialFireBreakLinks);
    showFireBreakLinksRef.current = showPotentialFireBreakLinks;
    const neighborhoodsRef = useRef(neighborhoods);
    neighborhoodsRef.current = neighborhoods;

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
        map.addSource(HIGH_GRADE_LINKS_SOURCE_ID, {
          type: "geojson",
          data: buildHighGradeProximityLinks(addressesRef.current),
        });
        map.addLayer({
          id: HIGH_GRADE_LINKS_LAYER_ID,
          type: "line",
          source: HIGH_GRADE_LINKS_SOURCE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
            visibility: showFireBreakLinksRef.current ? "visible" : "none",
          },
          paint: {
            "line-color": "#22c55e",
            "line-width": 5,
            "line-opacity": 0.9,
          },
        });
        addNeighborhoodOverlayLayers(
          map,
          neighborhoodsRef.current,
          HIGH_GRADE_LINKS_LAYER_ID,
        );
        map.setPaintProperty(
          NEIGHBORHOODS_FILL_LAYER_ID,
          "fill-opacity",
          neighborhoodSelectionFillOpacity(null),
        );
        map.setPaintProperty(
          NEIGHBORHOODS_LINE_LAYER_ID,
          "line-width",
          neighborhoodSelectionLineWidth(null),
        );
        map.setPaintProperty(
          NEIGHBORHOODS_LINE_LAYER_ID,
          "line-opacity",
          neighborhoodSelectionLineOpacity(null),
        );
        map.on("click", (e) => {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: [NEIGHBORHOODS_FILL_LAYER_ID],
          });
          if (hits.length) {
            const raw = hits[0].properties?.id;
            const nid = typeof raw === "string" ? raw : String(raw ?? "");
            if (nid) {
              onSelectNeighborhoodRef.current(nid);
              onSelectAddressRef.current(null);
              return;
            }
          }
          onSelectAddressRef.current(null);
          onSelectNeighborhoodRef.current(null);
        });
        const canvas = map.getCanvas();
        map.on("mouseenter", NEIGHBORHOODS_FILL_LAYER_ID, () => {
          canvas.style.cursor = "pointer";
        });
        map.on("mouseleave", NEIGHBORHOODS_FILL_LAYER_ID, () => {
          canvas.style.cursor = "";
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

    useEffect(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded() || !map.getLayer(NEIGHBORHOODS_FILL_LAYER_ID))
        return;
      map.setPaintProperty(
        NEIGHBORHOODS_FILL_LAYER_ID,
        "fill-opacity",
        neighborhoodSelectionFillOpacity(selectedNeighborhoodId),
      );
      map.setPaintProperty(
        NEIGHBORHOODS_LINE_LAYER_ID,
        "line-width",
        neighborhoodSelectionLineWidth(selectedNeighborhoodId),
      );
      map.setPaintProperty(
        NEIGHBORHOODS_LINE_LAYER_ID,
        "line-opacity",
        neighborhoodSelectionLineOpacity(selectedNeighborhoodId),
      );
    }, [selectedNeighborhoodId]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      const src = map.getSource(HIGH_GRADE_LINKS_SOURCE_ID);
      if (src && "setData" in src) {
        (src as maplibregl.GeoJSONSource).setData(
          buildHighGradeProximityLinks(addresses),
        );
      }
    }, [addresses]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded() || !map.getLayer(HIGH_GRADE_LINKS_LAYER_ID))
        return;
      map.setLayoutProperty(
        HIGH_GRADE_LINKS_LAYER_ID,
        "visibility",
        showPotentialFireBreakLinks ? "visible" : "none",
      );
    }, [showPotentialFireBreakLinks]);

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
