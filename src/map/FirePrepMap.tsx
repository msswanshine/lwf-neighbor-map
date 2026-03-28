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
import { addressesToFeatureCollection } from "./addresses-geojson";
import type { AddressRecord } from "../features/addresses/types";

const MAP_CONTAINER_ID = "fire-prep-map";

const PARTICIPANT_STROKE_WIDTH: maplibregl.DataDrivenPropertyValueSpecification<number> =
  [
    "match",
    ["get", "participantType"],
    "residential",
    2.5,
    "business",
    3.25,
    "institution",
    3.25,
    "hoa",
    2.75,
    "property_manager",
    3.25,
    2,
  ] as maplibregl.DataDrivenPropertyValueSpecification<number>;

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

/** Larger circles when zoomed in; selected feature gets a bigger radius at each zoom. */
function circleRadiusPaint(
  selectedId: string | null,
): maplibregl.DataDrivenPropertyValueSpecification<number> {
  const sid = selectedId ?? "";
  return [
    "case",
    ["==", ["get", "id"], sid],
    [
      "interpolate",
      ["linear"],
      ["zoom"],
      11,
      10,
      14,
      16,
      17,
      22,
      19,
      28,
    ],
    [
      "interpolate",
      ["linear"],
      ["zoom"],
      11,
      4,
      14,
      7,
      17,
      12,
      19,
      16,
    ],
  ] as maplibregl.DataDrivenPropertyValueSpecification<number>;
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
};

export type FirePrepMapHandle = {
  fitToAddresses: (addresses: AddressRecord[]) => void;
};

export const FirePrepMap = forwardRef<FirePrepMapHandle, FirePrepMapProps>(
  function FirePrepMap(
    { neighborhoods, addresses, selectedId, onSelectAddress, onSelectNeighborhood },
    ref,
  ) {
    const mapRef = useRef<maplibregl.Map | null>(null);
    const selectedIdRef = useRef(selectedId);
    selectedIdRef.current = selectedId;

    const onSelectAddressRef = useRef(onSelectAddress);
    onSelectAddressRef.current = onSelectAddress;
    const onSelectNeighborhoodRef = useRef(onSelectNeighborhood);
    onSelectNeighborhoodRef.current = onSelectNeighborhood;

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
        minZoom: 10,
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

      map.on("load", () => {
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

        map.addSource("addresses", {
          type: "geojson",
          data: addressesToFeatureCollection([]),
        });
        map.addLayer({
          id: "addresses-circle",
          type: "circle",
          source: "addresses",
          paint: {
            "circle-radius": circleRadiusPaint(selectedIdRef.current),
            "circle-color": ["get", "gradeColor"],
            "circle-stroke-width": PARTICIPANT_STROKE_WIDTH,
            "circle-stroke-color": ["get", "participantStroke"],
          },
        });

        map.on("click", "addresses-circle", (e) => {
          const f = e.features?.[0];
          const id = f?.properties?.id as string | undefined;
          if (id) {
            onSelectAddressRef.current(id);
            onSelectNeighborhoodRef.current(null);
          }
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
            layers: ["addresses-circle", "neighborhoods-fill"],
          });
          if (hits.length === 0) {
            onSelectAddressRef.current(null);
            onSelectNeighborhoodRef.current(null);
          }
        });

        map.on("mouseenter", "addresses-circle", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "addresses-circle", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("mouseenter", "neighborhoods-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "neighborhoods-fill", () => {
          map.getCanvas().style.cursor = "";
        });
      });

      mapRef.current = map;

      return () => {
        map.remove();
        maplibregl.removeProtocol("pmtiles");
        mapRef.current = null;
      };
    }, []);

    const refreshLayers = useCallback(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;

      const nSrc = map.getSource("neighborhoods") as maplibregl.GeoJSONSource;
      const aSrc = map.getSource("addresses") as maplibregl.GeoJSONSource;
      if (nSrc && neighborhoods) nSrc.setData(neighborhoods);
      if (aSrc) {
        aSrc.setData(addressesToFeatureCollection(addresses));
        if (map.getLayer("addresses-circle")) {
          map.setPaintProperty(
            "addresses-circle",
            "circle-radius",
            circleRadiusPaint(selectedId),
          );
        }
      }
    }, [neighborhoods, addresses, selectedId]);

    useEffect(() => {
      if (!mapRef.current) return;
      const map = mapRef.current;
      if (map.isStyleLoaded()) {
        refreshLayers();
        return;
      }
      map.once("load", refreshLayers);
    }, [refreshLayers]);

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
