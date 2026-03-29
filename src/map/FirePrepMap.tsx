import {
  useEffect,
  useLayoutEffect,
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
  NEIGHBORHOODS_SOURCE_ID,
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
  /** Stable string that changes whenever grades or zone ids change (GeoJSON tint refresh). */
  neighborhoodTintRevision: string;
  selectedNeighborhoodId: string | null;
  selectedId: string | null;
  onSelectAddress: (id: string | null) => void;
  onSelectNeighborhood: (id: string | null) => void;
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
      neighborhoodTintRevision,
      selectedNeighborhoodId,
      selectedId,
      onSelectAddress,
      onSelectNeighborhood,
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
        fitBoundsOptions: { padding: 52, duration: 0 },
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
            /** Teal dashed lines — distinct from evacuation-zone outlines (green tier uses darker solid green). */
            "line-color": "#0ea5e9",
            "line-width": 4,
            "line-opacity": 0.92,
            "line-dasharray": [1.8, 1.2],
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

    /**
     * Same pattern as zone tint updates: layout phase + wait for GeoJSON worker + repaint so
     * dashed links track A/B grade edits immediately (plain useEffect setData could lag a frame).
     */
    useLayoutEffect(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      const src = map.getSource(HIGH_GRADE_LINKS_SOURCE_ID);
      if (!src || !("setData" in src)) return;
      const data = buildHighGradeProximityLinks(addresses);
      const g = src as maplibregl.GeoJSONSource;
      const pending = g.setData(data, true);
      void pending?.then(() => map.triggerRepaint()).catch(() => {
        map.triggerRepaint();
      });
    }, [addresses]);

    /** Layout effect: push zone GeoJSON + selection paint before paint so tints track grade edits immediately. */
    useLayoutEffect(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded() || !map.getLayer(NEIGHBORHOODS_FILL_LAYER_ID))
        return;
      const src = map.getSource(NEIGHBORHOODS_SOURCE_ID);
      const geo = JSON.parse(JSON.stringify(neighborhoods)) as NeighborhoodGeoJson;
      /** Revision on the collection nudges workers if a diff short-circuits on geometry-only heuristics. */
      (geo as { tintRevision?: string }).tintRevision = neighborhoodTintRevision;

      const applySelectionPaint = () => {
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
        map.triggerRepaint();
      };

      if (src && "setData" in src) {
        const g = src as maplibregl.GeoJSONSource;
        const pending = g.setData(geo, true);
        void pending?.then(applySelectionPaint).catch(() => {
          applySelectionPaint();
        });
      } else {
        applySelectionPaint();
      }
    }, [
      neighborhoods,
      neighborhoodTintRevision,
      selectedNeighborhoodId,
    ]);

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
      <div className="relative h-full min-h-[50vh] w-full rounded-lg border border-[var(--color-border)] md:min-h-0">
        <div
          id={MAP_CONTAINER_ID}
          className="h-full min-h-[50vh] w-full rounded-[inherit] md:min-h-0"
          role="application"
          aria-label="Interactive map of Ashland with preparedness ratings"
        />
      </div>
    );
  },
);

FirePrepMap.displayName = "FirePrepMap";
