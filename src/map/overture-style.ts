import type { StyleSpecification } from "maplibre-gl";
import { overturePmtilesUrl } from "../config/regions";

/** Single attribution for all Overture tiles (OSM + Overture, per distribution metadata). */
export const OVERTURE_COMBINED_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a> ' +
  '<a href="https://docs.overturemaps.org/attribution" target="_blank">&copy; Overture Maps Foundation</a>';

/** Minimal Overture base + transportation for context (release pinned in regions). */
export function buildOvertureStyle(): StyleSpecification {
  const baseUrl = overturePmtilesUrl("base");
  const transportUrl = overturePmtilesUrl("transportation");
  const buildingsUrl = overturePmtilesUrl("buildings");

  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      overt_base: {
        type: "vector",
        url: `pmtiles://${baseUrl}`,
        attribution: OVERTURE_COMBINED_ATTRIBUTION,
      },
      /** Same legal coverage as base; omit attribution so the control does not list Overture twice. */
      overt_transport: {
        type: "vector",
        url: `pmtiles://${transportUrl}`,
        attribution: "",
      },
      overt_buildings: {
        type: "vector",
        url: `pmtiles://${buildingsUrl}`,
        attribution: "",
      },
    },
    layers: [
      {
        id: "overt_land",
        type: "fill",
        source: "overt_base",
        "source-layer": "land",
        paint: { "fill-color": "#e6ebe0" },
      },
      {
        id: "overt_land_cover",
        type: "fill",
        source: "overt_base",
        "source-layer": "land_cover",
        paint: { "fill-color": "#dde5d4", "fill-opacity": 0.35 },
      },
      {
        id: "overt_land_use",
        type: "fill",
        source: "overt_base",
        "source-layer": "land_use",
        paint: { "fill-color": "#d4dcc8", "fill-opacity": 0.5 },
      },
      {
        id: "overt_water",
        type: "fill",
        source: "overt_base",
        "source-layer": "water",
        paint: { "fill-color": "#7ebfe0" },
      },
      {
        id: "overt_roads",
        type: "line",
        source: "overt_transport",
        "source-layer": "segment",
        paint: {
          "line-color": "#c9c2b8",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0.4,
            13,
            1.2,
            16,
            3,
          ],
        },
      },
      {
        id: "overt_buildings_fill",
        type: "fill",
        source: "overt_buildings",
        "source-layer": "building",
        minzoom: 15,
        paint: {
          "fill-color": "#c4bbb0",
          "fill-opacity": 0.4,
        },
      },
      {
        id: "overt_buildings_line",
        type: "line",
        source: "overt_buildings",
        "source-layer": "building",
        minzoom: 15,
        paint: {
          "line-color": "#7a726a",
          "line-width": 0.35,
          "line-opacity": 0.85,
        },
      },
    ],
  };
}
