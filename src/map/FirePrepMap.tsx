import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { ASHLAND_BBOX } from "../config/regions";
import { buildOvertureStyle } from "./overture-style";
import { addressesToFeatureCollection } from "./addresses-geojson";
import type { AddressRecord } from "../features/addresses/types";

const MAP_CONTAINER_ID = "fire-prep-map";

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

export function FirePrepMap({
  neighborhoods,
  addresses,
  selectedId,
  onSelectAddress,
  onSelectNeighborhood,
}: FirePrepMapProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const onSelectAddressRef = useRef(onSelectAddress);
  onSelectAddressRef.current = onSelectAddress;
  const onSelectNeighborhoodRef = useRef(onSelectNeighborhood);
  onSelectNeighborhoodRef.current = onSelectNeighborhood;

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
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
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
          "circle-radius": [
            "case",
            ["==", ["get", "id"], selectedIdRef.current ?? ""],
            11,
            8,
          ],
          "circle-color": ["get", "gradeColor"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0f1419",
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
        map.setPaintProperty("addresses-circle", "circle-radius", [
          "case",
          ["==", ["get", "id"], selectedId ?? ""],
          11,
          8,
        ]);
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
}
