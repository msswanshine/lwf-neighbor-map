#!/usr/bin/env python3
"""
Regenerate public/data/neighborhoods-ashland.geojson for the Ashland study area.

Data strategy (see plan: Overture / OSM):
1. Query Overture division_area (GeoParquet on S3) for subtype in (neighborhood, microhood)
   overlapping ASHLAND_BBOX. If any rows exist, export those polygons as GeoJSON features.
2. Otherwise: load the Overture locality polygon for Ashland, OR (US-OR), clip context.
   Fetch OSM place nodes (neighbourhood, microhood, suburb, quarter) inside the bbox via Overpass.
   Build a Voronoi partition of those seed points, clip each cell to the city polygon, and
   emit one feature per seed with id/name.

Neighborhood order: features are sorted by ascending polygon area so assignNeighborhoodIds()
(prefers first matching polygon) resolves overlaps toward smaller, seed-local regions.

Requires: pip install duckdb shapely  (plus urllib from stdlib)

OSM-derived boundaries are ODbL — https://www.openstreetmap.org/copyright
Overture division_area is Overture + source licenses — https://docs.overturemaps.org/attribution
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Iterable

from shapely.geometry import MultiPoint, Point, box, mapping, shape
from shapely.ops import unary_union, voronoi_diagram

# Must match src/config/regions.ts ASHLAND_BBOX [west, south, east, north]
BBOX_W, BBOX_S, BBOX_E, BBOX_N = -122.752, 42.165, -122.648, 42.225

OVERTURE_RELEASE = "2026-03-18.0"
OVERTURE_DIVISION_AREA_GLOB = (
    f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/"
    "theme=divisions/type=division_area/*.parquet"
)

OUT_PATH = "public/data/neighborhoods-ashland.geojson"
USER_AGENT = "lwf-neighbor-map-neighborhoods-script/1.0"

# Public Overpass instances (504/timeouts are common; we rotate and retry).
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
)

# Last-known OSM place nodes in ASHLAND_BBOX when Overpass is down or times out.
# Coordinates from OpenStreetMap (ODbL). Refresh periodically with a successful Overpass run.
FALLBACK_OSM_SEEDS: tuple[dict[str, Any], ...] = (
    {
        "id": 8643080775,
        "lat": 42.2092217,
        "lon": -122.7033634,
        "name": "Meadowbrook Park",
        "place": "neighbourhood",
    },
    {
        "id": 8639465102,
        "lat": 42.2119432,
        "lon": -122.7119149,
        "name": "Verde Village",
        "place": "neighbourhood",
    },
    {
        "id": 8645285107,
        "lat": 42.2100949,
        "lon": -122.7229003,
        "name": "Billings Ranch",
        "place": "neighbourhood",
    },
    {
        "id": 8643080904,
        "lat": 42.207545,
        "lon": -122.7034148,
        "name": "Kestrel Park",
        "place": "neighbourhood",
    },
)


def overture_ashland_locality_geometry() -> dict[str, Any]:
    """Return GeoJSON geometry dict for Ashland locality from Overture."""
    import duckdb

    con = duckdb.connect(database=":memory:")
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("INSTALL spatial; LOAD spatial;")
    row = con.execute(
        f"""
        SELECT ST_AsGeoJSON(geometry) AS gj
        FROM read_parquet('{OVERTURE_DIVISION_AREA_GLOB}')
        WHERE subtype = 'locality'
          AND names.primary = 'Ashland'
          AND region = 'US-OR'
        LIMIT 1
        """
    ).fetchone()
    if not row or not row[0]:
        raise RuntimeError("Overture: Ashland locality polygon not found")
    return json.loads(row[0])


def overture_neighborhood_features() -> list[dict[str, Any]] | None:
    """If Overture has neighborhood/microhood polygons overlapping bbox, return GeoJSON features."""
    import duckdb

    con = duckdb.connect(database=":memory:")
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("INSTALL spatial; LOAD spatial;")
    w, s, e, n = BBOX_W, BBOX_S, BBOX_E, BBOX_N
    rows = con.execute(
        f"""
        SELECT names.primary AS name,
               id AS division_area_id,
               division_id,
               ST_AsGeoJSON(ST_Intersection(geometry, ST_MakeEnvelope({w}, {s}, {e}, {n}))) AS gj
        FROM read_parquet('{OVERTURE_DIVISION_AREA_GLOB}')
        WHERE subtype IN ('neighborhood', 'microhood')
          AND bbox.xmax >= {w} AND bbox.xmin <= {e}
          AND bbox.ymax >= {s} AND bbox.ymin <= {n}
        """
    ).fetchall()
    if not rows:
        return None
    features: list[dict[str, Any]] = []
    for name, area_id, div_id, gj in rows:
        if not gj:
            continue
        geom = json.loads(gj)
        if geom.get("type") == "GeometryCollection":
            continue
        oid = str(area_id)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"nb-overture-{oid}",
                    "name": name or oid,
                    "source": "overture-division_area",
                    "overtureDivisionAreaId": oid,
                    "overtureDivisionId": str(div_id) if div_id else None,
                },
                "geometry": geom,
            }
        )
    return features or None


def _parse_overpass_place_nodes(data: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for el in data.get("elements", []):
        if el.get("type") != "node":
            continue
        tags = el.get("tags") or {}
        if tags.get("place") in ("town", "city", "village"):
            continue
        name = tags.get("name")
        if not name:
            continue
        out.append(
            {
                "id": el["id"],
                "lat": el["lat"],
                "lon": el["lon"],
                "name": name,
                "place": tags.get("place"),
            }
        )
    return out


def _post_overpass(endpoint: str, query: str, timeout: float) -> dict[str, Any]:
    req = urllib.request.Request(
        endpoint,
        data=query.encode("utf-8"),
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _merge_osm_seeds(
    preferred: list[dict[str, Any]],
    supplemental: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Prefer live Overpass rows; fill in missing node IDs from supplemental (e.g. cache)."""
    by_id: dict[int, dict[str, Any]] = {int(s["id"]): s for s in supplemental}
    for s in preferred:
        by_id[int(s["id"])] = s
    return list(by_id.values())


