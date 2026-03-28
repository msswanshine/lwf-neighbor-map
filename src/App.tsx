import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { ASHLAND_BBOX } from "./config/regions";
import { assignNeighborhoodIds } from "./features/neighborhoods/assign-neighborhood";
import {
  computeNeighborhoodRollups,
  MIN_RATED_ADDRESSES_FOR_ROLLUP,
} from "./features/neighborhoods/rollup";
import type { AddressRecord, LetterGrade } from "./features/addresses/types";
import {
  loadAddressesFromStorage,
  mergeGradeAndEngagement,
  saveAddressesToStorage,
} from "./features/addresses/storage";
import {
  gradeToMapColor,
  GRADE_HEX,
  GRADE_ORDER,
} from "./lib/rating-colors";
import { FirePrepMap } from "./map/FirePrepMap";

type NbProps = { id: string; name: string };

function enrichNeighborhoods(
  raw: FeatureCollection<Polygon | MultiPolygon, NbProps>,
  rollups: ReturnType<typeof computeNeighborhoodRollups>,
): FeatureCollection<Polygon | MultiPolygon, NbProps & { rollupColor: string }> {
  return {
    ...raw,
    features: raw.features.map((f) => {
      const rid = f.properties.id;
      const r = rollups.get(rid);
      const color = gradeToMapColor(r?.grade ?? null);
      return {
        ...f,
        properties: {
          ...f.properties,
          rollupColor: color,
        },
      };
    }),
  };
}

