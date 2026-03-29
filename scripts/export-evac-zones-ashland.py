#!/usr/bin/env python3
"""
Download Ashland evacuation zone polygons from the City EvacZones FeatureServer
(same source as https://ashlandgis.maps.arcgis.com/apps/instant/lookup — webmap Evacuation Zones layer).

Writes public/data/evac-zones-ashland.geojson with properties.id / properties.name expected by the app.

Attribution: City of Ashland GIS — https://www.arcgis.com/home/item.html?id=531ed46f9b5948f591e706ea2bce8079
Terms: informational use; derivative products encouraged; do not sell redistributed copies.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

FEATURE_LAYER = (
    "https://services1.arcgis.com/NTWWSjEn5J53Yoh1/"
    "arcgis/rest/services/EvacZones/FeatureServer/0/query"
)
OUT_PATH = "public/data/evac-zones-ashland.geojson"
USER_AGENT = "lwf-neighbor-map-evac-export/1.0"


def _zone_num(props: dict[str, Any]) -> int:
    raw = props.get("Cnt_TEAM")
    if raw is None:
        raise ValueError("feature missing Cnt_TEAM")
    return int(str(raw).strip())


def main() -> None:
    q = urllib.parse.urlencode(
        {
            "where": "1=1",
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
        }
    )
    url = f"{FEATURE_LAYER}?{q}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = json.load(resp)

    if raw.get("type") != "FeatureCollection" or "features" not in raw:
        raise SystemExit(f"unexpected GeoJSON: {raw!r:.200}")

    features = []
    for feat in raw["features"]:
        props = dict(feat.get("properties") or {})
        n = _zone_num(props)
        zid = f"ash-evac-{n:03d}"
        ash = f"ASH-{n:03d}"
        props["id"] = zid
        props["name"] = f"{ash} (evacuation zone {n})"
        props["evacZoneNumber"] = n
        features.append({"type": "Feature", "geometry": feat["geometry"], "properties": props})

    features.sort(key=lambda f: f["properties"]["evacZoneNumber"])

    out: dict[str, Any] = {
        "type": "FeatureCollection",
        "name": "ashland-evacuation-zones",
        "attribution": (
            "Evacuation zone boundaries: City of Ashland, Oregon (EvacZones feature service). "
            "Reference: official Zone Lookup — "
            "https://ashlandgis.maps.arcgis.com/apps/instant/lookup/index.html?appid=192bced74b664595abd59ab1ea5a7c39"
        ),
        "features": features,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
        f.write("\n")

    print(f"Wrote {len(features)} features to {OUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code}: {e.reason}") from e