def overpass_place_nodes() -> list[dict[str, Any]]:
    """
    Fetch neighbourhood / microhood / … place nodes. Includes microhood for finer seeds
    when mappers have added them (smaller Voronoi cells than parent neighbourhood alone).

    On 504/timeouts, retries alternate mirrors; if all fail or <2 seeds, merges with
    FALLBACK_OSM_SEEDS so `npm run build:neighborhoods` keeps working offline.
    """
    q = f"""
[out:json][timeout:90];
(
  node["place"="neighbourhood"]({BBOX_S},{BBOX_W},{BBOX_N},{BBOX_E});
  node["place"="microhood"]({BBOX_S},{BBOX_W},{BBOX_N},{BBOX_E});
  node["place"="suburb"]({BBOX_S},{BBOX_W},{BBOX_N},{BBOX_E});
  node["place"="quarter"]({BBOX_S},{BBOX_W},{BBOX_N},{BBOX_E});
);
out;
""".strip()

    last_err: Exception | None = None
    raw: dict[str, Any] | None = None

    for endpoint in OVERPASS_ENDPOINTS:
        for attempt in range(2):
            try:
                raw = _post_overpass(endpoint, q, timeout=95)
                remark = raw.get("remark")
                if isinstance(remark, str) and (
                    "runtime error" in remark.lower() or "timeout" in remark.lower()
                ):
                    raise RuntimeError(remark)
                last_err = None
                break
            except urllib.error.HTTPError as e:
                last_err = e
                if e.code not in (500, 502, 503, 504, 429):
                    break
                time.sleep(2.0 * (attempt + 1))
            except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as e:
                last_err = e
                time.sleep(2.0 * (attempt + 1))
        if last_err is None and raw is not None:
            break

    seeds = _parse_overpass_place_nodes(raw) if raw else []
    fallback_list = list(FALLBACK_OSM_SEEDS)

    if len(seeds) >= 2:
        return seeds

    merged = _merge_osm_seeds(seeds, fallback_list)
    if len(merged) >= 2:
        print(
            "Using cached OSM seed snapshot (Overpass empty, partial, or unreachable).",
            file=sys.stderr,
        )
        return merged

    raise RuntimeError(
        "Fewer than two OSM seeds after Overpass and fallback merge; update FALLBACK_OSM_SEEDS."
    )


def polygon_area_xy(poly: Any) -> float:
    return float(poly.area)


def normalize_to_feature(geom: Any, props: dict[str, Any]) -> dict[str, Any] | None:
    g = geom
    if g.geom_type == "MultiPolygon":
        g = max(g.geoms, key=polygon_area_xy)
    elif g.geom_type != "Polygon":
        return None
    if g.is_empty or g.area < 1e-14:
        return None
    return {"type": "Feature", "properties": props, "geometry": mapping(g)}