export default function App() {
  const [neighborhoodsBase, setNeighborhoodsBase] = useState<FeatureCollection<
    Polygon | MultiPolygon,
    NbProps
  > | null>(null);
  const [addressesPersisted, setAddressesPersisted] = useState(() =>
    loadAddressesFromStorage(),
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/neighborhoods-ashland.geojson")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setNeighborhoodsBase(j);
      })
      .catch(() => {
        if (!cancelled) setNeighborhoodsBase(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const neighborhoodIds = useMemo(
    () => neighborhoodsBase?.features.map((f) => f.properties.id) ?? [],
    [neighborhoodsBase],
  );

  const addressesWithNb = useMemo(() => {
    if (!neighborhoodsBase) return [];
    const base: AddressRecord[] = addressesPersisted.map((a) => ({
      ...a,
      neighborhoodId: null,
    }));
    return assignNeighborhoodIds(base, neighborhoodsBase);
  }, [addressesPersisted, neighborhoodsBase]);

  const rollups = useMemo(
    () => computeNeighborhoodRollups(addressesWithNb, neighborhoodIds),
    [addressesWithNb, neighborhoodIds],
  );

  const neighborhoodsForMap = useMemo(() => {
    if (!neighborhoodsBase) return null;
    return enrichNeighborhoods(neighborhoodsBase, rollups);
  }, [neighborhoodsBase, rollups]);

  const persist = useCallback((next: typeof addressesPersisted) => {
    setAddressesPersisted(next);
    saveAddressesToStorage(next);
  }, []);

  const setGrade = useCallback(
    (id: string, grade: LetterGrade | null) => {
      persist(mergeGradeAndEngagement(addressesPersisted, { id, grade }));
    },
    [addressesPersisted, persist],
  );

  const bumpEngagement = useCallback(
    (id: string) => {
      const cur = findPersistedAddress(addressesPersisted, id);
      persist(
        mergeGradeAndEngagement(addressesPersisted, {
          id,
          engagementCount: cur.engagementCount + 1,
        }),
      );
    },
    [addressesPersisted, persist],
  );

  const selectedAddress = addressesWithNb.find((a) => a.id === selectedAddressId);
  const selectedRollup = selectedNeighborhoodId
    ? rollups.get(selectedNeighborhoodId)
    : null;
  const selectedNeighborhoodName =
    neighborhoodsBase?.features.find(
      (f) => f.properties.id === selectedNeighborhoodId,
    )?.properties.name ?? null;

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 md:flex-row md:gap-4 md:p-4">
      <div className="flex min-h-[50vh] flex-1 flex-col md:min-h-0">
        <header className="mb-2 shrink-0">
          <h1 className="text-lg font-semibold text-[var(--color-text)] md:text-xl">
            Ashland fire preparedness awareness
          </h1>
          <p className="max-w-prose text-sm text-[var(--color-muted)]">
            Mock addresses and demo neighborhood boundaries (replace{" "}
            <code className="rounded bg-[var(--color-panel)] px-1 text-xs">
              public/data/neighborhoods-ashland.geojson
            </code>{" "}
            with official open data when ready). Basemap: Overture via PMTiles.
          </p>
        </header>
        <div className="min-h-[280px] flex-1">
          {neighborhoodsForMap ? (
            <FirePrepMap
              neighborhoods={neighborhoodsForMap}
              addresses={addressesWithNb}
              selectedId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              onSelectNeighborhood={setSelectedNeighborhoodId}
            />
          ) : (
            <div
              className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)]"
              role="status"
            >
              Loading neighborhood boundaries…
            </div>
          )}
        </div>
      </div>

      <aside
        className="flex w-full shrink-0 flex-col gap-3 md:w-80"
        aria-label="Ratings and legend"
      >
        <Legend />

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Selection
          </h2>
          {!selectedAddress && !selectedNeighborhoodId && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Click an address to set an A–F preparedness grade (mock). Click a
              neighborhood to see rollup.{" "}
              <span className="sr-only">
                Map bounds center on Ashland, Oregon.
              </span>
            </p>
          )}

          {selectedAddress && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {selectedAddress.label}
              </p>
              {selectedAddress.street && (
                <p className="text-xs text-[var(--color-muted)]">
                  {selectedAddress.street}
                </p>
              )}
              <p className="text-xs text-[var(--color-muted)]">
                Engagement (mock): {selectedAddress.engagementCount}
              </p>
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Preparedness grade"
              >
                {GRADE_ORDER.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`min-h-[44px] min-w-[44px] rounded border px-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                      selectedAddress.grade === g
                        ? "border-white text-white"
                        : "border-[var(--color-border)] text-[var(--color-text)]"
                    }`}
                    style={{
                      backgroundColor: GRADE_HEX[g],
                    }}
                    onClick={() => setGrade(selectedAddress.id, g)}
                  >
                    {g}
                  </button>
                ))}
                <button
                  type="button"
                  className="min-h-[44px] rounded border border-[var(--color-border)] px-2 text-xs text-[var(--color-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  onClick={() => setGrade(selectedAddress.id, null)}
                >
                  Clear grade
                </button>
              </div>
              <button
                type="button"
                className="mt-2 rounded border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={() => bumpEngagement(selectedAddress.id)}
              >
                Simulate affiliate visit (+1 engagement)
              </button>
            </div>
          )}

          {selectedNeighborhoodId && selectedRollup && (
            <div className="mt-3 border-t border-[var(--color-border)] pt-3">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {selectedNeighborhoodName ?? selectedNeighborhoodId}
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Rollup grade:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {selectedRollup.grade ?? "Insufficient data"}
                </span>
                {selectedRollup.ratedCount <
                  MIN_RATED_ADDRESSES_FOR_ROLLUP && (
                  <span className="block text-xs">
                    Need at least {MIN_RATED_ADDRESSES_FOR_ROLLUP} graded
                    addresses in this area (currently {selectedRollup.ratedCount}
                    ).
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Rated: {selectedRollup.ratedCount}, Ungraded:{" "}
                {selectedRollup.unratedCount}, Total engagement:{" "}
                {selectedRollup.totalEngagement}
              </p>
              <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs text-[var(--color-muted)]">
                {addressesWithNb
                  .filter((a) => a.neighborhoodId === selectedNeighborhoodId)
                  .map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="text-left text-[var(--color-text)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        onClick={() => {
                          setSelectedNeighborhoodId(null);
                          setSelectedAddressId(a.id);
                        }}
                      >
                        {a.label} — {a.grade ?? "—"}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-xs text-[var(--color-muted)]">
          View: [{ASHLAND_BBOX.join(", ")}] — west, south, east, north.
        </p>
      </aside>
    </div>
  );
}

function findPersistedAddress(
  list: { id: string; engagementCount: number }[],
  id: string,
) {
  const a = list.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown address ${id}`);
  return a;
}

function Legend() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <h2 className="text-sm font-semibold text-[var(--color-text)]">Legend</h2>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        Address dot colors match grade; neighborhood fill is a blended rollup
        (mean of graded addresses; need {MIN_RATED_ADDRESSES_FOR_ROLLUP}+ for a
        letter).
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GRADE_ORDER.map((g) => (
          <li key={g} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full border border-[var(--color-border)]"
              style={{ backgroundColor: GRADE_HEX[g] }}
              aria-hidden
            />
            <span className="text-[var(--color-text)]">{g}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full border border-[var(--color-border)] bg-[#64748b]"
            aria-hidden
          />
          <span className="text-[var(--color-text)]">Ungraded / N/A</span>
        </li>
      </ul>
    </div>
  );
}
