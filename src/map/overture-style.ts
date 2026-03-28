import type { StyleSpecification } from "maplibre-gl";
import { overturePmtilesUrl } from "../config/regions";

/** Minimal Overture base + transportation for context (release pinned in regions). */
export function buildOvertureStyle(): StyleSpecification {
  const baseUrl = overturePmtilesUrl("base");
  const transportUrl = overturePmtilesUrl("transportation");

  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      overt_base: {
        type: "vector",
        url: `pmtiles://${baseUrl}`,
        attribution:
          '<a href="https://docs.overturemaps.org/attribution" target="_blank">Overture Maps</a>',
      },
      overt_transport: {
        type: "vector",
        url: `pmtiles://${transportUrl}`,
        attribution:
          '<a href="https://docs.overturemaps.org/attribution" target="_blank">Overture Maps</a>',
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
    ],
  };
}