def voronoi_features_from_seeds(
    city_geom: Any,
    seeds: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    city = city_geom
    if city.geom_type == "MultiPolygon":
        city = city.buffer(0)

    pts = [Point(s["lon"], s["lat"]) for s in seeds]
    mp = MultiPoint([(p.x, p.y) for p in pts])
    minx, miny, maxx, maxy = city.bounds
    pad = 0.03
    envelope = box(minx - pad, miny - pad, maxx + pad, maxy + pad)
    vor = voronoi_diagram(mp, envelope=envelope, tolerance=0, edges=False)

    cells = [g for g in vor.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
    features: list[dict[str, Any]] = []

    for seed in seeds:
        p = Point(seed["lon"], seed["lat"])
        matched = None
        for cell in cells:
            try:
                if cell.contains(p) or cell.touches(p):
                    matched = cell
                    break
            except Exception:
                continue
        if matched is None:
            for cell in cells:
                if cell.distance(p) < 1e-9:
                    matched = cell
                    break
        if matched is None:
            continue
        clipped = matched.intersection(city)
        props = {
            "id": f"nb-osm-{seed['id']}",
            "name": seed["name"],
            "source": "osm-place-node-voronoi-overture-locality",
            "osmNodeId": seed["id"],
            "osmPlace": seed.get("place"),
        }
        feat = normalize_to_feature(clipped, props)
        if feat:
            features.append(feat)

    return features


def sort_features_small_first(features: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    feats = list(features)
    scored: list[tuple[float, dict[str, Any]]] = []
    for f in feats:
        g = shape(f["geometry"])
        scored.append((polygon_area_xy(g), f))
    scored.sort(key=lambda x: x[0])
    return [f for _, f in scored]


def remainder_within_city(
    city_geom: Any,
    partition_feats: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Area inside the Overture locality polygon not covered by Voronoi cells."""
    city = city_geom
    if city.geom_type == "MultiPolygon":
        city = city.buffer(0)
    union = None
    for f in partition_feats:
        g = shape(f["geometry"])
        union = g if union is None else union.union(g)
    if union is None:
        return None
    residual = city.difference(union)
    if residual.is_empty:
        return None
    min_area = 1e-9
    if residual.geom_type == "MultiPolygon":
        residual = unary_union([p for p in residual.geoms if polygon_area_xy(p) > min_area])
    elif residual.geom_type == "Polygon" and residual.area <= min_area:
        return None
    if residual.is_empty:
        return None
    return normalize_to_feature(
        residual,
        {
            "id": "nb-ashland-other",
            "name": "Ashland (other)",
            "source": "overture-locality-minus-voronoi",
        },
    )


def remainder_study_bbox(
    partition_feats: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """
    Area inside ASHLAND_BBOX not covered by any neighborhood polygon.
    Catches demo sites slightly outside the Overture locality footprint.
    """
    study = box(BBOX_W, BBOX_S, BBOX_E, BBOX_N)
    union = None
    for f in partition_feats:
        g = shape(f["geometry"])
        union = g if union is None else union.union(g)
    if union is None:
        return None
    residual = study.difference(union)
    if residual.is_empty:
        return None
    min_area = 1e-9
    if residual.geom_type == "MultiPolygon":
        residual = unary_union([p for p in residual.geoms if polygon_area_xy(p) > min_area])
    elif residual.geom_type == "Polygon" and residual.area <= min_area:
        return None
    if residual.is_empty:
        return None
    return normalize_to_feature(
        residual,
        {
            "id": "nb-study-area-gap",
            "name": "Study area (outside mapped localities)",
            "source": "ashland-bbox-minus-all-partitions",
        },
    )


def main() -> int:
    overturf = overture_neighborhood_features()
    if overturf:
        feats = sort_features_small_first(overturf)
        rem_box = remainder_study_bbox(feats)
        if rem_box:
            feats = sort_features_small_first([*feats, rem_box])
        collection = {
            "type": "FeatureCollection",
            "name": "ashland-neighborhoods",
            "attribution": "Bounds from Overture Maps (division_area). https://docs.overturemaps.org/attribution",
            "features": feats,
        }
    else:
        city_geo = overture_ashland_locality_geometry()
        city_shape = shape(city_geo)
        seeds = overpass_place_nodes()
        if len(seeds) < 2:
            print(
                "Overture had no neighborhood polygons and fewer than 2 OSM seeds; "
                "cannot build Voronoi.",
                file=sys.stderr,
            )
            return 1
        feats = voronoi_features_from_seeds(city_shape, seeds)
        if len(feats) < 2:
            print("Voronoi produced fewer than 2 features.", file=sys.stderr)
            return 1
        rem_city = remainder_within_city(city_shape, feats)
        if rem_city:
            feats.append(rem_city)
        rem_box = remainder_study_bbox(feats)
        if rem_box:
            feats.append(rem_box)
        collection = {
            "type": "FeatureCollection",
            "name": "ashland-neighborhoods",
            "attribution": (
                "Boundaries: Voronoi cells clipped to Overture Ashland locality polygon; "
                "seeds from OpenStreetMap place nodes (ODbL). "
                "https://www.openstreetmap.org/copyright · "
                "https://docs.overturemaps.org/attribution"
            ),
            "features": sort_features_small_first(feats),
        }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(collection, f, indent=2)
        f.write("\n")
    print(f"Wrote {OUT_PATH} with {len(collection['features'])} features.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
